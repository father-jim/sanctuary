import { buildLetter, mailtoUrl } from './letter.js';

const $ = (id) => document.getElementById(id);

let services = [];
let serviceById = new Map();
let activeEmail = '';
/** serviceId/domain -> status string, persisted per email in localStorage. */
let statuses = {};
let inboxController = null;

// --- Status persistence ------------------------------------------------------

const statusKey = (email) => `sanctuary:status:${email}`;

function loadStatuses(email) {
  try {
    statuses = JSON.parse(localStorage.getItem(statusKey(email)) || '{}');
  } catch {
    statuses = {};
  }
}

function saveStatus(key, value) {
  statuses[key] = value;
  try {
    localStorage.setItem(statusKey(activeEmail), JSON.stringify(statuses));
  } catch {
    // Private-mode storage can throw; the UI still works for this session.
  }
}

// --- Setup -------------------------------------------------------------------

async function init() {
  services = await fetch('/api/services').then((r) => r.json());
  serviceById = new Map(services.map((s) => [s.id, s]));
  buildPicker();
  wireTabs();
  wireInboxForm();
  wireListMode();
  wireDialog();
  $('export-button').addEventListener('click', exportChecklist);
}

function wireTabs() {
  const tabs = [
    { tab: $('tab-inbox'), panel: $('panel-inbox') },
    { tab: $('tab-list'), panel: $('panel-list') },
  ];
  for (const { tab } of tabs) {
    tab.addEventListener('click', () => {
      for (const t of tabs) {
        const on = t.tab === tab;
        t.tab.setAttribute('aria-selected', String(on));
        t.panel.hidden = !on;
      }
    });
  }
}

// --- Manual list mode --------------------------------------------------------

function buildPicker() {
  const list = $('picker-list');
  const byCategory = new Map();
  for (const s of services) {
    if (!byCategory.has(s.category)) byCategory.set(s.category, []);
    byCategory.get(s.category).push(s);
  }
  for (const [category, items] of [...byCategory].sort((a, b) => a[0].localeCompare(b[0]))) {
    const group = document.createElement('div');
    group.className = 'picker-group';
    group.innerHTML = `<h4>${category}</h4>`;
    for (const s of items) {
      const label = document.createElement('label');
      label.className = 'check';
      label.innerHTML = `<input type="checkbox" value="${s.id}"><span>${escapeHtml(s.name)}</span>`;
      group.append(label);
    }
    list.append(group);
  }
}

function wireListMode() {
  for (const btn of document.querySelectorAll('[data-pick]')) {
    btn.addEventListener('click', () => {
      const checked = btn.dataset.pick === 'all';
      for (const box of $('picker-list').querySelectorAll('input')) box.checked = checked;
    });
  }
  $('list-button').addEventListener('click', () => {
    const ids = [...$('picker-list').querySelectorAll('input:checked')].map((b) => b.value);
    if (ids.length === 0) return;
    activeEmail = $('list-email').value.trim().toLowerCase();
    loadStatuses(activeEmail);
    const matched = ids.map((id) => ({ id, ...serviceById.get(id) }));
    showResults(matched, [], { showMeta: false });
  });
}

// --- Inbox mode --------------------------------------------------------------

function wireInboxForm() {
  const emailInput = $('inbox-email');
  emailInput.addEventListener('change', updateProviderHint);
  $('inbox-cancel').addEventListener('click', () => inboxController?.abort());
  $('inbox-form').addEventListener('submit', (e) => {
    e.preventDefault();
    startInboxScan();
  });
}

async function updateProviderHint() {
  const email = $('inbox-email').value.trim().toLowerCase();
  const hint = $('provider-hint');
  if (!email.includes('@')) return void (hint.hidden = true);
  const provider = await fetch('/api/provider', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).then((r) => r.json()).catch(() => null);
  if (!provider) {
    hint.hidden = true;
    $('server-details').open = true;
    return;
  }
  $('inbox-host').value = provider.host;
  $('inbox-port').value = provider.port;
  const link = provider.help ? ` <a href="${provider.help}" target="_blank" rel="noopener noreferrer">Create an app password</a>.` : '';
  hint.innerHTML = `${escapeHtml(provider.name)} detected.${provider.note ? ' ' + escapeHtml(provider.note) : ''}${link}`;
  hint.hidden = false;
}

function setInboxBusy(busy) {
  $('inbox-button').disabled = busy;
  $('inbox-cancel').hidden = !busy;
}

async function startInboxScan() {
  const email = $('inbox-email').value.trim().toLowerCase();
  const password = $('inbox-password').value;
  const error = $('inbox-error');
  error.hidden = true;

  if (!$('inbox-owns').checked) return showError(error, 'Please confirm this mailbox is yours.');
  if (!email.includes('@')) return showError(error, 'Enter a valid email address.');
  if (!password) return showError(error, 'Enter your password or app password.');

  activeEmail = email;
  loadStatuses(email);
  setInboxBusy(true);
  showProgress('Connecting…', 0);
  $('found-list').replaceChildren();
  $('results').hidden = false;

  inboxController = new AbortController();
  try {
    const res = await fetch('/api/inbox/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        ownsEmail: true,
        host: $('inbox-host').value.trim() || undefined,
        port: Number($('inbox-port').value) || undefined,
      }),
      signal: inboxController.signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Scan failed (HTTP ${res.status})`);
    }
    await consumeStream(res.body, handleInboxEvent);
  } catch (err) {
    if (err.name !== 'AbortError') showError(error, err.message);
    hideProgress();
  } finally {
    setInboxBusy(false);
    $('inbox-password').value = '';
    inboxController = null;
  }
}

async function consumeStream(stream, onEvent) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
}

function handleInboxEvent(event) {
  if (event.type === 'status') {
    showProgress(event.message, null);
  } else if (event.type === 'progress') {
    showProgress(`Scanned ${event.scanned.toLocaleString()} of ${event.total.toLocaleString()} messages…`,
      event.total ? event.scanned / event.total : null);
  } else if (event.type === 'error') {
    showError($('inbox-error'), event.error);
    hideProgress();
  } else if (event.type === 'done') {
    hideProgress();
    const matched = event.matched.map((m) => ({ ...serviceById.get(m.id), ...m }));
    showResults(matched, event.others, { showMeta: true });
  }
}

// --- Results -----------------------------------------------------------------

function showResults(matched, others, { showMeta }) {
  $('results').hidden = false;
  $('found-count').textContent = matched.length ? `(${matched.length})` : '';
  $('found-empty').hidden = matched.length > 0;
  $('export-button').hidden = matched.length === 0;

  const list = $('found-list');
  list.replaceChildren();
  for (const item of matched) list.append(buildCard(item, showMeta));

  const othersSection = $('others-section');
  if (others.length) {
    othersSection.hidden = false;
    $('others-count').textContent = `(${others.length})`;
    const olist = $('others-list');
    olist.replaceChildren();
    for (const o of others.slice(0, 200)) olist.append(buildOtherRow(o));
  } else {
    othersSection.hidden = true;
  }
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildCard(item, showMeta) {
  const node = $('card-template').content.firstElementChild.cloneNode(true);
  node.querySelector('.card-name').textContent = item.name;

  const meta = [];
  if (showMeta && item.messageCount) {
    meta.push(`${item.messageCount.toLocaleString()} ${item.messageCount === 1 ? 'email' : 'emails'}`);
    if (item.lastDate) meta.push(`last ${formatDate(item.lastDate)}`);
  }
  meta.push(difficultyLabel(item.deletion.difficulty));
  node.querySelector('.card-meta').textContent = meta.join(' · ');

  node.querySelector('.card-detail').textContent = `${item.category} · ${item.domain}`;
  node.querySelector('.card-steps').textContent = item.deletion.steps;
  const notes = node.querySelector('.card-notes');
  if (item.notes) notes.textContent = item.notes;
  else notes.remove();

  const link = node.querySelector('.delete-link');
  link.href = item.deletion.url;
  link.addEventListener('click', () => {
    if (statusSelect.value === 'todo') setStatus(item.id, 'started');
  });

  node.querySelector('.request-button').addEventListener('click', () => openRequest(item));

  const statusSelect = node.querySelector('.status');
  statusSelect.value = statuses[item.id] || 'todo';
  applyStatusClass(node, statusSelect.value);
  statusSelect.addEventListener('change', () => setStatus(item.id, statusSelect.value, node));

  function setStatus(id, value) {
    statusSelect.value = value;
    saveStatus(id, value);
    applyStatusClass(node, value);
  }
  return node;
}

function applyStatusClass(node, value) {
  node.dataset.status = value;
}

function buildOtherRow(group) {
  const node = $('other-template').content.firstElementChild.cloneNode(true);
  node.querySelector('.row-name').textContent = group.name || group.domain;
  const meta = [group.domain];
  if (group.messageCount) meta.push(`${group.messageCount.toLocaleString()} emails`);
  if (group.lastDate) meta.push(`last ${formatDate(group.lastDate)}`);
  node.querySelector('.row-meta').textContent = meta.join(' · ');

  const search = node.querySelector('.search-link');
  search.href = `https://www.google.com/search?q=${encodeURIComponent('delete account ' + group.domain)}`;

  node.querySelector('.request-button').addEventListener('click', () =>
    openRequest({
      id: group.domain,
      name: group.name || group.domain,
      domain: group.domain,
      privacy: { url: `https://www.google.com/search?q=${encodeURIComponent(group.domain + ' privacy data deletion contact')}` },
    }),
  );
  return node;
}

// --- Erasure request dialog --------------------------------------------------

let requestTarget = null;

function wireDialog() {
  $('request-law').addEventListener('change', refreshRequest);
  $('request-name').addEventListener('input', refreshRequest);
  $('request-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('request-body').value);
      const btn = $('request-copy');
      btn.textContent = 'Copied';
      setTimeout(() => (btn.textContent = 'Copy message'), 1500);
    } catch {
      $('request-body').select();
    }
  });
}

function openRequest(service) {
  requestTarget = service;
  $('request-title').textContent = `Erasure request — ${service.name}`;
  refreshRequest();
  $('request-dialog').showModal();
}

function refreshRequest() {
  if (!requestTarget) return;
  const law = $('request-law').value;
  const name = $('request-name').value;
  const email = activeEmail || $('inbox-email').value || $('list-email').value;
  const letter = buildLetter({ service: requestTarget.name, email, law, name });
  $('request-subject').value = letter.subject;
  $('request-body').value = letter.body;

  const privacy = requestTarget.privacy || {};
  const send = $('request-send');
  const channel = $('request-channel');
  if (privacy.email) {
    send.href = mailtoUrl(privacy.email, letter);
    send.textContent = `Email ${privacy.email}`;
    channel.textContent = 'Opens your mail app with the request filled in.';
  } else {
    send.href = privacy.url || '#';
    send.textContent = 'Open privacy contact';
    channel.textContent = 'This service has no published privacy email. Copy the message, then paste it into their privacy form or support page.';
  }
}

// --- Export ------------------------------------------------------------------

function exportChecklist() {
  const rows = [...$('found-list').children].map((node) => {
    const name = node.querySelector('.card-name').textContent;
    const status = node.querySelector('.status').value;
    return `[${status === 'removed' ? 'x' : ' '}] ${name} — ${status}`;
  });
  const text = `Sanctuary checklist for ${activeEmail || 'your email'}\n${new Date().toLocaleString()}\n\n${rows.join('\n')}\n`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sanctuary-checklist.txt';
  a.click();
  URL.revokeObjectURL(url);
}

// --- Helpers -----------------------------------------------------------------

function showProgress(text, fraction) {
  $('progress').hidden = false;
  $('progress-text').textContent = text;
  const bar = $('progress-bar');
  if (fraction === null) {
    bar.classList.add('indeterminate');
  } else {
    bar.classList.remove('indeterminate');
    bar.style.width = `${Math.round(fraction * 100)}%`;
  }
}

function hideProgress() {
  $('progress').hidden = true;
}

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

function difficultyLabel(d) {
  return { easy: 'Easy to delete', medium: 'Some steps to delete', hard: 'Hard to delete' }[d] || '';
}

function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

init();
