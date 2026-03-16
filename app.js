const storageKeys = {
  apiUrl: 'shopping_list_api_url',
  sharedSecret: 'shopping_list_shared_secret',
  autoRefresh: 'shopping_list_auto_refresh'
};

const state = {
  items: [],
  filters: { search: '', status: 'all', sort: 'created_desc' },
  syncTimer: null,
  lastLoadedAt: null,
  remoteVersion: '',
  syncing: false,
  activeTab: 'list',
  lists: [],
  currentListId: null
};

const els = {
  apiUrl: document.getElementById('apiUrl'),
  sharedSecret: document.getElementById('sharedSecret'),
  toggleSecretBtn: document.getElementById('toggleSecretBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  testConnectionBtn: document.getElementById('testConnectionBtn'),
  addItemForm: document.getElementById('addItemForm'),
  addDialog: document.getElementById('addDialog'),
  openAddDialogBtn: document.getElementById('openAddDialogBtn'),
  openAddDialogBtnTab: document.getElementById('openAddDialogBtnTab'),
  closeAddDialogBtn: document.getElementById('closeAddDialogBtn'),
  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  sortSelect: document.getElementById('sortSelect'),
  autoRefreshSelect: document.getElementById('autoRefreshSelect'),
  itemsList: document.getElementById('itemsList'),
  itemTemplate: document.getElementById('itemTemplate'),
  loading: document.getElementById('loading'),
  stats: document.getElementById('stats'),
  statusMessage: document.getElementById('statusMessage'),
  editDialog: document.getElementById('editDialog'),
  editItemForm: document.getElementById('editItemForm'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),
  editRowId: document.getElementById('editRowId'),
  editName: document.getElementById('editName'),
  editQuantity: document.getElementById('editQuantity'),
  editCategory: document.getElementById('editCategory'),
  editNotes: document.getElementById('editNotes'),
  editPrice: document.getElementById('editPrice'),
  editImage: document.getElementById('editImage'),
  metricTotal: document.getElementById('metricTotal'),
  metricDone: document.getElementById('metricDone'),
  metricLeft: document.getElementById('metricLeft'),
  connectionChip: document.getElementById('connectionChip'),
  connectionChipMirror: document.getElementById('connectionChipMirror'),
  syncChip: document.getElementById('syncChip'),
  navBtns: [...document.querySelectorAll('.nav-btn')],
  tabPanels: [...document.querySelectorAll('.tab-panel')],
  hamburgerBtn: document.getElementById('hamburgerBtn'),
  sidemenu: document.getElementById('sidemenu'),
  closeSidemenuBtn: document.getElementById('closeSidemenuBtn'),
  appBackdrop: document.getElementById('appBackdrop'),
  listsList: document.getElementById('listsList'),
  addListBtn: document.getElementById('addListBtn'),
  searchProductBtn: document.getElementById('searchProductBtn'),
  currentListName: document.getElementById('currentListName')
};

function getConfig() {
  return {
    apiUrl: localStorage.getItem(storageKeys.apiUrl) || '',
    sharedSecret: localStorage.getItem(storageKeys.sharedSecret) || '',
    autoRefresh: localStorage.getItem(storageKeys.autoRefresh) || '5'
  };
}
function setConfig(apiUrl, sharedSecret, autoRefresh) {
  localStorage.setItem(storageKeys.apiUrl, apiUrl.trim());
  localStorage.setItem(storageKeys.sharedSecret, sharedSecret);
  if (autoRefresh !== undefined) localStorage.setItem(storageKeys.autoRefresh, String(autoRefresh));
}
function hydrateSettings() {
  const config = getConfig();
  els.apiUrl.value = config.apiUrl;
  els.sharedSecret.value = config.sharedSecret;
  els.autoRefreshSelect.value = config.autoRefresh;
  updateConnectionChip(Boolean(config.apiUrl), false);
}
function updateConnectionChip(hasUrl, connected) {
  [els.connectionChip, els.connectionChipMirror].forEach(chip => {
    chip.classList.remove('connected', 'disconnected');
    if (!hasUrl) chip.textContent = 'לא מחובר';
    else if (connected) {
      chip.textContent = 'מחובר';
      chip.classList.add('connected');
    } else {
      chip.textContent = 'מוגדר';
      chip.classList.add('disconnected');
    }
  });
}
function setSyncChip(text, mode='disconnected') {
  els.syncChip.textContent = text;
  els.syncChip.classList.remove('connected', 'disconnected');
  if (mode) els.syncChip.classList.add(mode);
}
function showMessage(message, isError = false) {
  els.statusMessage.textContent = message;
  els.statusMessage.classList.remove('hidden', 'error');
  if (isError) els.statusMessage.classList.add('error');
}
function hideMessage() { els.statusMessage.classList.add('hidden'); }
function requireApiUrl() {
  const apiUrl = (els.apiUrl.value || '').trim();
  if (!apiUrl) throw new Error('צריך להכניס URL של Apps Script לפני שממשיכים.');
  return apiUrl;
}

async function callApi(action, payload = {}, method = 'POST') {
  const apiUrl = requireApiUrl();
  const sharedSecret = els.sharedSecret.value || '';
  if (method === 'GET') {
    const url = new URL(apiUrl);
    url.searchParams.set('action', action);
    if (sharedSecret) url.searchParams.set('secret', sharedSecret);
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    }
    const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
    return handleResponse(response);
  }
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, secret: sharedSecret, ...payload })
  });
  return handleResponse(response);
}
async function handleResponse(response) {
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`תגובת שרת לא תקינה: ${text.slice(0, 200)}`); }
  if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed with status ${response.status}`);
  return data;
}
function normalizeItem(item) {
  return {
    rowId: String(item.rowId), name: item.name || '', quantity: item.quantity || '',
    category: item.category || '', notes: item.notes || '', price: item.price || '',
    image: item.image || '',
    purchased: String(item.purchased).toLowerCase() === 'true',
    createdAt: item.createdAt || '', updatedAt: item.updatedAt || ''
  };
}
function sortItems(items) {
  const sorted = [...items];
  switch (state.filters.sort) {
    case 'created_asc': sorted.sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||'')); break;
    case 'category_asc': sorted.sort((a,b)=>`${a.category}|${a.name}`.localeCompare(`${b.category}|${b.name}`,'he')); break;
    case 'name_asc': sorted.sort((a,b)=>a.name.localeCompare(b.name,'he')); break;
    default: sorted.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  }
  return sorted;
}
function getVisibleItems() {
  const search = state.filters.search.trim().toLowerCase();
  return sortItems(state.items).filter(item => {
    const matchesSearch = !search || [item.name,item.quantity,item.category,item.notes].join(' ').toLowerCase().includes(search);
    const matchesStatus = state.filters.status === 'all' || (state.filters.status==='done' && item.purchased) || (state.filters.status==='active' && !item.purchased);
    return matchesSearch && matchesStatus;
  });
}
function renderItems() {
  const items = getVisibleItems();
  els.itemsList.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'אין פריטים להצגה.';
    els.itemsList.appendChild(empty);
  }
  for (const item of items) {
    const node = els.itemTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.rowId = item.rowId;
    if (item.purchased) node.classList.add('done');
    const checkbox = node.querySelector('.toggle-item');
    checkbox.checked = item.purchased;
    checkbox.addEventListener('change', () => toggleItem(item.rowId, checkbox.checked));
    node.querySelector('.item-name').textContent = item.name;
    node.querySelector('.item-quantity').textContent = `כמות: ${item.quantity || '-'}`;
    const priceEl = node.querySelector('.item-price');
    if (item.price) {
      priceEl.textContent = `₪${item.price}`;
      priceEl.style.display = 'inline-flex';
    } else {
      priceEl.style.display = 'none';
    }
    const imageEl = node.querySelector('.item-image');
    if (item.image) {
      imageEl.src = item.image;
      imageEl.style.display = 'block';
    } else {
      imageEl.style.display = 'none';
    }
    const notesEl = node.querySelector('.item-notes');
    if (item.notes) notesEl.textContent = item.notes; else notesEl.remove();
    const categoryEl = node.querySelector('.item-category');
    if (item.category) categoryEl.textContent = item.category; else categoryEl.remove();
    node.querySelector('.item-date').textContent = item.updatedAt ? `עודכן: ${formatDate(item.updatedAt)}` : '';
    node.querySelector('.edit-btn').addEventListener('click', () => openEditDialog(item));
    node.querySelector('.delete-btn').addEventListener('click', () => deleteItem(item.rowId));
    els.itemsList.appendChild(node);
  }
  const doneCount = state.items.filter(item => item.purchased).length;
  const leftCount = state.items.length - doneCount;
  const refreshText = state.lastLoadedAt ? ` • נטען ${formatTimeOnly(state.lastLoadedAt)}` : '';
  els.stats.textContent = `${state.items.length} פריטים • ${doneCount} נקנו • ${leftCount} נשארו${refreshText}`;
  els.metricTotal.textContent = state.items.length;
  els.metricDone.textContent = doneCount;
  els.metricLeft.textContent = leftCount;
}
function formatDate(value) {
  const date = new Date(value); if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('he-IL',{dateStyle:'short',timeStyle:'short'}).format(date);
}
function formatTimeOnly(value) {
  const date = new Date(value); if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('he-IL',{timeStyle:'short'}).format(date);
}
async function loadItems(showSuccess = false, {silent=false} = {}) {
  if (!silent) els.loading.classList.remove('hidden');
  try {
    const data = await callApi('list', { listId: state.currentListId }, 'GET');
    state.items = (data.items || []).map(normalizeItem);
    state.remoteVersion = data.version || state.remoteVersion;
    state.lastLoadedAt = new Date().toISOString();
    renderItems();
    hideMessage();
    updateConnectionChip(true, true);
    setSyncChip('מסונכרן', 'connected');
    if (showSuccess) showMessage('הרשימה נטענה בהצלחה.');
  } catch (error) {
    updateConnectionChip(Boolean((els.apiUrl.value || '').trim()), false);
    setSyncChip('שגיאת סנכרון', 'disconnected');
    showMessage(error.message, true);
  } finally {
    els.loading.classList.add('hidden');
  }
}
async function checkVersionAndSync() {
  if (document.hidden || !(els.apiUrl.value || '').trim() || state.syncing) return;
  state.syncing = true;
  try {
    const data = await callApi('version', {}, 'GET');
    if (data.version && state.remoteVersion && data.version !== state.remoteVersion) {
      setSyncChip('נמצא שינוי', 'disconnected');
      await loadItems(false, {silent:true});
    } else {
      state.remoteVersion = data.version || state.remoteVersion;
      setSyncChip('אין שינוי חדש', 'connected');
    }
  } catch {
    setSyncChip('בדיקת שינוי נכשלה', 'disconnected');
  } finally {
    state.syncing = false;
  }
}
function optimisticSet(rowId, patch) {
  state.items = state.items.map(item => item.rowId === rowId ? {...item, ...patch, updatedAt:new Date().toISOString()} : item);
  renderItems();
}
async function addItem(event) {
  event.preventDefault();
  const form = new FormData(els.addItemForm);
  const payload = { 
    listId: state.currentListId,
    name: form.get('name'), 
    quantity: form.get('quantity'), 
    category: form.get('category'), 
    notes: form.get('notes'),
    price: form.get('price'),
    image: form.get('image')
  };
  try {
    setSyncChip('מוסיף...', 'disconnected');
    await callApi('add', payload);
    els.addItemForm.reset();
    await loadItems();
    showMessage('הפריט נוסף לרשימה.');
  } catch (error) { showMessage(error.message, true); }
}
async function toggleItem(rowId, purchased) {
  const previous = state.items.find(i=>i.rowId===rowId)?.purchased;
  optimisticSet(rowId, { purchased });
  try {
    setSyncChip('שומר...', 'disconnected');
    const data = await callApi('toggle', { rowId, purchased });
    if (data.version) state.remoteVersion = data.version;
    setSyncChip('נשמר', 'connected');
  } catch (error) {
    optimisticSet(rowId, { purchased: previous });
    showMessage(error.message, true);
  }
}
function openEditDialog(item) {
  els.editRowId.value = item.rowId; 
  els.editName.value = item.name; 
  els.editQuantity.value = item.quantity; 
  els.editCategory.value = item.category; 
  els.editNotes.value = item.notes; 
  els.editPrice.value = item.price;
  els.editImage.value = item.image;
  els.editDialog.showModal();
}
async function saveEditedItem(event) {
  event.preventDefault();
  const patch = { 
    rowId: els.editRowId.value, 
    name: els.editName.value, 
    quantity: els.editQuantity.value, 
    category: els.editCategory.value, 
    notes: els.editNotes.value,
    price: els.editPrice.value,
    image: els.editImage.value
  };
  const prev = state.items.find(i=>i.rowId===patch.rowId);
  optimisticSet(patch.rowId, patch);
  try {
    const data = await callApi('update', patch);
    if (data.version) state.remoteVersion = data.version;
    els.editDialog.close();
    setSyncChip('נשמר', 'connected');
  } catch (error) {
    if (prev) optimisticSet(prev.rowId, prev);
    showMessage(error.message, true);
  }
}
async function deleteItem(rowId) {
  if (!confirm('למחוק את הפריט מהרשימה?')) return;
  const prev = [...state.items];
  state.items = state.items.filter(i=>i.rowId !== rowId); renderItems();
  try {
    const data = await callApi('delete', { rowId });
    if (data.version) state.remoteVersion = data.version;
    setSyncChip('נמחק', 'connected');
  } catch (error) {
    state.items = prev; renderItems(); showMessage(error.message, true);
  }
}
function setAutoRefresh(seconds) {
  if (state.syncTimer) clearInterval(state.syncTimer);
  state.syncTimer = null;
  const sec = Number(seconds);
  if (!sec || sec <= 0) { setSyncChip('בדיקת שינוי כבויה', 'disconnected'); return; }
  setSyncChip(`בדיקה כל ${sec}ש׳`, 'connected');
  state.syncTimer = setInterval(checkVersionAndSync, sec * 1000);
}
function switchTab(tab) {
  state.activeTab = tab;
  els.navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.targetTab === tab));
  els.tabPanels.forEach(panel => panel.classList.toggle('active', panel.dataset.tab === tab));
}

async function loadLists() {
  try {
    const data = await callApi('getLists', {}, 'GET');
    state.lists = data.lists || [];
    if (!state.lists.length) {
      // Create default list
      await createList({ name: 'רשימת קניות' });
      await loadLists();
    }
    if (!state.currentListId && state.lists.length) {
      state.currentListId = state.lists[0].id;
    }
    renderLists();
  } catch (error) {
    showMessage('שגיאה בטעינת רשימות: ' + error.message, true);
  }
}

function renderLists() {
  els.listsList.innerHTML = '';
  state.lists.forEach(list => {
    const li = document.createElement('li');
    li.textContent = list.name;
    li.dataset.listId = list.id;
    if (list.id == state.currentListId) li.classList.add('active');
    li.addEventListener('click', () => switchList(list.id));
    els.listsList.appendChild(li);
  });
  const currentList = state.lists.find(l => l.id == state.currentListId);
  els.currentListName.textContent = currentList ? currentList.name : '';
}

async function switchList(listId) {
  state.currentListId = listId;
  renderLists();
  await loadItems();
}

async function createList(payload) {
  try {
    const data = await callApi('createList', payload);
    await loadLists();
    showMessage('רשימה נוצרה.');
  } catch (error) {
    showMessage(error.message, true);
  }
}

function toggleSidemenu() {
  const isOpen = els.sidemenu.classList.toggle('open');
  els.appBackdrop.classList.toggle('open', isOpen);
}

async function fetchProductData(name) {
  try {
    const response = await fetch(`https://api.shufersal.co.il/v1/products?q=${encodeURIComponent(name)}`);
    const data = await response.json();
    if (data.products && data.products.length) {
      const product = data.products[0];
      return { price: product.price, image: product.image };
    }
  } catch (error) {
    console.log('Error fetching product data:', error);
  }
  return null;
}
function bindEvents() {
  els.toggleSecretBtn.addEventListener('click', () => { els.sharedSecret.type = els.sharedSecret.type === 'password' ? 'text' : 'password'; });
  els.saveSettingsBtn.addEventListener('click', () => {
    setConfig(els.apiUrl.value, els.sharedSecret.value, els.autoRefreshSelect.value);
    updateConnectionChip(Boolean(els.apiUrl.value.trim()), false);
    setAutoRefresh(els.autoRefreshSelect.value);
    showMessage('ההגדרות נשמרו בדפדפן שלך.');
  });
  els.testConnectionBtn.addEventListener('click', async () => { 
    setConfig(els.apiUrl.value, els.sharedSecret.value, els.autoRefreshSelect.value); 
    setAutoRefresh(els.autoRefreshSelect.value); 
    await loadLists();
    await loadItems(true); 
  });
  els.autoRefreshSelect.addEventListener('change', () => { 
    setConfig(els.apiUrl.value, els.sharedSecret.value, els.autoRefreshSelect.value); 
    setAutoRefresh(els.autoRefreshSelect.value); 
  });
  els.addItemForm.addEventListener('submit', async (e) => {
    await addItem(e);
    if (els.addDialog && typeof els.addDialog.close === 'function') els.addDialog.close();
  });
  if (els.openAddDialogBtn) els.openAddDialogBtn.addEventListener('click', () => els.addDialog?.showModal());
  if (els.openAddDialogBtnTab) els.openAddDialogBtnTab.addEventListener('click', () => els.addDialog?.showModal());
  if (els.closeAddDialogBtn) els.closeAddDialogBtn.addEventListener('click', () => els.addDialog?.close());
  els.searchInput.addEventListener('input', e => { state.filters.search = e.target.value; renderItems(); });
  els.statusFilter.addEventListener('change', e => { state.filters.status = e.target.value; renderItems(); });
  els.sortSelect.addEventListener('change', e => { state.filters.sort = e.target.value; renderItems(); });
  els.editItemForm.addEventListener('submit', saveEditedItem);
  els.cancelEditBtn.addEventListener('click', () => els.editDialog.close());
  els.navBtns.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.targetTab)));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersionAndSync(); });
  // New events
  els.hamburgerBtn.addEventListener('click', toggleSidemenu);
  els.closeSidemenuBtn.addEventListener('click', toggleSidemenu);
  els.appBackdrop.addEventListener('click', toggleSidemenu);
  els.addListBtn.addEventListener('click', () => {
    const name = prompt('שם הרשימה החדשה:');
    if (name) createList({ name });
  });
  els.searchProductBtn.addEventListener('click', async () => {
    const name = els.addItemForm.querySelector('[name="name"]').value;
    if (!name) return;
    const data = await fetchProductData(name);
    if (data) {
      els.addItemForm.querySelector('[name="price"]').value = data.price;
      els.addItemForm.querySelector('[name="image"]').value = data.image;
      showMessage('נתונים נטענו מרמי לוי.');
    } else {
      showMessage('לא נמצאו נתונים.', true);
    }
  });
}
function boot() {
  hydrateSettings(); bindEvents(); switchTab('list'); setAutoRefresh(getConfig().autoRefresh || '5');
  if (getConfig().apiUrl) {
    loadLists().then(() => loadItems());
  } else { 
    els.loading.classList.add('hidden'); 
    showMessage('הכנס URL של Apps Script ולחץ על בדיקת חיבור כדי להתחיל.'); 
  }
}

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  // Unregister all old service workers first
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister();
    });
  });
  
  // Then register the new one
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=3')
      .then(registration => {
        console.log('Service Worker registered successfully:', registration.scope);
      })
      .catch(error => {
        console.log('Service Worker registration failed:', error);
      });
  });
}

boot();
