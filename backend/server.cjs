// backend/server.cjs
// Full deploy-ready server with monthly/yearly logs and monthly reset: auth, expenses, categories, salary/limit, profile,
// + frontend static routes for Vercel, + monthly auto-save check, + update endpoints.

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// ---------- Middleware ----------
app.use(express.json());
app.use(cors());

// ---------- Mongoose models ----------
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  salary: {
    amount: { type: Number, default: 0 },
    type: { type: String, default: 'monthly' }
  },
  limit: { type: Number, default: 0 },
  savedAmount: { type: Number, default: 0 },
  lastSavedMonth: { type: String, default: null },
  categories: { type: [String], default: [] },
  expenses: [
    {
      category: String,
      amount: Number,
      type: { type: String, enum: ['expense','saving'], default: 'expense' },
      date: { type: Date, default: Date.now }
    }
  ],
  monthlyLogs: [
    {
      month: String,
      salary: Number,
      spent: Number,
      saved: Number,
      expenses: [{ category: String, amount: Number, type: String, date: Date }],
      categories: [String]
    }
  ]
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

// ---------- Connect to MongoDB ----------
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=> console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err.message));

// ---------- Helper functions ----------
function monthKeyFromDate(d = new Date()){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// Apply monthly reset & auto-save
async function applyMonthlyAutoSave(user){
  try{
    const salaryAmount = Number(user.salary?.amount || 0);
    if (!salaryAmount) return user;

    const nowKey = monthKeyFromDate(new Date());
    if (user.lastSavedMonth === nowKey) return user;

    const totalExpenses = (user.expenses || []).reduce((s,e) => s + (e.type === 'expense' ? Number(e.amount || 0) : 0), 0);
    const remaining = Math.max(0, salaryAmount - totalExpenses);

    if (remaining > 0) user.savedAmount = (Number(user.savedAmount || 0)) + remaining;

    if(user.lastSavedMonth){
      user.monthlyLogs = user.monthlyLogs || [];
      user.monthlyLogs.push({
        month: user.lastSavedMonth,
        salary: salaryAmount,
        spent: totalExpenses,
        saved: remaining,
        expenses: [...user.expenses],
        categories: [...user.categories]
      });
    }

    user.expenses = [];
    user.categories = [];

    user.lastSavedMonth = nowKey;

    await user.save();
    return user;
  }catch(err){
    console.warn('applyMonthlyAutoSave error', err);
    return user;
  }
}

// Calculate yearly summary from monthly logs
function computeYearlySummary(monthlyLogs = []){
  const yearlyMap = {};
  monthlyLogs.forEach(log => {
    const year = log.month.split('-')[0];
    if(!yearlyMap[year]) yearlyMap[year] = { year, totalSalary: 0, totalSpent: 0, totalSaved: 0 };
    yearlyMap[year].totalSalary += log.salary || 0;
    yearlyMap[year].totalSpent += log.spent || 0;
    yearlyMap[year].totalSaved += log.saved || 0;
  });
  return Object.values(yearlyMap);
}

// ---------- API endpoints ----------
// Signup
app.post('/signup', async (req, res) => {
  try{
    const { username, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email & password required' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'User already exists' });

    const user = new User({
      username: username || email.split('@')[0],
      email,
      password,
      categories: [],
      monthlyLogs: []
    });
    await user.save();
    return res.status(201).json({ message: 'Signup successful', user: { email: user.email, username: user.username } });
  }catch(err){
    console.error('signup error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Login
app.post('/login', async (req, res) => {
  try{
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email & password required' });

    const user = await User.findOne({ email, password });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const fakeToken = Buffer.from(`${user._id}:${Date.now()}`).toString('base64');
    return res.json({ message: 'Login success', token: fakeToken, user: { email: user.email, username: user.username } });
  }catch(err){
    console.error('login error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Profile
app.get('/profile', async (req, res) => {
  try{
    const email = req.query.email || (req.body && req.body.email) || null;
    if (!email) return res.status(400).json({ message: 'Email query required: /profile?email=you@domain.com' });

    let user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user = await applyMonthlyAutoSave(user);

    const totalExpenses = (user.expenses || []).reduce((s,e) => s + (e.type === 'expense' ? Number(e.amount || 0):0), 0);
    const remaining = Math.max(0, Number(user.salary?.amount || 0) - totalExpenses);

    const yearlyLogs = computeYearlySummary(user.monthlyLogs || []);

    return res.json({
      email: user.email,
      username: user.username,
      salary: { amount: user.salary?.amount || 0, type: user.salary?.type || 'monthly' },
      limit: user.limit || 0,
      savedAmount: user.savedAmount || 0,
      lastSavedMonth: user.lastSavedMonth || null,
      expenses: user.expenses || [],
      categories: user.categories || [],
      totalExpenses,
      remaining,
      monthlyLogs: user.monthlyLogs || [],
      yearlyLogs
    });
  }catch(err){
    console.error('profile error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Categories
app.get('/categories', async (req, res) => {
  try{
    const email = req.query.email || null;
    if (email) {
      const user = await User.findOne({ email });
      if (!user) return res.json([]);
      return res.json((user.categories || []).map(name => ({ name })));
    }
    return res.json([]);
  }catch(err){
    console.error('categories error', err);
    return res.status(500).json([]);
  }
});

// Add category
app.post('/category', async (req, res) => {
  try{
    const { email, name } = req.body;
    if (!email || !name) return res.status(400).json({ message: 'email & name required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.categories = user.categories || [];
    if (!user.categories.includes(name)) user.categories.push(name);
    await user.save();
    return res.json({ message: 'Category added', categories: user.categories });
  }catch(err){
    console.error('add category error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Expenses CRUD
app.get('/expenses', async (req, res) => {
  try{
    const email = req.query.email;
    if (!email) return res.status(400).json({ message: 'email required' });
    const user = await User.findOne({ email });
    if (!user) return res.json({ expenses: [], totalExpenses: 0, remaining: user?.salary?.amount || 0 });
    const expenses = (user.expenses || []).map(e => ({ _id: e._id || null, category: e.category, amount: e.amount, type: e.type, date: e.date }));
    const totalExpenses = expenses.reduce((s,e) => s + (e.type === 'expense' ? Number(e.amount || 0):0), 0);
    const remaining = Math.max(0, Number(user.salary?.amount || 0) - totalExpenses);
    return res.json({ expenses, totalExpenses, remaining });
  }catch(err){
    console.error('get expenses error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.post('/expense', async (req, res) => {
  try{
    const { email, category, amount, type } = req.body;
    if (!email || !category || !amount) return res.status(400).json({ message: 'email, category, amount required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const exp = { category, amount: Number(amount), type: type || 'expense', date: new Date() };
    user.expenses.push(exp);
    await user.save();

    const totalExpenses = (user.expenses || []).reduce((s,e) => s + (e.type === 'expense' ? Number(e.amount || 0):0), 0);
    const remaining = Math.max(0, Number(user.salary?.amount || 0) - totalExpenses);
    const limitExceeded = user.limit && (totalExpenses > Number(user.limit || 0));

    return res.json({ message: 'Expense added', expense: exp, totalExpenses, remaining, limitExceeded });
  }catch(err){
    console.error('add expense error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ---------- Static frontend routes for Vercel ----------
const frontendPath = path.join(__dirname, '../frontend');
if(fs.existsSync(frontendPath)){
  app.use(express.static(frontendPath));

  const frontendRoutes = ['/', '/login', '/signup', '/dashboard', '/about', '/profile', '/savings'];
  frontendRoutes.forEach(route => {
    app.get(route, (req,res) => {
      const file = route === '/' ? 'index.html' : route.substring(1)+'.html';
      const f = path.join(frontendPath, file);
      if(fs.existsSync(f)) return res.sendFile(f);
      return res.sendFile(path.join(frontendPath, 'index.html'));
    });
  });

  // Fallback
  app.use((req, res, next) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// ---------- Start server ----------
app.listen(PORT, ()=> {
  console.log(`🚀 Server listening on port ${PORT}`);
});
