// FINAL dashboard.js -- restore all features; only fix: show real username & real email on Profile.
// Merged with: logout fix, limit popup, monthly auto-save.
// Paste this file as dashboard.js and keep your dashboard.html and dashboard.css intact.

document.addEventListener('DOMContentLoaded', () => {
  const API = 'http://localhost:5000';
  const token = localStorage.getItem('token') || '';
  const useBackend = !!token;

  // --- Elements (IDs match the HTML you already have) ---
  const views = {
    home: document.getElementById('view-home'),
    about: document.getElementById('view-about'),
    savings: document.getElementById('view-savings'),
    profile: document.getElementById('view-profile')
  };

  // nav
  const navHome = document.getElementById('nav-home');
  const navAbout = document.getElementById('nav-about');
  const navSavings = document.getElementById('nav-savings');
  const navProfile = document.getElementById('nav-profile');
  const btnLogout = document.getElementById('btn-logout');

  // Home controls
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

  // categories & modal
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

  // About table
  const aboutExpensesBody = document.getElementById('about-expenses-body');

  // Savings controls
  const timeButtons = Array.from(document.querySelectorAll('.time-btn'));
  const savingsContent = document.getElementById('savings-content');

  // Profile elements (IDs in your HTML)
  const profileNameEl = document.getElementById('profile-name');
  const profileEmailEl = document.getElementById('profile-email');
  const profileSalaryEl = document.getElementById('profile-salary');
  const profileModeEl = document.getElementById('profile-mode');
  const profileSavedEl = document.getElementById('profile-saved');
  const editProfileBtn = document.getElementById('edit-profile');

  // toast
  const toastEl = document.getElementById('toast');

  // --- App State & defaults ---
  const defaultCats = ['Trust','Rent','EMI & Loans','Medical Expenses','Vacation','Electricity Bills'];
  const state = {
    profile: { name: localStorage.getItem('profile_name') || 'User', email: localStorage.getItem('profile_email') || '' ,
               salary: JSON.parse(localStorage.getItem('profile_salary') || 'null') || null,
               limit: Number(localStorage.getItem('profile_limit') || 0),
               savedAmount: Number(localStorage.getItem('profile_saved') || 0),
               lastSavedMonth: localStorage.getItem('profile_lastSavedMonth') || null
             },
    categories: JSON.parse(localStorage.getItem('categories') || 'null') || defaultCats.slice(),
    expenses: JSON.parse(localStorage.getItem('expenses') || 'null') || [] // {id, category, amount, type, date}
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

  // --- helpers ---
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

  // --- Navigation (SPA views) ---
  function showView(name, push = true) {
    Object.values(views).forEach(v => v && v.classList.remove('active'));
    if (!views[name]) name = 'home';
    views[name].classList.add('active');
    if (push) history.pushState({view:name}, '', '#'+name);
    if (name === 'about') renderAboutTable();
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

  // --- LOGOUT FIX (changed to redirect to login.html) ---
  btnLogout.addEventListener('click', ()=>{
    localStorage.removeItem('token');
    // keep other local data if you prefer (so local mode works), but redirect to login page
    window.location.href = 'login.html';
  });

  // --- Profile loader (backend preferred; local fallback) ---
  async function loadProfile() {
    // default keep local values (already in state.profile)
    if (useBackend) {
      try {
        const data = await authFetch('/profile');
        if (data) {
          // prefer backend values but keep shape compatible with our state
          state.profile.name = data.username || data.name || state.profile.name || 'User';
          state.profile.email = data.email || state.profile.email || '';
          // salary object may be inside data.salary
          if (data.salary) state.profile.salary = { amount: Number(data.salary.amount || 0), type: data.salary.type || 'monthly' };
          if (typeof data.limit !== 'undefined') state.profile.limit = Number(data.limit || 0);
          // server may provide savedAmount or remaining; we keep savedAmount if provided
          if (typeof data.savedAmount !== 'undefined') state.profile.savedAmount = Number(data.savedAmount || 0);
          if (typeof data.lastSavedMonth !== 'undefined') state.profile.lastSavedMonth = data.lastSavedMonth;
        }
      } catch (err) {
        console.warn('loadProfile backend failed, using local state', err);
        showToast('Unable to fetch profile from server — using local data');
      }
    } // else use local
    persistState();
    updateProfileUI();
  }

  function updateProfileUI() {
    // Home cards
    const salary = state.profile.salary && Number(state.profile.salary.amount) ? Number(state.profile.salary.amount) : 0;
    const totalExpenses = state.expenses.reduce((s, e) => s + (e.type === 'expense' ? Number(e.amount) : 0), 0);
    const remaining = salary ? (salary - totalExpenses) : (typeof state.profile.savedAmount === 'number' ? state.profile.savedAmount : '-');

    dispSalary.textContent = salary ? (formatCurrency(salary) + ' (' + (state.profile.salary.type || '-') + ')') : '-';
    dispRemaining.textContent = (typeof remaining === 'number') ? formatCurrency(remaining) : '-';
    dispLimit.textContent = state.profile.limit ? formatCurrency(state.profile.limit) : '-';

    // Profile view
    if (profileNameEl) profileNameEl.textContent = state.profile.name || 'User';
    if (profileEmailEl) profileEmailEl.textContent = state.profile.email || 'Not provided';
    if (profileSalaryEl) profileSalaryEl.textContent = salary ? formatCurrency(salary) : '-';
    if (profileModeEl) profileModeEl.textContent = (state.profile.salary && state.profile.salary.type) ? capitalize(state.profile.salary.type) : '-';
    if (profileSavedEl) profileSavedEl.textContent = formatCurrency(typeof state.profile.savedAmount === 'number' ? state.profile.savedAmount : (salary - totalExpenses));
  }

  // --- Categories load (backend preferred) ---
  async function loadCategories() {
    if (useBackend) {
      try {
        const list = await authFetch('/categories');
        const names = (list || []).map(c => c.name);
        // merge defaults + backend (avoid duplicates)
        const merged = [];
        const seen = new Set();
        defaultCats.concat(names).forEach(n => { if (!seen.has(n)) { seen.add(n); merged.push(n); } });
        state.categories = merged;
      } catch (err) {
        console.warn('categories fetch failed, using local', err);
        showToast('Could not load categories from server — using local');
        if (!state.categories || !state.categories.length) state.categories = defaultCats.slice();
      }
    } else {
      if (!state.categories || !state.categories.length) state.categories = defaultCats.slice();
    }
    persistState();
    renderCategories();
    populateModalCategoryOptions();
  }

  // --- Expenses load (backend preferred) ---
  async function loadExpenses() {
    if (useBackend) {
      try {
        const data = await authFetch('/expenses');
        // server expected to return { expenses: [...], totalExpenses: ..., remaining: ... }
        if (data && Array.isArray(data.expenses)) {
          // normalize to our state shape: for backend docs, may have _id; convert to id
          state.expenses = data.expenses.map(e => ({
            id: e._id || e.id || ('e_' + Math.random().toString(36).slice(2,9)),
            category: e.category,
            amount: Number(e.amount),
            type: e.type,
            date: e.date || new Date().toISOString()
          }));
        } else {
          // fallback keep local
        }
      } catch (err) {
        console.warn('expenses fetch failed — using local', err);
        showToast('Could not load expenses from server — using local data');
      }
    }
    persistState();
    renderExpensesTables();
  }

  // --- Render expenses for Home + About ---
  function renderExpensesTables() {
    // Home table
    expensesBody.innerHTML = '';
    if (!state.expenses.length) {
      expensesBody.innerHTML = '<tr><td colspan="5" class="muted">No expenses yet.</td></tr>';
    } else {
      state.expenses.slice().reverse().forEach(exp => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + escapeHtml(exp.category) + '</td>'
                     + '<td>' + escapeHtml(String(exp.amount)) + '</td>'
                     + '<td>' + escapeHtml(exp.type) + '</td>'
                     + '<td>' + new Date(exp.date).toLocaleString() + '</td>'
                     + '<td></td>';
        const actionTd = tr.querySelector('td:last-child');
        const editBtn = document.createElement('button'); editBtn.textContent='Edit'; editBtn.className='small'; editBtn.style.marginRight='8px';
        editBtn.onclick = ()=> openEditModal(exp.id);
        const delBtn = document.createElement('button'); delBtn.textContent='Delete'; delBtn.className='small'; delBtn.style.background='#b33';
        delBtn.onclick = ()=> deleteExpense(exp.id);
        actionTd.appendChild(editBtn); actionTd.appendChild(delBtn);
        expensesBody.appendChild(tr);
      });
    }

    // About table
    aboutExpensesBody.innerHTML = '';
    if (!state.expenses.length) {
      aboutExpensesBody.innerHTML = '<tr><td colspan="5" class="muted">No expenses recorded yet.</td></tr>';
    } else {
      state.expenses.slice().reverse().forEach(exp => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + escapeHtml(exp.category) + '</td>'
                     + '<td>' + escapeHtml(String(exp.amount)) + '</td>'
                     + '<td>' + escapeHtml(exp.type) + '</td>'
                     + '<td>' + new Date(exp.date).toLocaleString() + '</td>'
                     + '<td></td>';
        const actionTd = tr.querySelector('td:last-child');
        const editBtn = document.createElement('button'); editBtn.textContent='Edit'; editBtn.className='small'; editBtn.style.marginRight='8px';
        editBtn.onclick = ()=> openEditModal(exp.id);
        const delBtn = document.createElement('button'); delBtn.textContent='Delete'; delBtn.className='small'; delBtn.style.background='#b33';
        delBtn.onclick = ()=> deleteExpense(exp.id);
        actionTd.appendChild(editBtn); actionTd.appendChild(delBtn);
        aboutExpensesBody.appendChild(tr);
      });
    }

    // categories content will also reference state.expenses when expanded
    renderCategories();
    updateProfileUI();
    checkLimitAlert();
  }

  // --- Categories render & toggle ---
  function renderCategories() {
    categoriesContainer.innerHTML = '';
    state.categories.forEach(name => {
      const card = document.createElement('div'); card.className = 'cat-card';
      const row = document.createElement('div'); row.className = 'cat-row';
      const left = document.createElement('div'); left.textContent = name; left.style.fontWeight='600';
      const right = document.createElement('div');
      const toggleBtn = document.createElement('button'); toggleBtn.textContent='Expand'; toggleBtn.onclick = ()=> toggleCategory(name, card);
      const addBtn = document.createElement('button'); addBtn.textContent='Add item'; addBtn.style.marginLeft='8px'; addBtn.onclick = ()=> openAddModal(name);
      right.appendChild(toggleBtn); right.appendChild(addBtn);
      row.appendChild(left); row.appendChild(right);
      card.appendChild(row);
      const content = document.createElement('div'); content.className='cat-content'; content.style.display='none';
      card.appendChild(content);
      categoriesContainer.appendChild(card);
    });
    populateModalCategoryOptions();
  }

  function toggleCategory(name, card) {
    const content = card.querySelector('.cat-content');
    if (content.style.display === 'block') { content.style.display = 'none'; return; }
    content.innerHTML = '';
    const items = state.expenses.filter(e => e.category === name);
    if (!items.length) content.innerHTML = '<div class="muted">No items yet.</div>';
    else {
      items.forEach(it => {
        const line = document.createElement('div'); line.style.display='flex'; line.style.justifyContent='space-between'; line.style.padding='8px 0';
        line.innerHTML = '<div><div style="font-weight:600">'+escapeHtml(String(it.amount))+'</div><div class="small muted">'+escapeHtml(it.type)+' • '+new Date(it.date).toLocaleString()+'</div></div>';
        const actions = document.createElement('div');
        const eBtn = document.createElement('button'); eBtn.textContent='Edit'; eBtn.onclick = ()=> openEditModal(it.id); eBtn.style.marginRight='8px';
        const dBtn = document.createElement('button'); dBtn.textContent='Delete'; dBtn.style.background='#b33'; dBtn.onclick = ()=> deleteExpense(it.id);
        actions.appendChild(eBtn); actions.appendChild(dBtn); line.appendChild(actions); content.appendChild(line);
      });
    }
    content.style.display = 'block';
  }

  // --- Modal add/edit ---
  let editingId = null;
  function populateModalCategoryOptions() {
    modalCategory.innerHTML = '';
    state.categories.forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = c; modalCategory.appendChild(opt); });
  }
  function openAddModal(cat) {
    editingId = null;
    modalTitle.textContent = 'Add Expense / Saving';
    modalCategory.value = cat || (modalCategory.options[0] && modalCategory.options[0].value) || '';
    modalAmount.value = '';
    modalType.value = 'expense';
    showModal();
  }
  function openEditModal(id) {
    const exp = state.expenses.find(x => x.id === id); if (!exp) { showToast('Item not found'); return; }
    editingId = id;
    modalTitle.textContent = 'Edit Expense';
    modalCategory.value = exp.category;
    modalAmount.value = exp.amount;
    modalType.value = exp.type;
    showModal();
  }
  function showModal() { modalOverlay.classList.add('show'); modalOverlay.setAttribute('aria-hidden','false'); }
  function hideModal() { modalOverlay.classList.remove('show'); modalOverlay.setAttribute('aria-hidden','true'); editingId = null; }
  modalCancel.addEventListener('click', hideModal);
  modalOverlay.addEventListener('click', (e)=>{ if (e.target === modalOverlay) hideModal(); });

  modalSave.addEventListener('click', async () => {
    const payload = { category: modalCategory.value, amount: Number(modalAmount.value), type: modalType.value };
    if (!payload.category || isNaN(payload.amount) || payload.amount <= 0) { showToast('Please select category and enter a valid amount'); return; }

    // If backend available, try server call; fallback to local update
    if (useBackend) {
      try {
        if (editingId) {
          // server expects /expense/:id PUT
          await authFetch('/expense/' + editingId, { method: 'PUT', body: JSON.stringify(payload) });
          showToast('Updated');
        } else {
          await authFetch('/expense', { method: 'POST', body: JSON.stringify(payload) });
          showToast('Saved');
        }
        hideModal();
        await loadExpenses();
        await loadProfile();
        return;
      } catch (err) {
        console.warn('server expense save failed, falling back to local', err);
        showToast('Server save failed — saved locally');
      }
    }

    // Local fallback: update state.expenses
    if (editingId) {
      const idx = state.expenses.findIndex(x => x.id === editingId);
      if (idx !== -1) {
        state.expenses[idx].category = payload.category;
        state.expenses[idx].amount = payload.amount;
        state.expenses[idx].type = payload.type;
        state.expenses[idx].date = new Date().toISOString();
        showToast('Updated (local)');
      } else showToast('Item not found');
    } else {
      const id = 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
      state.expenses.push({ id, category: payload.category, amount: payload.amount, type: payload.type, date: new Date().toISOString() });
      showToast('Saved (local)');
    }
    persistState();
    hideModal();
    renderExpensesTables();
  });

  // --- Delete expense ---
  async function deleteExpense(id) {
    if (!confirm('Delete item?')) return;
    if (useBackend) {
      try { await authFetch('/expense/' + id, { method: 'DELETE' }); showToast('Deleted'); await loadExpenses(); await loadProfile(); return; }
      catch (err) { console.warn('delete backend failed, falling back local', err); showToast('Server delete failed — local delete'); }
    }
    const idx = state.expenses.findIndex(x => x.id === id);
    if (idx !== -1) { state.expenses.splice(idx,1); persistState(); showToast('Deleted (local)'); renderExpensesTables(); }
    else showToast('Item not found');
  }

  // --- Add custom category ---
  addCatBtn.addEventListener('click', async () => {
    const v = customCatInput.value.trim(); if (!v) return;
    if (useBackend) {
      try {
        await authFetch('/category', { method: 'POST', body: JSON.stringify({ name: v }) });
        showToast('Category added');
        customCatInput.value = '';
        await loadCategories();
        return;
      } catch (err) { console.warn('category add backend failed, fallback', err); showToast('Server error — added locally'); }
    }
    if (!state.categories.includes(v)) { state.categories.push(v); persistState(); populateModalCategoryOptions(); renderCategories(); customCatInput.value=''; showToast('Category added (local)'); }
    else showToast('Category exists');
  });

  // --- Save Salary & Limit ---
  btnSaveSalary && btnSaveSalary.addEventListener('click', async () => {
    const amount = Number(inputSalary.value); const type = selectMode.value;
    if (!amount || amount <= 0) { showToast('Enter a valid salary'); return; }
    if (useBackend) {
      try {
        await authFetch('/salary', { method: 'POST', body: JSON.stringify({ amount, type }) });
        showToast(capitalize(type) + ' mode saved');
        await loadProfile(); await loadExpenses();
        return;
      } catch (err) { console.warn('salary save backend failed', err); showToast('Server save failed — saved locally'); }
    }
    // local fallback
    state.profile.salary = { amount, type }; persistState(); updateProfileUI(); showToast('Salary saved (local)');
  });

  btnSaveLimit && btnSaveLimit.addEventListener('click', async () => {
    const l = Number(inputLimit.value);
    if (!l || l <= 0) { showToast('Enter a valid limit'); return; }
    if (useBackend) {
      try { await authFetch('/limit', { method: 'POST', body: JSON.stringify({ limit: l }) }); showToast('Limit saved'); await loadProfile(); return; }
      catch (err) { console.warn('limit save failed', err); showToast('Server limit save failed — saved locally'); }
    }
    state.profile.limit = l; persistState(); updateProfileUI(); showToast('Limit saved (local)');
  });

  // --- Savings view ---
  function showSavings(period) {
    timeButtons.forEach(b => b.classList.toggle('active', b.dataset.period === period));
    // aggregate by period
    const groups = {};
    state.expenses.forEach(e => {
      const d = new Date(e.date);
      let label = '';
      if (period === 'daily') label = d.toLocaleDateString();
      else if (period === 'weekly') { const w = getWeek(d); label = `${w.year}-W${w.week}`; }
      else if (period === 'monthly') label = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      else label = String(d.getFullYear());
      if (!groups[label]) groups[label] = { expense:0, saving:0 };
      if (e.type === 'expense') groups[label].expense += Number(e.amount);
      else groups[label].saving += Number(e.amount);
    });
    const labels = Object.keys(groups).sort((a,b)=> a>b?-1:1).slice(0,20);
    let html = `<div style="margin-top:12px"><strong>Showing ${labels.length} ${period} entries (most recent)</strong></div>`;
    html += `<div style="margin-top:12px"><table style="width:100%;border-collapse:collapse"><thead><tr style="color:#a8a8a8"><th>Period</th><th>Expenses</th><th>Savings</th><th>Net</th></tr></thead><tbody>`;
    if (!labels.length) html += `<tr><td colspan="4" class="muted">No data</td></tr>`;
    labels.forEach(lbl => { const g = groups[lbl]; const net = (g.saving - g.expense); html += `<tr><td>${escapeHtml(lbl)}</td><td>${formatCurrency(g.expense)}</td><td>${formatCurrency(g.saving)}</td><td>${formatCurrency(net)}</td></tr>`; });
    html += `</tbody></table></div>`;
    savingsContent.innerHTML = html;
  }
  timeButtons.forEach(btn => btn.addEventListener('click', ()=> { showSavings(btn.dataset.period); }));

  // --- Profile render & edit local ---
  function renderProfile() {
    // ensure profile state is up to date (from server if available)
    if (useBackend) {
      // we already attempted loadProfile earlier; render from state
    }
    updateProfileUI();
  }
  editProfileBtn && editProfileBtn.addEventListener('click', () => {
    const newName = prompt('Enter name', state.profile.name || '');
    if (newName !== null) state.profile.name = newName.trim() || state.profile.name;
    const newEmail = prompt('Enter email', state.profile.email || '');
    if (newEmail !== null) state.profile.email = newEmail.trim() || state.profile.email;
    persistState(); renderProfile(); showToast('Profile updated locally');
  });

  // --- Utility: check limit alert ---
  // track alert state to avoid spamming
  state._limitAlertShown = false;
  function checkLimitAlert() {
    const spent = state.expenses.reduce((s,e)=> s + (e.type==='expense' ? Number(e.amount) : 0), 0);
    if (state.profile.limit && spent > state.profile.limit) {
      // show toast & popup once until cleared
      if (!state._limitAlertShown) {
        showToast('Spending limit exceeded!', 4500);
        try { alert('⚠️ You have exceeded your saving limit!'); } catch(e) {}
        state._limitAlertShown = true;
      }
    } else {
      state._limitAlertShown = false;
    }
  }

  // --- Monthly auto-save logic (newly added) ---
  // Moves remaining into savedAmount when a new month starts.
  async function checkMonthReset() {
    try {
      const salary = state.profile.salary && Number(state.profile.salary.amount) ? Number(state.profile.salary.amount) : 0;
      if (!salary) return; // nothing to do

      const last = state.profile.lastSavedMonth || localStorage.getItem('profile_lastSavedMonth') || null;
      const now = new Date();
      const nowKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`; // YYYY-MM

      if (last !== nowKey) {
        // compute remaining (salary - expenses)
        const totalExpenses = state.expenses.reduce((s, e) => s + (e.type === 'expense' ? Number(e.amount) : 0), 0);
        const remaining = salary - totalExpenses;
        if (remaining > 0) {
          state.profile.savedAmount = (Number(state.profile.savedAmount) || 0) + remaining;
          // reset remaining for new month to full salary (or you may want a different behavior)
          // We'll reset local representation by clearing expenses for a new month? We'll simply note lastSavedMonth and persist.
          // Persist changes locally:
          state.profile.lastSavedMonth = nowKey;
          persistState();
          // inform server if backend exists
          if (useBackend) {
            try {
              await authFetch('/updateSavings', { method: 'POST', body: JSON.stringify({
                totalSaved: state.profile.savedAmount,
                lastSavedMonth: nowKey,
                remainingAfterReset: salary
              })});
            } catch(err) {
              console.warn('updateSavings failed', err);
              // fallback: only local update
            }
          }
          showToast('Previous month remaining added to Total Saved', 4000);
        } else {
          // still update marker so we don't repeat
          state.profile.lastSavedMonth = nowKey;
          persistState();
          if (useBackend) {
            try { await authFetch('/updateSavings', { method: 'POST', body: JSON.stringify({ lastSavedMonth: nowKey }) }); } catch(e){/*ignore*/ }
          }
        }
      }
    } catch (err) {
      console.warn('checkMonthReset error', err);
    }
  }

  // --- Initialization: load everything ---
  async function init() {
    await loadProfile();
    await loadCategories();
    await loadExpenses();
    populateModalCategoryOptions();
    // run monthly check AFTER profile+expenses are loaded
    await checkMonthReset();
    // open view from hash or home
    const initView = location.hash ? location.hash.slice(1) : 'home';
    showView(initView, false);
    // prefill inputs from state
    if (state.profile.salary) { inputSalary.value = state.profile.salary.amount; selectMode.value = state.profile.salary.type; }
    if (state.profile.limit) inputLimit.value = state.profile.limit;
  }

  // --- Run init ---
  init().catch(err => { console.error('init error', err); });

  // --- Expose minor utility for debug if needed ---
  window._expenseTrackerState = state;

}); // DOMContentLoaded end
