// FINAL dashboard.js -- restore all features; only fix: show real username & email, and category row alignment with expense + add button

document.addEventListener('DOMContentLoaded', () => {
  const API = 'http://localhost:5000';
  const token = localStorage.getItem('token') || '';
  const useBackend = !!token;

  // --- Elements ---
  const views = {
    home: document.getElementById('view-home'),
    about: document.getElementById('view-about'),
    savings: document.getElementById('view-savings'),
    profile: document.getElementById('view-profile')
  };
  const navHome = document.getElementById('nav-home');
  const navAbout = document.getElementById('nav-about');
  const navSavings = document.getElementById('nav-savings');
  const navProfile = document.getElementById('nav-profile');
  const btnLogout = document.getElementById('btn-logout');

  const inputSalary = document.getElementById('input-salary');
  const selectMode = document.getElementById('select-mode');
  const btnSaveSalary = document.getElementById('save-salary');
  const inputLimit = document.getElementById('input-limit');
  const btnSaveLimit = document.getElementById('save-limit');
  const dispSalary = document.getElementById('display-salary');
  const dispRemaining = document.getElementById('display-remaining');
  const dispLimit = document.getElementById('display-limit');
  const btnAdd = document.getElementById('btn-add');
  const expensesBody = document.getElementById('expenses-body');

  const categoriesContainer = document.getElementById('categories-container');
  const addCatBtn = document.getElementById('add-cat');
  const customCatInput = document.getElementById('custom-cat');

  const modalOverlay = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalCategory = document.getElementById('modal-category');
  const modalAmount = document.getElementById('modal-amount');
  const modalType = document.getElementById('modal-type');
  const modalCancel = document.getElementById('modal-cancel');
  const modalSave = document.getElementById('modal-save');

  const aboutExpensesBody = document.getElementById('about-expenses-body');

  const timeButtons = Array.from(document.querySelectorAll('.time-btn'));
  const savingsContent = document.getElementById('savings-content');

  const profileNameEl = document.getElementById('profile-name');
  const profileEmailEl = document.getElementById('profile-email');
  const profileSalaryEl = document.getElementById('profile-salary');
  const profileModeEl = document.getElementById('profile-mode');
  const profileSavedEl = document.getElementById('profile-saved');
  const editProfileBtn = document.getElementById('edit-profile');

  const toastEl = document.getElementById('toast');

  // --- App State ---
  const defaultCats = ['Trust','Rent','EMI & Loans','Medical Expenses','Vacation','Electricity Bills'];
  const state = {
    profile: {
      name: localStorage.getItem('profile_name') || 'User',
      email: localStorage.getItem('profile_email') || '',
      salary: JSON.parse(localStorage.getItem('profile_salary') || 'null') || null,
      limit: Number(localStorage.getItem('profile_limit') || 0),
      savedAmount: Number(localStorage.getItem('profile_saved') || 0),
      lastSavedMonth: localStorage.getItem('profile_lastSavedMonth') || null
    },
    categories: JSON.parse(localStorage.getItem('categories') || 'null') || defaultCats.slice(),
    expenses: JSON.parse(localStorage.getItem('expenses') || 'null') || []
  };

  function persistState() {
    localStorage.setItem('categories', JSON.stringify(state.categories));
    localStorage.setItem('expenses', JSON.stringify(state.expenses));
    if (state.profile.salary) localStorage.setItem('profile_salary', JSON.stringify(state.profile.salary));
    localStorage.setItem('profile_limit', String(state.profile.limit || 0));
    localStorage.setItem('profile_name', state.profile.name || '');
    localStorage.setItem('profile_email', state.profile.email || '');
    localStorage.setItem('profile_saved', String(state.profile.savedAmount || 0));
    if (state.profile.lastSavedMonth) localStorage.setItem('profile_lastSavedMonth', state.profile.lastSavedMonth);
  }

  function showToast(msg, ms = 3000) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    toastEl.style.opacity = '1';
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(()=>{ toastEl.style.opacity = '0'; setTimeout(()=>toastEl.style.display='none', 220); }, ms);
  }

  function escapeHtml(s){ return String(s || '').replace(/[&<>'"]/g, k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[k])); }
  function capitalize(s){ return s ? s[0].toUpperCase()+s.slice(1):''; }
  function formatCurrency(n){ if(typeof n!=='number') n = Number(n) || 0; return n.toLocaleString(); }
  function getWeek(d){ d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dayNum = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - dayNum); const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1)); const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7); return {year: d.getUTCFullYear(), week: String(weekNo).padStart(2,'0')}; }

  async function authFetch(path, opts = {}) {
    if (!useBackend) throw new Error('backend disabled');
    const headers = Object.assign({'Content-Type':'application/json'}, opts.headers||{});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(API + path, Object.assign({headers}, opts));
    if (!res.ok) {
      let txt = await res.text().catch(()=>res.statusText);
      try { const j = JSON.parse(txt); txt = j.message || txt; } catch(e){}
      const err = new Error(txt || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return res.json().catch(()=>{});
  }

  // --- Navigation ---
  function showView(name, push = true) {
    Object.values(views).forEach(v => v && v.classList.remove('active'));
    if (!views[name]) name = 'home';
    views[name].classList.add('active');
    if (push) history.pushState({view:name}, '', '#'+name);
    if (name === 'about') renderExpensesTables();
    if (name === 'savings') {
      const def = (state.profile.salary && state.profile.salary.type) ? state.profile.salary.type : 'monthly';
      showSavings(def);
    }
    if (name === 'profile') renderProfile();
  }
  window.addEventListener('popstate', (e)=>{ const v = e.state && e.state.view ? e.state.view : (location.hash ? location.hash.slice(1) : 'home'); showView(v, false); });

  navHome.addEventListener('click', ()=> showView('home'));
  navAbout.addEventListener('click', ()=> showView('about'));
  navSavings.addEventListener('click', ()=> showView('savings'));
  navProfile.addEventListener('click', ()=> showView('profile'));

  btnLogout.addEventListener('click', ()=>{
    localStorage.removeItem('token');
    window.location.href = 'login.html';
  });

  async function loadProfile() {
    if (useBackend) {
      try {
        const data = await authFetch('/profile');
        if (data) {
          state.profile.name = data.username || data.name || state.profile.name || 'User';
          state.profile.email = data.email || state.profile.email || '';
          if (data.salary) state.profile.salary = { amount: Number(data.salary.amount || 0), type: data.salary.type || 'monthly' };
          if (typeof data.limit !== 'undefined') state.profile.limit = Number(data.limit || 0);
          if (typeof data.savedAmount !== 'undefined') state.profile.savedAmount = Number(data.savedAmount || 0);
          if (typeof data.lastSavedMonth !== 'undefined') state.profile.lastSavedMonth = data.lastSavedMonth;
        }
      } catch (err) {
        console.warn('loadProfile backend failed, using local state', err);
        showToast('Unable to fetch profile from server — using local data');
      }
    }
    persistState();
    updateProfileUI();
  }

  function updateProfileUI() {
    const salary = state.profile.salary && Number(state.profile.salary.amount) ? Number(state.profile.salary.amount) : 0;
    const totalExpenses = state.expenses.reduce((s, e) => s + (e.type === 'expense' ? Number(e.amount) : 0), 0);
    const remaining = salary ? (salary - totalExpenses) : (typeof state.profile.savedAmount === 'number' ? state.profile.savedAmount : '-');

    dispSalary.textContent = salary ? (formatCurrency(salary) + ' (' + (state.profile.salary.type || '-') + ')') : '-';
    dispRemaining.textContent = (typeof remaining === 'number') ? formatCurrency(remaining) : '-';
    dispLimit.textContent = state.profile.limit ? formatCurrency(state.profile.limit) : '-';

    if (profileNameEl) profileNameEl.textContent = state.profile.name || 'User';
    if (profileEmailEl) profileEmailEl.textContent = state.profile.email || 'Not provided';
    if (profileSalaryEl) profileSalaryEl.textContent = salary ? formatCurrency(salary) : '-';
    if (profileModeEl) profileModeEl.textContent = state.profile.salary?.type || '-';
    if (profileSavedEl) profileSavedEl.textContent = state.profile.savedAmount ? formatCurrency(state.profile.savedAmount) : '0';
  }

  function renderProfile(){ updateProfileUI(); }

  editProfileBtn.addEventListener('click', ()=>{
    const newName = prompt('Enter your name', state.profile.name || '');
    const newEmail = prompt('Enter your email', state.profile.email || '');
    if (newName) state.profile.name = newName;
    if (newEmail) state.profile.email = newEmail;
    persistState();
    renderProfile();
    showToast('Profile updated locally');
  });

  // --- Categories with EXPENSE + ADD BUTTON inline ---
  function renderCategories() {
    categoriesContainer.innerHTML = '';
    state.categories.forEach(cat => {
      const div = document.createElement('div');
      div.className = 'category-container';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'cat-name';
      nameSpan.textContent = capitalize(cat);

      const expenseSpan = document.createElement('span');
      expenseSpan.className = 'cat-expense';
      const totalCat = state.expenses.filter(e=>e.category===cat && e.type==='expense').reduce((s,e)=>s+Number(e.amount),0);
      expenseSpan.textContent = formatCurrency(totalCat);

      const addBtn = document.createElement('button');
      addBtn.className = 'cat-add';
      addBtn.textContent = 'Add';
      addBtn.onclick = ()=>{
        modalTitle.textContent = 'Add Expense';
        modalAmount.value = '';
        modalType.value = 'expense';
        modalCategory.value = cat;
        modalOverlay.style.display = 'flex';
        modalSave.onclick = ()=>{
          const e = {
            category: modalCategory.value,
            amount: Number(modalAmount.value || 0),
            type: modalType.value,
            date: new Date().toISOString()
          };
          state.expenses.push(e);
          persistState();
          renderExpensesTables();
          renderCategories();
          modalOverlay.style.display = 'none';
          showToast('Expense added');
        };
      };

      div.appendChild(nameSpan);
      div.appendChild(expenseSpan);
      div.appendChild(addBtn);
      categoriesContainer.appendChild(div);
    });
    renderModalCategories();
  }

  addCatBtn.addEventListener('click', ()=>{
    const val = customCatInput.value.trim();
    if (val && !state.categories.includes(val)) {
      state.categories.push(val);
      customCatInput.value = '';
      persistState();
      renderCategories();
      showToast('Category added');
    }
  });

  function renderModalCategories() {
    modalCategory.innerHTML = '';
    state.categories.forEach(c=>{
      const opt = document.createElement('option'); opt.value = c; opt.textContent = capitalize(c);
      modalCategory.appendChild(opt);
    });
  }

  // --- Expenses ---
  function renderExpensesTables() {
    expensesBody.innerHTML = '';
    aboutExpensesBody.innerHTML = '';
    state.expenses.forEach((e, idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(e.category)}</td>
                      <td>${formatCurrency(e.amount)}</td>
                      <td>${escapeHtml(e.type)}</td>
                      <td>${new Date(e.date).toLocaleString()}</td>
                      <td><button class="btn btn-sm" onclick="editExpense(${idx})">Edit</button>
                          <button class="btn btn-sm" onclick="deleteExpense(${idx})">Delete</button></td>`;
      expensesBody.appendChild(tr);
      aboutExpensesBody.appendChild(tr.cloneNode(true));
    });
    updateProfileUI();
  }

  window.editExpense = function(idx){
    const e = state.expenses[idx];
    if(!e) return;
    modalTitle.textContent = 'Edit Expense';
    modalCategory.value = e.category;
    modalAmount.value = e.amount;
    modalType.value = e.type;
    modalOverlay.style.display = 'flex';
    modalSave.onclick = ()=>{
      e.category = modalCategory.value;
      e.amount = Number(modalAmount.value || 0);
      e.type = modalType.value;
      e.date = new Date().toISOString();
      persistState(); renderExpensesTables(); renderCategories();
      modalOverlay.style.display = 'none';
      showToast('Expense updated');
    };
  };

  window.deleteExpense = function(idx){
    if(confirm('Are you sure to delete this expense?')){
      state.expenses.splice(idx,1); persistState(); renderExpensesTables(); renderCategories();
      showToast('Expense deleted');
    }
  };

  btnAdd.addEventListener('click', ()=>{
    modalTitle.textContent = 'Add Expense';
    modalAmount.value = '';
    modalType.value = 'expense';
    modalOverlay.style.display = 'flex';
    modalSave.onclick = ()=>{
      const e = {
        category: modalCategory.value,
        amount: Number(modalAmount.value || 0),
        type: modalType.value,
        date: new Date().toISOString()
      };
      state.expenses.push(e);
      persistState(); renderExpensesTables(); renderCategories();
      modalOverlay.style.display = 'none';
      showToast('Expense added');
    };
  });
  modalCancel.addEventListener('click', ()=>modalOverlay.style.display='none');

  // --- Salary / Limit ---
  btnSaveSalary.addEventListener('click', ()=>{
    const val = Number(inputSalary.value || 0);
    if(val<=0){ showToast('Enter a valid salary'); return; }
    state.profile.salary = { amount: val, type: selectMode.value };
    persistState(); updateProfileUI();
    showToast('Salary saved');
  });

  btnSaveLimit.addEventListener('click', ()=>{
    const val = Number(inputLimit.value || 0);
    state.profile.limit = val; persistState(); updateProfileUI();
    showToast('Limit saved');
  });

  // --- Savings view ---
  function showSavings(period){
    const now = new Date();
    const filtered = state.expenses.filter(e=>{
      const d = new Date(e.date);
      if(period==='daily') return d.toDateString()===now.toDateString();
      if(period==='weekly'){ const w1 = getWeek(now); const w2 = getWeek(d); return w1.year===w2.year && w1.week===w2.week; }
      if(period==='monthly') return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
      if(period==='yearly') return d.getFullYear()===now.getFullYear();
      return false;
    });
    let html = '<table><thead><tr><th>Category</th><th>Amount</th><th>Type</th></tr></thead><tbody>';
    filtered.forEach(e=>{
      html += `<tr><td>${escapeHtml(e.category)}</td><td>${formatCurrency(e.amount)}</td><td>${escapeHtml(e.type)}</td></tr>`;
    });
    html += '</tbody></table>';
    savingsContent.innerHTML = html;
  }
  timeButtons.forEach(b=>b.addEventListener('click', ()=> showSavings(b.dataset.period)));

  // --- Monthly auto-save ---
  const thisMonth = new Date().getMonth();
  if(state.profile.lastSavedMonth!==String(thisMonth)){
    state.profile.savedAmount = 0;
    state.profile.lastSavedMonth = String(thisMonth);
    persistState();
  }

  // --- Initialize ---
  renderCategories();
  renderExpensesTables();
  loadProfile();
  const hashView = location.hash ? location.hash.slice(1) : 'home';
  showView(hashView, false);
});
