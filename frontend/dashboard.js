// dashboard.js -- fully functional, Vercel-ready, combined with requested fixes

document.addEventListener('DOMContentLoaded', () => {
  const API = '/api'; // ✅ changed from localhost to relative API path
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

  // --- State ---
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

  function persistState(){
    localStorage.setItem('categories', JSON.stringify(state.categories));
    localStorage.setItem('expenses', JSON.stringify(state.expenses));
    if(state.profile.salary) localStorage.setItem('profile_salary', JSON.stringify(state.profile.salary));
    localStorage.setItem('profile_limit', String(state.profile.limit || 0));
    localStorage.setItem('profile_name', state.profile.name || '');
    localStorage.setItem('profile_email', state.profile.email || '');
    localStorage.setItem('profile_saved', String(state.profile.savedAmount || 0));
    if(state.profile.lastSavedMonth) localStorage.setItem('profile_lastSavedMonth', state.profile.lastSavedMonth);
  }

  function showToast(msg, ms=3000){
    if(!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.display='block';
    toastEl.style.opacity='1';
    clearTimeout(toastEl._t);
    toastEl._t=setTimeout(()=>{ toastEl.style.opacity='0'; setTimeout(()=>toastEl.style.display='none',220); }, ms);
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>'"]/g, k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[k])); }
  function capitalize(s){ return s? s[0].toUpperCase()+s.slice(1):''; }
  function formatCurrency(n){ if(typeof n!=='number') n=Number(n)||0; return n.toLocaleString(); }
  function getWeek(d){ d=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const dayNum=d.getUTCDay()||7; d.setUTCDate(d.getUTCDate()+4-dayNum); const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1)); return {year:d.getUTCFullYear(), week:String(Math.ceil((((d-yearStart)/86400000)+1)/7)).padStart(2,'0')}; }

  // --- Navigation ---
  function showView(name,push=true){
    Object.values(views).forEach(v=>v&&v.classList.remove('active'));
    if(!views[name]) name='home';
    views[name].classList.add('active');
    if(push) history.pushState({view:name},'', '#'+name);
    if(name==='about') renderExpensesTables();
    if(name==='savings') showSavings('daily');
    if(name==='profile') renderProfile();
  }
  window.addEventListener('popstate', ()=>{ showView(location.hash?location.hash.slice(1):'home', false); });
  navHome.addEventListener('click', ()=> showView('home'));
  navAbout.addEventListener('click', ()=> showView('about'));
  navSavings.addEventListener('click', ()=> showView('savings'));
  navProfile.addEventListener('click', ()=> showView('profile'));
  btnLogout.addEventListener('click', ()=>{ localStorage.removeItem('token'); window.location.href='login.html'; });

  function updateProfileUI(){
    const salary = state.profile.salary? Number(state.profile.salary.amount) : 0;
    const totalExpenses = state.expenses.reduce((s,e)=> s + (e.type==='expense'?Number(e.amount):0),0);
    const remaining = salary - totalExpenses;
    dispSalary.textContent = salary? formatCurrency(salary)+' ('+(state.profile.salary?.type||'-')+')' : '-';
    dispRemaining.textContent = formatCurrency(remaining);
    dispLimit.textContent = state.profile.limit? formatCurrency(state.profile.limit) : '-';

    if(profileNameEl) profileNameEl.textContent = state.profile.name||'User';
    if(profileEmailEl) profileEmailEl.textContent = state.profile.email||'Not provided';
    if(profileSalaryEl) profileSalaryEl.textContent = salary? formatCurrency(salary) : '-';
    if(profileModeEl) profileModeEl.textContent = state.profile.salary?.type || '-';
    if(profileSavedEl) profileSavedEl.textContent = formatCurrency(state.profile.savedAmount || 0);

    if(state.profile.limit && totalExpenses > state.profile.limit) showToast('Warning: You have exceeded your set limit!');
  }

  function renderProfile(){ updateProfileUI(); }

  editProfileBtn.addEventListener('click', ()=> {
    const newName = prompt('Enter your name', state.profile.name || '');
    const newEmail = prompt('Enter your email', state.profile.email || '');
    if(newName) state.profile.name=newName;
    if(newEmail) state.profile.email=newEmail;
    persistState(); renderProfile(); showToast('Profile updated locally');
  });

  // --- Modal ---
  function openModal(category='', type='expense', title='Add Expense', editIdx=null){
    modalTitle.textContent = title;
    modalCategory.value = category||state.categories[0]||'';
    modalAmount.value='';
    modalType.value=type;
    modalOverlay.classList.add('show');
    modalSave.onclick = ()=> saveModalExpense(editIdx);
  }
  function closeModal(){ modalOverlay.classList.remove('show'); }
  modalCancel.addEventListener('click', closeModal);

  function saveModalExpense(editIdx=null){
    const amt = Number(modalAmount.value||0);
    if(amt<=0){ showToast('Enter a valid amount'); return; }
    const newExpense = { category: modalCategory.value, amount: amt, type: modalType.value, date: new Date().toISOString() };
    if(editIdx!==null){ state.expenses[editIdx]=newExpense; showToast('Expense updated'); }
    else { state.expenses.push(newExpense); showToast('Expense added'); }
    persistState(); renderExpensesTables(); renderCategories(); closeModal(); updateProfileUI();
  }

  // --- Categories ---
  function renderCategories(){
    categoriesContainer.innerHTML='';
    state.categories.forEach(cat=>{
      const div=document.createElement('div');
      div.className='category-container';
      const nameSpan=document.createElement('span'); nameSpan.className='cat-name'; nameSpan.textContent=capitalize(cat);
      const expenseSpan=document.createElement('span'); expenseSpan.className='cat-expense';
      const totalCat=state.expenses.filter(e=>e.category===cat && e.type==='expense').reduce((s,e)=>s+Number(e.amount),0);
      expenseSpan.textContent=formatCurrency(totalCat);
      const addBtn=document.createElement('button'); addBtn.className='cat-add'; addBtn.textContent='Add';
      addBtn.onclick=()=> openModal(cat,'expense','Add Expense');

      div.appendChild(nameSpan);
      div.appendChild(expenseSpan);
      div.appendChild(addBtn);
      categoriesContainer.appendChild(div);
    });
    renderModalCategories();
  }
  function renderModalCategories(){
    modalCategory.innerHTML='';
    state.categories.forEach(c=>{
      const opt=document.createElement('option'); opt.value=c; opt.textContent=capitalize(c);
      modalCategory.appendChild(opt);
    });
  }
  addCatBtn.addEventListener('click', ()=>{
    const val=customCatInput.value.trim();
    if(val && !state.categories.includes(val)){
      state.categories.push(val); customCatInput.value=''; persistState(); renderCategories(); showToast('Category added');
    }
  });

  // --- Expenses Tables ---
  function renderExpensesTables(){
    expensesBody.innerHTML=''; aboutExpensesBody.innerHTML='';
    state.expenses.forEach((e,idx)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${escapeHtml(e.category)}</td><td>${formatCurrency(e.amount)}</td><td>${escapeHtml(e.type)}</td><td>${new Date(e.date).toLocaleString()}</td>
      <td><div class="cat-buttons">
      <button class="btn btn-sm" onclick="editExpense(${idx})">Edit</button>
      <button class="btn btn-sm" onclick="deleteExpense(${idx})">Delete</button></div></td>`;
      expensesBody.appendChild(tr);
      const tr2=tr.cloneNode(true); aboutExpensesBody.appendChild(tr2);
    });
  }
  window.editExpense = function(idx){ const e=state.expenses[idx]; if(!e) return; openModal(e.category,e.type,'Edit Expense', idx); };
  window.deleteExpense = function(idx){ if(confirm('Are you sure to delete this expense?')){ state.expenses.splice(idx,1); persistState(); renderExpensesTables(); renderCategories(); showToast('Expense deleted'); updateProfileUI(); } };
  btnAdd.addEventListener('click', ()=> openModal('', 'expense', 'Add Expense'));

  // --- Salary/Limit ---
  btnSaveSalary.addEventListener('click', ()=>{
    const val=Number(inputSalary.value||0);
    if(val<=0){ showToast('Enter a valid salary'); return; }
    state.profile.salary={amount:val,type:selectMode.value}; persistState(); updateProfileUI(); showToast('Salary saved');
  });

  btnSaveLimit.addEventListener('click', ()=>{
    const val=Number(inputLimit.value||0);
    state.profile.limit=val; persistState(); updateProfileUI(); showToast('Limit saved');
  });

  // --- Savings ---
  function showSavings(period){
    const now=new Date();
    const filtered=state.expenses.filter(e=>{
      const d=new Date(e.date);
      if(period==='daily') return d.toDateString()===now.toDateString();
      if(period==='weekly'){ const w1=getWeek(now), w2=getWeek(d); return w1.year===w2.year && w1.week===w2.week; }
      if(period==='monthly') return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
      if(period==='yearly') return d.getFullYear()===now.getFullYear();
      return false;
    });
    let html='<table><thead><tr><th>Category</th><th>Amount</th><th>Type</th></tr></thead><tbody>';
    filtered.forEach(e=> html+=`<tr><td>${escapeHtml(e.category)}</td><td>${formatCurrency(e.amount)}</td><td>${escapeHtml(e.type)}</td></tr>`);
    html+='</tbody></table>';
    savingsContent.innerHTML=html;
  }
  timeButtons.forEach(b=>{
    b.addEventListener('click',()=> showSavings(b.dataset.period));
    b.classList.add('btn'); // match Add/Save style
  });

  // --- Monthly auto-save ---
  const thisMonth=new Date().getMonth();
  if(state.profile.lastSavedMonth!==String(thisMonth)){ state.profile.savedAmount=0; state.profile.lastSavedMonth=String(thisMonth); persistState(); }

  // --- Initialize ---
  renderCategories();
  renderExpensesTables();
  updateProfileUI();
  showView(location.hash?location.hash.slice(1):'home',false);
});


