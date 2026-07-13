/* TheList — store.js: state, localStorage cache, GitHub-repo sync */
window.TL = window.TL || {};

TL.store = (() => {
  const { nowISO, debounce, b64EncodeUtf8, b64DecodeUtf8, b64EncodeBytes, toast } = TL.util;

  const SETTINGS_KEY = 'tl_settings';
  const LIB_KEY = 'tl_library';
  const LIB_PATH = 'library.json';
  const TOMBSTONE_TTL = 90 * 24 * 3600 * 1000; // purge deleted markers after 90 days

  const defaults = {
    token: '',
    dataRepo: 'Verma314/TheList-data',
    branch: 'main',
    ytKey: '',
    corsProxy: 'https://api.allorigins.win/raw?url=',
  };

  let settings = { ...defaults };
  let state = {
    items: [],          // all items incl. tombstones
    sha: null,          // sha of library.json at last pull/push
    syncStatus: 'local',// local | syncing | synced | error | dirty
    lastSync: null,
    lastError: '',
  };
  const listeners = [];

  /* ---------- settings ---------- */
  function loadSettings() {
    try { settings = { ...defaults, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) }; }
    catch { settings = { ...defaults }; }
    return settings;
  }
  function saveSettings(patch) {
    settings = { ...settings, ...patch };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
  const getSettings = () => settings;

  /* ---------- local cache ---------- */
  function loadCache() {
    try {
      const raw = JSON.parse(localStorage.getItem(LIB_KEY));
      if (raw && Array.isArray(raw.items)) {
        state.items = raw.items;
        state.sha = raw.sha || null;
      }
    } catch { /* corrupt cache: start fresh, remote copy is authoritative */ }
  }
  function saveCache() {
    try {
      localStorage.setItem(LIB_KEY, JSON.stringify({ items: state.items, sha: state.sha }));
    } catch (e) {
      toast('Local cache full — data lives in GitHub, but offline cache is partial', 'warn');
    }
  }

  /* ---------- pub/sub ---------- */
  function onChange(fn) { listeners.push(fn); }
  function emit(what = 'items') { listeners.forEach(fn => fn(what)); }

  /* ---------- GitHub API ---------- */
  function ghHeaders() {
    const h = { 'Accept': 'application/vnd.github+json' };
    if (settings.token) h['Authorization'] = 'token ' + settings.token;
    return h;
  }
  async function ghApi(path, opts = {}) {
    const res = await fetch('https://api.github.com' + path, { ...opts, headers: { ...ghHeaders(), ...(opts.headers || {}) } });
    if (!res.ok && res.status !== 404 && res.status !== 409 && res.status !== 422) {
      throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return res;
  }

  async function getRepoFile(path) {
    const res = await ghApi(`/repos/${settings.dataRepo}/contents/${path}?ref=${settings.branch}`);
    if (res.status === 404) return null;
    const j = await res.json();
    if (j.content) return { text: b64DecodeUtf8(j.content), sha: j.sha };
    // large file (>1MB): contents API omits inline content; fetch raw separately
    const raw = await ghApi(`/repos/${settings.dataRepo}/contents/${path}?ref=${settings.branch}`,
      { headers: { 'Accept': 'application/vnd.github.raw+json' } });
    return { text: await raw.text(), sha: j.sha };
  }

  async function putRepoFile(path, contentB64, message, sha) {
    const body = { message, content: contentB64, branch: settings.branch };
    if (sha) body.sha = sha;
    const res = await ghApi(`/repos/${settings.dataRepo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (res.status === 409 || res.status === 422) return { conflict: true };
    const j = await res.json();
    return { sha: j.content && j.content.sha };
  }

  /* ---------- merge (per-item, last-write-wins) ---------- */
  function mergeItems(a, b) {
    const byId = new Map();
    for (const it of a) byId.set(it.id, it);
    for (const it of b) {
      const cur = byId.get(it.id);
      if (!cur || (it.updatedAt || '') > (cur.updatedAt || '')) byId.set(it.id, it);
    }
    const cutoff = Date.now() - TOMBSTONE_TTL;
    return Array.from(byId.values()).filter(it =>
      !it.deleted || new Date(it.updatedAt || 0).getTime() > cutoff);
  }

  /* ---------- sync ---------- */
  let pushQueued = false;

  async function pull() {
    if (!settings.token) { state.syncStatus = 'local'; emit('sync'); return; }
    state.syncStatus = 'syncing'; emit('sync');
    try {
      const file = await getRepoFile(LIB_PATH);
      if (file) {
        const remote = JSON.parse(file.text);
        state.items = mergeItems(state.items, remote.items || []);
        state.sha = file.sha;
      }
      state.syncStatus = pushQueued ? 'dirty' : 'synced';
      state.lastSync = nowISO();
      saveCache();
      emit('items'); emit('sync');
    } catch (e) {
      state.syncStatus = 'error';
      state.lastError = e.message;
      emit('sync');
    }
  }

  async function push() {
    if (!settings.token) return;
    pushQueued = false;
    state.syncStatus = 'syncing'; emit('sync');
    try {
      const payload = JSON.stringify({ version: 1, updatedAt: nowISO(), items: state.items }, null, 1);
      let r = await putRepoFile(LIB_PATH, b64EncodeUtf8(payload), 'sync: ' + nowISO(), state.sha);
      if (r.conflict) {
        // another device pushed first: pull+merge, then retry once
        const file = await getRepoFile(LIB_PATH);
        if (file) {
          const remote = JSON.parse(file.text);
          state.items = mergeItems(state.items, remote.items || []);
          state.sha = file.sha;
        }
        const merged = JSON.stringify({ version: 1, updatedAt: nowISO(), items: state.items }, null, 1);
        r = await putRepoFile(LIB_PATH, b64EncodeUtf8(merged), 'sync (merged): ' + nowISO(), state.sha);
        if (r.conflict) throw new Error('sync conflict persisted after merge retry');
      }
      if (r.sha) state.sha = r.sha;
      state.syncStatus = 'synced';
      state.lastSync = nowISO();
      saveCache();
      emit('sync');
    } catch (e) {
      state.syncStatus = 'error';
      state.lastError = e.message;
      emit('sync');
    }
  }
  const schedulePush = debounce(() => push(), 2500);
  function markDirty() {
    saveCache();
    if (settings.token) {
      pushQueued = true;
      state.syncStatus = 'dirty'; emit('sync');
      schedulePush();
    }
  }

  /* ---------- extra repo files (article text, PDFs) ---------- */
  async function saveContentFile(item, text) {
    if (!settings.token) return false;
    try {
      const path = `content/${item.id}.md`;
      const existing = await getRepoFile(path).catch(() => null);
      await putRepoFile(path, b64EncodeUtf8(`# ${item.title}\n\n${item.url}\n\n---\n\n${text}`),
        'content: ' + (item.title || item.id).slice(0, 60), existing && existing.sha);
      return true;
    } catch { return false; }
  }
  async function savePdfFile(item, bytes) {
    if (!settings.token) throw new Error('Connect GitHub in Settings to save files');
    const path = `files/${item.id}.pdf`;
    const existing = await getRepoFile(path).catch(() => null);
    const r = await putRepoFile(path, b64EncodeBytes(bytes),
      'pdf: ' + (item.title || item.id).slice(0, 60), existing && existing.sha);
    if (r.conflict) throw new Error('conflict saving PDF');
    return path;
  }
  async function openRepoFile(path) {
    const res = await ghApi(`/repos/${settings.dataRepo}/contents/${path}?ref=${settings.branch}`,
      { headers: { 'Accept': 'application/vnd.github.raw+json' } });
    if (!res.ok) throw new Error('file not found in data repo');
    const blob = await res.blob();
    return URL.createObjectURL(blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' }));
  }

  /* ---------- item CRUD ---------- */
  const active = () => state.items.filter(it => !it.deleted);

  function newItem(fields) {
    const t = nowISO();
    return {
      id: TL.util.uuid(),
      type: 'other', title: '', url: '', canonicalUrl: '', domain: '',
      description: '', content: '', author: '', publishedAt: '',
      addedAt: t, updatedAt: t,
      status: 'inbox', fetchStatus: 'pending',
      queued: false, queueRank: 0,
      readingStatus: 'unread', progress: 0,
      importance: 50, tags: [], collection: '',
      notes: '', highlights: [], thumbnail: '', filePath: '', meta: {},
      ...fields,
    };
  }

  function addItems(items) {
    state.items.push(...items);
    markDirty(); emit('items');
  }
  function updateItem(id, patch) {
    const it = state.items.find(i => i.id === id);
    if (!it) return null;
    Object.assign(it, patch, { updatedAt: nowISO() });
    markDirty(); emit('items');
    return it;
  }
  // batch update without emitting per-item (for enrichment loops)
  function updateItemQuiet(id, patch) {
    const it = state.items.find(i => i.id === id);
    if (!it) return null;
    Object.assign(it, patch, { updatedAt: nowISO() });
    return it;
  }
  function flush() { markDirty(); emit('items'); }

  function deleteItem(id) {
    const it = state.items.find(i => i.id === id);
    if (!it) return;
    it.deleted = true;
    it.updatedAt = nowISO();
    markDirty(); emit('items');
  }
  const getItem = id => state.items.find(i => i.id === id && !i.deleted);

  function exportJson() {
    return JSON.stringify({ version: 1, exportedAt: nowISO(), items: active() }, null, 2);
  }
  function importJson(text) {
    const j = JSON.parse(text);
    const items = Array.isArray(j) ? j : j.items;
    if (!Array.isArray(items)) throw new Error('no items array found');
    state.items = mergeItems(state.items, items);
    markDirty(); emit('items');
    return items.length;
  }

  async function testConnection() {
    const res = await ghApi(`/repos/${settings.dataRepo}`);
    if (res.status === 404) throw new Error(`repo ${settings.dataRepo} not found (check token access)`);
    const j = await res.json();
    return `Connected to ${j.full_name} (${j.private ? 'private' : 'PUBLIC!'})`;
  }

  return {
    state, active, getItem, newItem, addItems, updateItem, updateItemQuiet, flush, deleteItem,
    loadSettings, saveSettings, getSettings,
    loadCache, saveCache, onChange,
    pull, push, markDirty,
    saveContentFile, savePdfFile, openRepoFile,
    exportJson, importJson, testConnection,
  };
})();
