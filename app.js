const storageKeys = {
  apiUrl: 'shopping_list_api_url',
  sharedSecret: 'shopping_list_shared_secret',
  autoRefresh: 'shopping_list_auto_refresh'
};

const state = {
  items: [],
  filters: {
    search: '',
    status: 'all',
    sort: 'created_desc'
  },
  autoRefreshTimer: null,
  lastLoadedAt: null
};

const els = {
  apiUrl: document.getElementById('apiUrl'),
  sharedSecret: document.getElementById('sharedSecret'),
  toggleSecretBtn: document.getElementById('toggleSecretBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  testConnectionBtn: document.getElementById('testConnectionBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  addItemForm: document.getElementById('addItemForm'),
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
  metricTotal: document.getElementById('metricTotal'),
  metricDone: document.getElementById('metricDone'),
  metricLeft: document.getElementById('metricLeft'),
  connectionChip: document.getElementById('connectionChip')
};

function getConfig() {
  return {
    apiUrl: localStorage.getItem(storageKeys.apiUrl) || '',
    sharedSecret: localStorage.getItem(storageKeys.sharedSecret) || '',
    autoRefresh: localStorage.getItem(storageKeys.autoRefresh) || '0'
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
  els.connectionChip.classList.remove('connected', 'disconnected');
  if (!hasUrl) {
    els.connectionChip.textContent = 'לא מחובר';
    return;
  }
  if (connected) {
    els.connectionChip.textContent = 'מחובר';
    els.connectionChip.classList.add('connected');
  } else {
    els.connectionChip.textContent = 'מוגדר — לא נבדק';
    els.connectionChip.classList.add('disconnected');
  }
}

function showMessage(message, isError = false) {
  els.statusMessage.textContent = message;
  els.statusMessage.classList.remove('hidden', 'error');
  if (isError) els.statusMessage.classList.add('error');
}

function hideMessage() {
  els.statusMessage.classList.add('hidden');
}

function requireApiUrl() {
  const apiUrl = (els.apiUrl.value || '').trim();
  if (!apiUrl) {
    showMessage('צריך להכניס URL של Apps Script לפני שממשיכים.', true);
    throw new Error('Missing Apps Script URL');
  }
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
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({ action, secret: sharedSecret, ...payload })
  });
  return handleResponse(response);
}

async function handleResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`תגובת שרת לא תקינה: ${text.slice(0, 200)}`);
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

function normalizeItem(item) {
  return {
    rowId: String(item.rowId),
    name: item.name || '',
    quantity: item.quantity || '',
    category: item.category || '',
    notes: item.notes || '',
    purchased: String(item.purchased).toLowerCase() === 'true',
    createdAt: item.createdAt || '',
    updatedAt: item.updatedAt || ''
  };
}

function sortItems(items) {
  const sorted = [...items];
  switch (state.filters.sort) {
    case 'created_asc':
      sorted.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      break;
    case 'category_asc':
      sorted.sort((a, b) => `${a.category}|${a.name}`.localeCompare(`${b.category}|${b.name}`, 'he'));
      break;
    case 'name_asc':
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'he'));
      break;
    case 'created_desc':
    default:
      sorted.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      break;
  }
  return sorted;
}

function getVisibleItems() {
  const search = state.filters.search.trim().toLowerCase();
  return sortItems(state.items).filter(item => {
    const matchesSearch = !search || [item.name, item.quantity, item.category, item.notes]
      .join(' ')
      .toLowerCase()
      .includes(search);

    const matchesStatus =
      state.filters.status === 'all' ||
      (state.filters.status === 'done' && item.purchased) ||
      (state.filters.status === 'active' && !item.purchased);

    return matchesSearch && matchesStatus;
  });
}

function renderItems() {
  const items = getVisibleItems();
  els.itemsList.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'אין פריטים להצגה. נסה חיפוש אחר, סינון אחר, או הוסף פריט חדש.';
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

    const notesEl = node.querySelector('.item-notes');
    if (item.notes) {
      notesEl.textContent = item.notes;
    } else {
      notesEl.remove();
    }

    const categoryEl = node.querySelector('.item-category');
    if (item.category) {
      categoryEl.textContent = item.category;
    } else {
      categoryEl.remove();
    }

    const dateText = item.updatedAt ? `עודכן: ${formatDate(item.updatedAt)}` : (item.createdAt ? `נוצר: ${formatDate(item.createdAt)}` : '');
    node.querySelector('.item-date').textContent = dateText;

    node.querySelector('.edit-btn').addEventListener('click', () => openEditDialog(item));
    node.querySelector('.delete-btn').addEventListener('click', () => deleteItem(item.rowId));

    els.itemsList.appendChild(node);
  }

  const doneCount = state.items.filter(item => item.purchased).length;
  const leftCount = state.items.length - doneCount;
  const refreshText = state.lastLoadedAt ? ` • עודכן ${formatTimeOnly(state.lastLoadedAt)}` : '';

  els.stats.textContent = `${state.items.length} פריטים • ${doneCount} נקנו • ${leftCount} נשארו${refreshText}`;
  els.metricTotal.textContent = state.items.length;
  els.metricDone.textContent = doneCount;
  els.metricLeft.textContent = leftCount;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function formatTimeOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('he-IL', { timeStyle: 'short' }).format(date);
}

async function loadItems(showSuccess = false) {
  els.loading.classList.remove('hidden');
  try {
    const data = await callApi('list', {}, 'GET');
    state.items = (data.items || []).map(normalizeItem);
    state.lastLoadedAt = new Date().toISOString();
    renderItems();
    hideMessage();
    updateConnectionChip(true, true);
    if (showSuccess) showMessage('הרשימה נטענה בהצלחה.');
  } catch (error) {
    updateConnectionChip(Boolean((els.apiUrl.value || '').trim()), false);
    showMessage(error.message, true);
  } finally {
    els.loading.classList.add('hidden');
  }
}

async function addItem(event) {
  event.preventDefault();
  const form = new FormData(els.addItemForm);
  const payload = {
    name: form.get('name'),
    quantity: form.get('quantity'),
    category: form.get('category'),
    notes: form.get('notes')
  };

  try {
    await callApi('add', payload);
    els.addItemForm.reset();
    await loadItems();
    showMessage('הפריט נוסף לרשימה.');
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function toggleItem(rowId, purchased) {
  try {
    await callApi('toggle', { rowId, purchased });
    await loadItems();
  } catch (error) {
    showMessage(error.message, true);
  }
}

function openEditDialog(item) {
  els.editRowId.value = item.rowId;
  els.editName.value = item.name;
  els.editQuantity.value = item.quantity;
  els.editCategory.value = item.category;
  els.editNotes.value = item.notes;
  els.editDialog.showModal();
}

async function saveEditedItem(event) {
  event.preventDefault();
  try {
    await callApi('update', {
      rowId: els.editRowId.value,
      name: els.editName.value,
      quantity: els.editQuantity.value,
      category: els.editCategory.value,
      notes: els.editNotes.value
    });
    els.editDialog.close();
    await loadItems();
    showMessage('הפריט עודכן.');
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function deleteItem(rowId) {
  if (!confirm('למחוק את הפריט מהרשימה?')) return;
  try {
    await callApi('delete', { rowId });
    await loadItems();
    showMessage('הפריט נמחק.');
  } catch (error) {
    showMessage(error.message, true);
  }
}

function setAutoRefresh(seconds) {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }

  if (!seconds || Number(seconds) <= 0) return;

  state.autoRefreshTimer = setInterval(() => {
    if ((els.apiUrl.value || '').trim()) loadItems();
  }, Number(seconds) * 1000);
}

function bindEvents() {
  els.toggleSecretBtn.addEventListener('click', () => {
    els.sharedSecret.type = els.sharedSecret.type === 'password' ? 'text' : 'password';
  });

  els.saveSettingsBtn.addEventListener('click', () => {
    setConfig(els.apiUrl.value, els.sharedSecret.value, els.autoRefreshSelect.value);
    updateConnectionChip(Boolean(els.apiUrl.value.trim()), false);
    showMessage('ההגדרות נשמרו בדפדפן שלך.');
    setAutoRefresh(els.autoRefreshSelect.value);
  });

  els.testConnectionBtn.addEventListener('click', async () => {
    setConfig(els.apiUrl.value, els.sharedSecret.value, els.autoRefreshSelect.value);
    setAutoRefresh(els.autoRefreshSelect.value);
    await loadItems(true);
  });

  els.refreshBtn.addEventListener('click', async () => {
    await loadItems(true);
  });

  els.autoRefreshSelect.addEventListener('change', () => {
    setConfig(els.apiUrl.value, els.sharedSecret.value, els.autoRefreshSelect.value);
    setAutoRefresh(els.autoRefreshSelect.value);
  });

  els.addItemForm.addEventListener('submit', addItem);
  els.searchInput.addEventListener('input', (event) => {
    state.filters.search = event.target.value;
    renderItems();
  });
  els.statusFilter.addEventListener('change', (event) => {
    state.filters.status = event.target.value;
    renderItems();
  });
  els.sortSelect.addEventListener('change', (event) => {
    state.filters.sort = event.target.value;
    renderItems();
  });
  els.editItemForm.addEventListener('submit', saveEditedItem);
  els.cancelEditBtn.addEventListener('click', () => els.editDialog.close());
}

function boot() {
  hydrateSettings();
  bindEvents();
  setAutoRefresh(getConfig().autoRefresh);
  if (getConfig().apiUrl) {
    loadItems();
  } else {
    els.loading.classList.add('hidden');
    showMessage('הכנס URL של Apps Script ולחץ על בדיקת חיבור כדי להתחיל.');
  }
}

boot();
