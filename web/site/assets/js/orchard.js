(function () {
  'use strict';
  const E = window.BargeEngine;
  const W = window.BargeWeb3;
  const C = window.BARGE_CONFIG || {};
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  const state = { items: [], holders: null, rings: null, current: null };
  const KLABEL = Object.fromEntries(E.KINDS.map(k => [k.id, k.label]));

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
  }

  if (C.x) { $('lnkX').href = C.x; $('lnkX').hidden = false; }

  /* ---------- Wallet ---------- */
  function renderWallet(addr) {
    $('connect').hidden = !!addr;
    $('walletOn').hidden = !addr;
    $('walletAddr').textContent = addr ? W.short(addr) : '';
    if (state.current) openDrawer(state.current.id, true);
  }
  W.onChange(renderWallet);
  $('connect').addEventListener('click', async () => {
    try { await W.connect(); toast('Wallet connected'); } catch (e) { toast(e.message || 'Could not connect'); }
  });
  $('disconnect').addEventListener('click', async () => { await W.disconnect(); toast('Wallet disconnected'); });

  /* ---------- Data ---------- */
  const isHolder = it => !!(state.holders && state.holders.get(String(it.author).toLowerCase()));
  const ringsOf = it => state.rings ? (state.rings.get(String(it.author).toLowerCase() + '|' + String(it.agentHash || '').toLowerCase()) || 0) : 0;

  async function load() {
    try {
      const res = await fetch('/api/orchard', { cache: 'no-cache', headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      state.items = Array.isArray(data.items) ? data.items : [];
    } catch (e) {
      state.items = [];
      showNote('The Harbor could not be reached. Try again in a moment.');
    }
    stats();
    render();
    if (location.hash.length > 1) openDrawer(decodeURIComponent(location.hash.slice(1)));
    chainData();
  }

  async function chainData() {
    const authors = state.items.map(i => i.author);
    try { state.holders = await W.holders(authors); } catch (e) { state.holders = null; }
    try { state.rings = await W.ringCounts(state.items.map(i => ({ holder: i.author, agentHash: i.agentHash }))); } catch (e) { state.rings = null; }
    try {
      const t = await W.lineageTotals();
      $('sRings').textContent = t ? t.rings.toLocaleString('en-US') : '—';
    } catch (e) { /* keep dash */ }
    if (!W.tokenLive()) {
      $('holdersOnly').disabled = true;
      $('holdersOnly').parentElement.title = 'Holder badges switch on when $BARGE is live.';
    }
    render();
    if (state.current) openDrawer(state.current.id, true);
  }

  function stats() {
    $('sAgents').textContent = state.items.length.toLocaleString('en-US');
    $('sAuthors').textContent = new Set(state.items.map(i => i.author)).size.toLocaleString('en-US');
  }

  function showNote(msg) { const n = $('note'); n.textContent = msg; n.hidden = !msg; }

  /* ---------- Filters ---------- */
  for (const p of E.PLATFORMS) $('platform').add(new Option(p.name, p.id));
  ['q', 'platform', 'sort', 'holdersOnly'].forEach(id => $(id).addEventListener(id === 'q' ? 'input' : 'change', render));

  function filtered() {
    const q = $('q').value.trim().toLowerCase();
    const plat = $('platform').value;
    const holdersOnly = $('holdersOnly').checked;
    let list = state.items.filter(it => {
      if (plat && it.source !== plat) return false;
      if (holdersOnly && !isHolder(it)) return false;
      if (q && !(String(it.name) + ' ' + String(it.description || '')).toLowerCase().includes(q)) return false;
      return true;
    });
    const sort = $('sort').value;
    const byHolder = (a, b) => (isHolder(b) ? 1 : 0) - (isHolder(a) ? 1 : 0);
    if (sort === 'complete') list.sort((a, b) => byHolder(a, b) || Object.keys(b.kinds || {}).length - Object.keys(a.kinds || {}).length || b.items - a.items);
    else if (sort === 'rings') list.sort((a, b) => ringsOf(b) - ringsOf(a) || byHolder(a, b));
    else list.sort((a, b) => byHolder(a, b) || String(a.id).localeCompare(String(b.id)));
    return list;
  }

  const fmtDate = iso => { try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return ''; } };

  function badgesFor(it) {
    const box = el('div', 'badges');
    if (isHolder(it)) box.appendChild(el('span', 'badge holder', 'Holder'));
    const n = ringsOf(it);
    if (n) box.appendChild(el('span', 'badge', n + ' ring' + (n > 1 ? 's' : '')));
    return box;
  }

  function render() {
    const grid = $('grid');
    grid.textContent = '';
    const list = filtered();
    for (const it of list) {
      const card = el('button', 'card');
      card.type = 'button';
      card.setAttribute('aria-label', 'Open ' + it.name);
      const top = el('div', 'card-top');
      top.append(el('span', 'mono dim', it.source ? E.platformName(it.source) : 'Barge package'), el('span', 'mono dim', fmtDate(it.createdAt)));
      const kinds = el('div', 'kinds');
      for (const k of E.KINDS) {
        const n = (it.kinds || {})[k.id];
        if (!n || k.id === 'identity') continue;
        const s = el('span');
        const word = k.label.toLowerCase().replace(' (mcp)', '');
        s.append(el('i'), document.createTextNode(n + ' ' + (n === 1 && /^(skills|commands|subagents|tools|routines)$/.test(word) ? word.slice(0, -1) : word)));
        kinds.appendChild(s);
      }
      const foot = el('div', 'card-foot');
      foot.append(el('span', 'mono', W.short(it.author)), badgesFor(it));
      card.append(top, el('div', 'card-name', it.name), el('p', 'card-desc' + (it.description ? '' : ' none'), it.description || 'No description.'), kinds, foot);
      card.addEventListener('click', () => { location.hash = encodeURIComponent(it.id); });
      grid.appendChild(card);
    }
    const empty = $('empty');
    if (!list.length) {
      empty.hidden = false;
      const any = state.items.length > 0;
      $('emptyTitle').textContent = any ? 'No agent matches.' : 'No agents yet.';
      $('emptySub').textContent = any ? 'Try another search or platform.' : 'Open Barge, load your agent and publish it. It will appear here.';
    } else empty.hidden = true;
  }

  /* ---------- Drawer ---------- */
  function openDrawer(id, refresh) {
    const it = state.items.find(x => x.id === id);
    if (!it) { if (!refresh && state.items.length) toast('This agent is no longer on the Harbor.'); return; }
    state.current = it;
    $('dSource').textContent = (it.source ? E.platformName(it.source) : 'Barge package').toUpperCase();
    $('dName').textContent = it.name;
    $('dDesc').textContent = it.description || 'No description.';
    const b = $('dBadges'); b.replaceWith(Object.assign(badgesFor(it), { id: 'dBadges' }));
    const a = $('dAuthor'); a.textContent = W.short(it.author); a.href = W.addressUrl(it.author);
    $('dDate').textContent = fmtDate(it.createdAt);
    $('dSize').textContent = it.size < 1024 ? it.size + ' B' : (it.size / 1024).toFixed(1) + ' KB';
    $('dLineage').textContent = !W.lineageLive() ? 'Not live yet' : (ringsOf(it) ? ringsOf(it) + ' ring' + (ringsOf(it) > 1 ? 's' : '') : 'No rings yet');
    const ul = $('dKinds'); ul.textContent = '';
    for (const k of E.KINDS) {
      const n = (it.kinds || {})[k.id];
      if (!n) continue;
      const li = el('li');
      li.append(el('span', null, KLABEL[k.id]), el('b', null, String(n)));
      ul.appendChild(li);
    }
    $('dOpen').href = 'app.html?harbor=' + encodeURIComponent(it.id);
    $('dRemove').hidden = !(W.address && W.address.toLowerCase() === String(it.author).toLowerCase());
    if (!refresh) {
      $('scrim').hidden = false;
      $('drawer').classList.add('open');
      $('drawer').setAttribute('aria-hidden', 'false');
      setTimeout(() => $('dClose').focus(), 50);
    }
  }

  function closeDrawer() {
    state.current = null;
    $('drawer').classList.remove('open');
    $('drawer').setAttribute('aria-hidden', 'true');
    $('scrim').hidden = true;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }

  window.addEventListener('hashchange', () => { if (location.hash.length > 1) openDrawer(decodeURIComponent(location.hash.slice(1))); else closeDrawer(); });
  $('dClose').addEventListener('click', closeDrawer);
  $('scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.current) closeDrawer(); });

  $('dDownload').addEventListener('click', async () => {
    const it = state.current; if (!it) return;
    try {
      const res = await fetch('/api/orchard/' + encodeURIComponent(it.id));
      if (!res.ok) throw new Error();
      const data = await res.json();
      const blob = new Blob([data.package], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = E.slug(it.name, 'agent') + '.barge';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) { toast('Download failed. Try again.'); }
  });

  $('dCopy').addEventListener('click', async () => {
    const it = state.current; if (!it) return;
    const link = location.origin + '/harbor.html#' + encodeURIComponent(it.id);
    try { await navigator.clipboard.writeText(link); toast('Link copied'); } catch (e) { toast(link); }
  });

  $('dRemove').addEventListener('click', async () => {
    const it = state.current; if (!it || !W.address) return;
    try {
      const message = 'Barge Harbor\nAction: delete\nAgent: ' + it.id + '\nTime: ' + new Date().toISOString();
      const signature = await W.sign(message);
      const res = await fetch('/api/orchard/' + encodeURIComponent(it.id), { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: W.address, message, signature }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not remove it.');
      state.items = state.items.filter(x => x.id !== it.id);
      closeDrawer(); stats(); render();
      toast('Removed from the Harbor');
    } catch (e) { toast(e.message || 'Could not remove it.'); }
  });

  load();
})();

/* X link in the footer */
(function () { var c = window.BARGE_CONFIG || {}, a = document.getElementById('lnkX'); if (c.x && a) { a.href = c.x; a.hidden = false; } })();
