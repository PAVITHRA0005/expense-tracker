// server.js
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(bodyParser.json());
app.use(cors());

// MongoDB connection
const mongoURI = "mongodb://127.0.0.1:27017/expenseTracker"; // Replace if using Atlas
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// JWT secret
const JWT_SECRET = "your_jwt_secret";

// ----------------- Schemas ----------------- //
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  salary: { amount: Number, type: String }, // weekly/monthly/yearly
  limit: Number, // optional spending limit
  createdAt: { type: Date, default: Date.now }
});

const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  category: String,
  amount: Number,
  type: String, // "expense" or "saving"
  date: { type: Date, default: Date.now }
});

const categorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name: String,
  createdAt: { type: Date, default: Date.now }
});

// ----------------- Models ----------------- //
const User = mongoose.model("User", userSchema);
const Expense = mongoose.model("Expense", expenseSchema);
const Category = mongoose.model("Category", categorySchema);

// ----------------- Middleware ----------------- //
const authMiddleware = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).send({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).send({ message: "Invalid token" });
  }
};

// ----------------- Routes ----------------- //

// Signup
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await User.create({ name, email, password: hashedPassword });
    res.status(201).send({ message: "User created successfully" });
  } catch {
    res.status(400).send({ message: "Email already exists" });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).send({ message: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).send({ message: "Incorrect password" });

  const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "1d" });
  res.send({ token, userId: user._id, name: user.name });
});

// ----------------- Profile Routes ----------------- //

// Get profile
app.get("/profile", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.send(user);
});

// Update profile (name, email, salary, limit)
app.put("/profile", authMiddleware, async (req, res) => {
  const { name, email, salaryAmount, salaryType, limit } = req.body;
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    { 
      name, 
      email, 
      salary: { amount: salaryAmount, type: salaryType }, 
      limit 
    },
    { new: true }
  ).select("-password");
  res.send({ message: "Profile updated", updatedUser });
});

// ----------------- Expense Routes ----------------- //

// Add Expense / Saving
app.post("/expense", authMiddleware, async (req, res) => {
  const { category, amount, type } = req.body;
  const expense = await Expense.create({ userId: req.user.id, category, amount, type });
  res.send({ message: "Recorded successfully", expense });
});

// Update Expense
app.put("/expense/:id", authMiddleware, async (req, res) => {
  const { category, amount, type } = req.body;
  const expense = await Expense.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { category, amount, type, date: new Date() },
    { new: true }
  );
  res.send({ message: "Expense updated", expense });
});

// Delete Expense
app.delete("/expense/:id", authMiddleware, async (req, res) => {
  await Expense.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  res.send({ message: "Expense deleted" });
});

// Get all Expenses and summary
app.get("/expenses", authMiddleware, async (req, res) => {
  const expenses = await Expense.find({ userId: req.user.id }).sort({ date: -1 });

  const totalExpenses = expenses.filter(e => e.type === "expense").reduce((a, b) => a + b.amount, 0);
  const totalSavings = expenses.filter(e => e.type === "saving").reduce((a, b) => a + b.amount, 0);

  const user = await User.findById(req.user.id);
  const remaining = user.salary ? user.salary.amount - totalExpenses : 0;

  res.send({ expenses, totalExpenses, totalSavings, remaining, limit: user.limit });
});

// ----------------- Category Routes ----------------- //

// Add Custom Category
app.post("/category", authMiddleware, async (req, res) => {
  const { name } = req.body;
  const category = await Category.create({ userId: req.user.id, name });
  res.send({ message: "Category added", category });
});

// Get Categories
app.get("/categories", authMiddleware, async (req, res) => {
  const categories = await Category.find({ userId: req.user.id });
  res.send(categories);
});

// Delete Category
app.delete("/category/:id", authMiddleware, async (req, res) => {
  await Category.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  res.send({ message: "Category deleted" });
});

// ----------------- Server Start ----------------- //
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
