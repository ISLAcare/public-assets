const OWNER = 'ISLAcare';
const REPO = 'public-assets';
const BRANCH = 'main';
const IMAGE_DIR = 'images';
const PAGES_BASE = `https://islacare.github.io/${REPO}/${IMAGE_DIR}`;
const RAW_BASE = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${IMAGE_DIR}`;
const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}`;
const PAT_KEY = 'ic_public_assets_pat';

const $ = (id) => document.getElementById(id);

const state = {
  files: [],
  commitDates: new Map(),
};

const getToken = () => localStorage.getItem(PAT_KEY) || '';
const setToken = (token) => {
  if (token) localStorage.setItem(PAT_KEY, token);
  else localStorage.removeItem(PAT_KEY);
  renderAuthStatus();
};

const authHeaders = () => {
  const token = getToken();
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

async function ghFetch(pathAndQuery, init = {}) {
  const res = await fetch(`${API_BASE}${pathAndQuery}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body && body.message) msg = body.message;
    } catch { /* body not json */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function sanitiseName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function listImages() {
  try {
    const items = await ghFetch(`/contents/${IMAGE_DIR}?ref=${BRANCH}`);
    return Array.isArray(items)
      ? items.filter((i) => i.type === 'file' && !i.name.startsWith('.'))
      : [];
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
}

async function fetchCommitDate(path) {
  if (state.commitDates.has(path)) return state.commitDates.get(path);
  try {
    const commits = await ghFetch(
      `/commits?path=${encodeURIComponent(path)}&sha=${BRANCH}&per_page=1`
    );
    const date = commits[0]?.commit?.committer?.date || commits[0]?.commit?.author?.date || null;
    state.commitDates.set(path, date);
    return date;
  } catch {
    return null;
  }
}

async function uploadFile(file) {
  const content = await fileToBase64(file);
  const filename = uniqueName(sanitiseName(file.name));
  const path = `${IMAGE_DIR}/${filename}`;
  await ghFetch(`/contents/${encodeURIComponent(path)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Add ${filename}`,
      content,
      branch: BRANCH,
    }),
  });
  return path;
}

function uniqueName(name) {
  const existing = new Set(state.files.map((f) => f.name));
  if (!existing.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const stem = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot) : '';
  let i = 2;
  while (existing.has(`${stem}-${i}${ext}`)) i++;
  return `${stem}-${i}${ext}`;
}

async function deleteFile(item) {
  await ghFetch(`/contents/${encodeURIComponent(item.path)}`, {
    method: 'DELETE',
    body: JSON.stringify({
      message: `Delete ${item.name}`,
      sha: item.sha,
      branch: BRANCH,
    }),
  });
}

function formatMonth(date) {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function formatDay(date) {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function groupByMonth(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const d = entry.uploadedAt ? new Date(entry.uploadedAt) : null;
    const key = d ? `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}` : 'unknown';
    if (!groups.has(key)) groups.set(key, { date: d, entries: [] });
    groups.get(key).entries.push(entry);
  }
  return [...groups.entries()]
    .sort((a, b) => {
      if (!a[1].date) return 1;
      if (!b[1].date) return -1;
      return b[1].date - a[1].date;
    })
    .map(([, group]) => ({
      label: group.date ? formatMonth(group.date) : 'Unknown date',
      entries: group.entries.sort((x, y) => {
        if (!x.uploadedAt) return 1;
        if (!y.uploadedAt) return -1;
        return new Date(y.uploadedAt) - new Date(x.uploadedAt);
      }),
    }));
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pagesUrlFor(name) {
  return `${PAGES_BASE}/${encodeURIComponent(name)}`;
}

function htmlSnippetFor(name) {
  const url = pagesUrlFor(name);
  const alt = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
  return `<img src="${url}" alt="${escapeHtml(alt)}" />`;
}

function renderGallery() {
  const galleryEl = $('gallery');
  const emptyEl = $('gallery-empty');
  const loadingEl = $('gallery-loading');
  const errorEl = $('gallery-error');

  loadingEl.classList.add('hidden');
  errorEl.classList.add('hidden');

  if (state.files.length === 0) {
    galleryEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  galleryEl.classList.remove('hidden');

  const grouped = groupByMonth(state.files);
  galleryEl.innerHTML = grouped
    .map(
      (group) => `
        <div>
          <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">${escapeHtml(group.label)}</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            ${group.entries.map(renderCard).join('')}
          </div>
        </div>
      `
    )
    .join('');

  galleryEl.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', onCardAction);
  });
}

function renderCard(entry) {
  const rawUrl = `${RAW_BASE}/${encodeURIComponent(entry.name)}`;
  const dateLabel = entry.uploadedAt ? formatDay(new Date(entry.uploadedAt)) : 'Unknown date';
  return `
    <div class="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
      <div class="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
        <img
          src="${escapeHtml(rawUrl)}"
          alt="${escapeHtml(entry.name)}"
          loading="lazy"
          class="max-h-full max-w-full object-contain"
        />
      </div>
      <div class="p-3 flex flex-col gap-2 flex-1">
        <div class="min-w-0">
          <p class="text-sm font-medium text-slate-900 truncate" title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</p>
          <p class="text-xs text-slate-500">${escapeHtml(dateLabel)}</p>
        </div>
        <div class="flex gap-1.5 mt-auto flex-wrap">
          <button
            data-action="copy-url"
            data-name="${escapeHtml(entry.name)}"
            class="flex-1 min-w-0 text-xs rounded-md border border-slate-300 bg-white px-2 py-1.5 hover:bg-slate-50"
          >
            Copy URL
          </button>
          <button
            data-action="copy-html"
            data-name="${escapeHtml(entry.name)}"
            class="flex-1 min-w-0 text-xs rounded-md border border-slate-300 bg-white px-2 py-1.5 hover:bg-slate-50"
          >
            Copy HTML
          </button>
          <button
            data-action="delete"
            data-name="${escapeHtml(entry.name)}"
            data-sha="${escapeHtml(entry.sha)}"
            data-path="${escapeHtml(entry.path)}"
            class="text-xs rounded-md border border-red-300 text-red-600 bg-white px-2 py-1.5 hover:bg-red-50"
            title="Delete image"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  `;
}

async function onCardAction(event) {
  const btn = event.currentTarget;
  const action = btn.dataset.action;
  const name = btn.dataset.name;

  if (action === 'copy-url') {
    await copyToClipboard(pagesUrlFor(name));
    toast(`Copied URL for ${name}`);
    return;
  }
  if (action === 'copy-html') {
    await copyToClipboard(htmlSnippetFor(name));
    toast(`Copied HTML for ${name}`);
    return;
  }
  if (action === 'delete') {
    if (!getToken()) {
      toast('Add a token in Settings to delete', 'error');
      return;
    }
    const confirmed = await confirmDialog(`Delete ${name}? URLs pointing at it will 404 immediately.`);
    if (!confirmed) return;
    try {
      await deleteFile({ name, sha: btn.dataset.sha, path: btn.dataset.path });
      toast(`Deleted ${name}`);
      state.commitDates.delete(btn.dataset.path);
      await refresh();
    } catch (err) {
      toast(`Failed to delete: ${err.message}`, 'error');
    }
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function toast(message, variant = 'success') {
  const el = document.createElement('div');
  const bg = variant === 'error' ? 'bg-red-600' : 'bg-slate-900';
  el.className = `${bg} text-white text-sm px-3 py-2 rounded-md shadow-lg toast-enter`;
  el.textContent = message;
  $('toast-container').appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 200ms';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }, 2500);
}

function confirmDialog(message) {
  return new Promise((resolve) => {
    const modal = $('confirm-modal');
    $('confirm-message').textContent = message;
    modal.style.display = 'flex';
    const cleanup = () => {
      modal.style.display = 'none';
      $('confirm-ok').removeEventListener('click', onOk);
      $('confirm-cancel').removeEventListener('click', onCancel);
    };
    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    $('confirm-ok').addEventListener('click', onOk);
    $('confirm-cancel').addEventListener('click', onCancel);
  });
}

function renderAuthStatus() {
  const el = $('auth-status');
  if (getToken()) {
    el.textContent = 'Signed in';
    el.className = 'text-sm text-green-600';
  } else {
    el.textContent = 'Read-only';
    el.className = 'text-sm text-amber-600';
  }
}

async function refresh() {
  const galleryEl = $('gallery');
  const loadingEl = $('gallery-loading');
  const errorEl = $('gallery-error');
  galleryEl.classList.add('hidden');
  loadingEl.classList.remove('hidden');
  errorEl.classList.add('hidden');

  try {
    const files = await listImages();
    const withDates = await Promise.all(
      files.map(async (f) => ({
        name: f.name,
        path: f.path,
        sha: f.sha,
        size: f.size,
        uploadedAt: await fetchCommitDate(f.path),
      }))
    );
    state.files = withDates;
    renderGallery();
  } catch (err) {
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    errorEl.textContent = `Failed to load gallery: ${err.message}`;
  }
}

async function handleFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/'));
  if (files.length === 0) {
    toast('Only image files are supported', 'error');
    return;
  }
  if (!getToken()) {
    toast('Add a token in Settings before uploading', 'error');
    $('settings-modal').style.display = 'flex';
    return;
  }
  const progressEl = $('upload-progress');
  progressEl.innerHTML = '';

  for (const file of files) {
    if (file.size > 100 * 1024 * 1024) {
      toast(`${file.name} is over 100 MB and cannot be uploaded`, 'error');
      continue;
    }
    const row = document.createElement('div');
    row.className = 'text-sm text-slate-600 flex items-center gap-2';
    row.innerHTML = `
      <svg class="animate-spin h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      <span>Uploading ${escapeHtml(file.name)}&hellip;</span>
    `;
    progressEl.appendChild(row);
    try {
      await uploadFile(file);
      row.innerHTML = `<span class="text-green-600">Uploaded ${escapeHtml(file.name)}</span>`;
    } catch (err) {
      row.innerHTML = `<span class="text-red-600">Failed ${escapeHtml(file.name)}: ${escapeHtml(err.message)}</span>`;
    }
  }
  setTimeout(() => (progressEl.innerHTML = ''), 4000);
  await refresh();
}

function bindDropZone() {
  const dz = $('drop-zone');
  const input = $('file-input');
  dz.addEventListener('click', () => input.click());
  dz.addEventListener('dragover', (e) => {
    e.preventDefault();
    dz.classList.add('dragover');
  });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('dragover');
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  });
  input.addEventListener('change', (e) => {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = '';
  });
}

function bindSettings() {
  const modal = $('settings-modal');
  const open = () => {
    $('pat-input').value = getToken();
    modal.style.display = 'flex';
  };
  const close = () => (modal.style.display = 'none');
  $('settings-btn').addEventListener('click', open);
  $('settings-close').addEventListener('click', close);
  $('pat-save').addEventListener('click', async () => {
    const token = $('pat-input').value.trim();
    setToken(token);
    close();
    toast(token ? 'Token saved' : 'Token cleared');
    await refresh();
  });
  $('pat-clear').addEventListener('click', () => {
    $('pat-input').value = '';
    setToken('');
    toast('Token cleared');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
}

function init() {
  renderAuthStatus();
  bindDropZone();
  bindSettings();
  $('refresh-btn').addEventListener('click', refresh);
  refresh();
}

init();
