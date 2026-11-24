(function () {
  'use strict';
  const E = window.BargeEngine;
  const S = window.BargeSamples;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  const MAX_FILES = 4000;
  const MAX_BYTES = 2 * 1024 * 1024;
  const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '__pycache__', '.venv', 'venv', '.next', 'dist', 'build']);

  const state = {
    manifest: null, report: null, excluded: new Set(), target: null,
    plan: null, bundle: null, bundleKey: '', filesRead: 0, extraSkipped: [],
    viewPath: null, tab: 'items', seq: 0
  };

  /* ---------------- Toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 2400);
  }

  /* ---------------- Loading ---------------- */
  function showError(msg) {
    const e = $('loadError');
    e.textContent = msg;
    e.hidden = !msg;
  }
  function busy(on, text) {
    $('busy').hidden = !on;
    if (text) $('busyText').textContent = text;
  }

  const skipPath = p => p.split('/').some(s => SKIP_DIRS.has(s));

  async function fromFileList(list) {
    const out = [];
    for (const f of list) {
      const path = f.webkitRelativePath || f.name;
      if (skipPath(path)) continue;
      out.push({ path, file: f });
      if (out.length > MAX_FILES) throw new Error('That folder has more than ' + MAX_FILES + ' files. Pick the folder your agent lives in.');
    }
    return out;
  }

  function entryFile(entry) { return new Promise((res, rej) => entry.file(res, rej)); }
  function readBatch(reader) { return new Promise((res, rej) => reader.readEntries(res, rej)); }

  async function walk(entry, prefix, out) {
    if (out.length > MAX_FILES) throw new Error('That folder has more than ' + MAX_FILES + ' files. Pick the folder your agent lives in.');
    if (entry.isFile) {
      out.push({ path: prefix + entry.name, file: await entryFile(entry) });
    } else if (entry.isDirectory) {
      if (SKIP_DIRS.has(entry.name)) return;
      const reader = entry.createReader();
      for (;;) {
        const batch = await readBatch(reader);
        if (!batch.length) break;
        for (const e of batch) await walk(e, prefix + entry.name + '/', out);
      }
    }
  }

  async function fromDataTransfer(dt) {
    const items = dt.items ? [...dt.items].filter(i => i.kind === 'file') : [];
    const entries = items.map(i => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null));
    if (entries.length && entries.every(Boolean)) {
      const out = [];
      for (const e of entries) await walk(e, '', out);
      return out;
    }
    return fromFileList(dt.files || []);
  }

  async function ingest(list) {
    showError('');
    if (!list.length) { showError('Nothing to read. Drop a folder or some files.'); return; }
    busy(true, 'Reading ' + list.length + ' file' + (list.length > 1 ? 's' : '') + '…');
    try {
      const entries = [];
      const skipped = [];
      for (const it of list) {
        const name = it.path.toLowerCase();
        if (it.file.size > (name.endsWith('.zip') ? 64 * 1024 * 1024 : MAX_BYTES)) { skipped.push({ path: it.path, reason: 'too large' }); continue; }
        const bytes = new Uint8Array(await it.file.arrayBuffer());
        if (name.endsWith('.zip')) {
          busy(true, 'Opening ' + it.path.split('/').pop() + '…');
          const z = await E.unzip(bytes);
          for (const b of z.blocked) skipped.push({ path: it.path + ' › ' + b.path, reason: b.reason });
          for (const z1 of z.entries) if (!skipPath(z1.path)) entries.push({ path: z1.path, bytes: z1.bytes });
        } else {
          entries.push({ path: it.path, bytes });
        }
      }
      load(entries, skipped);
    } catch (err) {
      showError(err && err.message ? err.message : 'Barge could not read those files.');
    } finally {
      busy(false);
    }
  }

  /* README badge: shown when the agent came from a GitHub repo */
  let badgeRepo = null;
  function badgeMarkdown() {
    return '[![Barge this agent](https://bargedot.fun/badge.svg)](https://bargedot.fun/app.html?repo=' + encodeURIComponent(badgeRepo).replace(/%2F/g, '/') + ')';
  }
  function setBadge(repo) {
    badgeRepo = repo || null;
    $('badgeBox').hidden = !badgeRepo;
    if (badgeRepo) $('badgeCode').textContent = badgeMarkdown();
  }
  $('badgeCopy').addEventListener('click', async () => {
    if (!badgeRepo) return;
    const md = badgeMarkdown();
    try { await navigator.clipboard.writeText(md); toast('Badge copied. Paste it in your README.'); }
    catch (e) {
      const r = document.createRange(); r.selectNodeContents($('badgeCode'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); document.execCommand('copy'); sel.removeAllRanges();
      toast('Badge copied. Paste it in your README.');
    }
  });

  function load(entries, skipped, preferTarget, opts) {
    setBadge(null);
    let res;
    try {
      res = E.readAgent(entries, opts || {});
    } catch (err) {
      showError('Barge could not read that agent: ' + (err && err.message ? err.message : 'unknown error') + '.');
      return false;
    }
    if (!res.report.recognized.length) {
      showError('No agent files found. Barge looks for files like CLAUDE.md, AGENTS.md, GEMINI.md, .cursor/rules, .windsurf/rules, .clinerules, .goosehints, CONVENTIONS.md, SOUL.md or a .barge package.');
      return false;
    }
    state.manifest = res.manifest;
    state.report = res.report;
    state.extraSkipped = skipped || [];
    state.excluded = new Set();
    state.filesRead = res.report.recognized.length;
    state.viewPath = null;
    resetShare();
    const ids = E.PLATFORMS.map(p => p.id);
    state.target = preferTarget && ids.includes(preferTarget) && preferTarget !== res.manifest.source
      ? preferTarget
      : ids.find(id => id !== res.manifest.source) || ids[0];
    $('load').hidden = true;
    $('work').hidden = false;
    selectTab('items');
    renderAgent();
    renderDest();
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  }

  function reset() {
    state.manifest = null;
    state.bundle = null;
    $('work').hidden = true;
    $('load').hidden = false;
    $('pickDir').value = '';
    $('pickFiles').value = '';
    $('receipt').hidden = true;
    showError('');
    history.replaceState(null, '', location.pathname);
    window.scrollTo({ top: 0 });
  }

  /* ---------------- Rendering ---------------- */
  function renderAgent() {
    const m = state.manifest;
    $('agentName').value = m.agent.name;
    $('detected').textContent = m.source ? E.platformName(m.source) + (state.report.fromPackage ? ' · .barge' : '') : 'Unknown';
    $('filesRead').textContent = String(state.filesRead);
    $('agentId').textContent = m.agent.id.slice(0, 8) + '…' + m.agent.id.slice(-4);
    $('agentId').title = m.agent.id;
  }

  function renderDest() {
    const box = $('dest');
    box.textContent = '';
    for (const p of E.PLATFORMS) {
      const b = el('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.id = p.id;
      const lbl = el('span', 'lbl');
      lbl.append(el('span', 'r'), el('span', null, p.name));
      b.appendChild(lbl);
      if (p.id === state.manifest.source) b.appendChild(el('span', 'tag', 'Source'));
      b.addEventListener('click', () => { state.target = p.id; renderAll(); });
      b.addEventListener('keydown', e => {
        if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key)) return;
        e.preventDefault();
        const ids = E.PLATFORMS.map(x => x.id);
        const i = ids.indexOf(state.target) + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1);
        state.target = ids[(i + ids.length) % ids.length];
        renderAll();
        box.querySelector('[data-id="' + state.target + '"]').focus();
      });
      box.appendChild(b);
    }
  }

  function renderAll() {
    const m = state.manifest;
    if (!m) return;
    const plan = E.plan(m, state.target, state.excluded);
    state.plan = plan;

    for (const b of $('dest').children) {
      const on = b.dataset.id === state.target;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    }
    const name = E.platformName(state.target);
    $('destName').textContent = name;
    $('destName2').textContent = name;
    $('cAsIs').textContent = plan.counts['as-is'];
    $('cConv').textContent = plan.counts.converted;
    $('cNone').textContent = plan.counts.none;
    $('secretCount').textContent = String(m.secrets.length);
    $('receipt').hidden = true;

    renderGroups(plan);
    renderSecrets();
    renderSkipped();
    $('nItems').textContent = E.listItems(m).length;
    refreshBundle();
  }

  function renderGroups(plan) {
    const m = state.manifest;
    const all = E.listItems(m);
    const byId = new Map(plan.items.map(i => [i.id, i]));
    const box = $('groups');
    box.textContent = '';
    for (const k of E.KINDS) {
      const its = all.filter(i => i.kind === k.id);
      if (!its.length) continue;
      const g = el('section', 'group');
      const head = el('div', 'group-head');
      const h = el('h3', null, k.label);
      h.appendChild(el('span', null, String(its.length)));
      head.appendChild(h);
      if (its.length > 1) {
        const allOff = its.every(i => state.excluded.has(i.id));
        const t = el('button', 'link', allOff ? 'Select all' : 'Select none');
        t.type = 'button';
        t.addEventListener('click', () => {
          for (const i of its) allOff ? state.excluded.delete(i.id) : state.excluded.add(i.id);
          renderAll();
        });
        head.appendChild(t);
      }
      g.appendChild(head);
      for (const it of its) {
        const off = state.excluded.has(it.id);
        const row = el('label', 'item' + (off ? ' off' : ''));
        const cb = el('input', 'check');
        cb.type = 'checkbox';
        cb.checked = !off;
        cb.setAttribute('aria-label', 'Include ' + it.name);
        cb.addEventListener('change', () => {
          cb.checked ? state.excluded.delete(it.id) : state.excluded.add(it.id);
          renderAll();
        });
        const main = el('div', 'item-main');
        main.append(el('div', 'item-name', it.name));
        if (it.detail) main.append(el('div', 'item-detail', it.detail));
        const st = el('div', 'item-status');
        const p = byId.get(it.id);
        if (off || !p) {
          st.append(el('span', 'sq none'), el('span', null, 'Stays behind'));
        } else {
          const txt = el('span');
          txt.appendChild(el('b', null, E.STATUS_LABEL[p.status]));
          if (p.note) txt.appendChild(document.createTextNode(': ' + p.note));
          st.append(el('span', 'sq ' + p.status), txt);
        }
        row.append(cb, main, st);
        g.appendChild(row);
      }
      box.appendChild(g);
    }
  }

  function renderSecrets() {
    const list = $('secretList');
    list.textContent = '';
    const secrets = state.manifest.secrets;
    $('nSecrets').textContent = secrets.length;
    if (!secrets.length) {
      list.appendChild(el('li', 'empty', 'No secrets found.'));
      return;
    }
    for (const s of secrets) {
      const li = el('li');
      li.appendChild(el('span', 'r1', s.where + ' · ' + s.label));
      const r2 = el('span', 'r2');
      if (s.ref) { r2.append('Set '); r2.appendChild(el('code', null, s.ref)); }
      else r2.textContent = 'Replaced with [redacted]';
      li.appendChild(r2);
      list.appendChild(li);
    }
  }

  function renderSkipped() {
    const list = $('skippedList');
    list.textContent = '';
    const rows = state.extraSkipped.concat(state.report.ignored).map(x => ({ a: x.path, b: x.reason }))
      .concat(state.report.warnings.map(w => ({ a: w, b: 'warning' })));
    $('nSkipped').textContent = rows.length;
    $('tab-skipped').hidden = rows.length === 0;
    if (!rows.length) { list.appendChild(el('li', 'empty', 'Every file was used.')); return; }
    for (const r of rows) {
      const li = el('li');
      li.append(el('span', 'r1', r.a), el('span', 'r2', r.b));
      list.appendChild(li);
    }
  }

  async function refreshBundle() {
    const seq = ++state.seq;
    const key = state.target + '|' + [...state.excluded].sort().join(',') + '|' + state.manifest.agent.name;
    try {
      const b = await E.bundle(state.manifest, state.target, state.excluded);
      if (seq !== state.seq) return;
      state.bundle = b;
      state.bundleKey = key;
      renderFiles(b.files);
    } catch (err) {
      if (seq !== state.seq) return;
      state.bundle = null;
      toast('Could not build the bundle: ' + (err && err.message ? err.message : 'unknown error'));
    }
  }

  function renderFiles(files) {
    const list = $('fileList');
    list.textContent = '';
    $('nFiles').textContent = files.length;
    const sorted = files.slice().sort((a, b) => {
      const da = a.path.includes('/') ? a.path.slice(0, a.path.lastIndexOf('/')) : '';
      const db = b.path.includes('/') ? b.path.slice(0, b.path.lastIndexOf('/')) : '';
      return da === db ? a.path.localeCompare(b.path) : da.localeCompare(db);
    });
    let lastDir = null;
    for (const f of sorted) {
      const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '';
      if (dir !== lastDir) {
        if (dir) {
          const d = el('li');
          d.appendChild(el('button', 'dir', dir + '/'));
          d.firstChild.disabled = true;
          d.firstChild.style.cursor = 'default';
          list.appendChild(d);
        }
        lastDir = dir;
      }
      const li = el('li');
      const b = el('button', null, f.path.split('/').pop());
      b.type = 'button';
      b.style.paddingLeft = (14 + (dir ? 14 : 0)) + 'px';
      b.title = f.path;
      b.addEventListener('click', () => view(f.path));
      b.dataset.path = f.path;
      li.appendChild(b);
      list.appendChild(li);
    }
    const keep = files.find(f => f.path === state.viewPath);
    view(keep ? keep.path : (files.find(f => /^(CLAUDE|AGENTS|GEMINI)\.md$/.test(f.path)) || files[0] || {}).path);
  }

  function view(path) {
    const b = state.bundle;
    if (!b || !path) return;
    const f = b.files.find(x => x.path === path);
    if (!f) return;
    state.viewPath = path;
    for (const btn of $('fileList').querySelectorAll('button[data-path]')) btn.setAttribute('aria-current', btn.dataset.path === path ? 'true' : 'false');
    $('viewerPath').textContent = path;
    const isText = typeof f.content === 'string';
    const size = isText ? new TextEncoder().encode(f.content).length : f.content.length;
    $('viewerSize').textContent = size < 1024 ? size + ' B' : (size / 1024).toFixed(1) + ' KB';
    $('viewerBody').textContent = isText ? (f.content.length > 200000 ? f.content.slice(0, 200000) + '\n…' : f.content) : 'Binary file. It travels unchanged.';
  }

  /* ---------------- Tabs ---------------- */
  const TABS = ['items', 'files', 'secrets', 'skipped'];
  function selectTab(id) {
    state.tab = id;
    for (const t of TABS) {
      const on = t === id;
      $('tab-' + t).setAttribute('aria-selected', on ? 'true' : 'false');
      $('tab-' + t).tabIndex = on ? 0 : -1;
      $('panel-' + t).hidden = !on;
    }
  }
  for (const t of TABS) {
    $('tab-' + t).addEventListener('click', () => selectTab(t));
    $('tab-' + t).addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const visible = TABS.filter(x => !$('tab-' + x).hidden);
      const i = visible.indexOf(state.tab) + (e.key === 'ArrowRight' ? 1 : -1);
      const next = visible[(i + visible.length) % visible.length];
      selectTab(next);
      $('tab-' + next).focus();
    });
  }

  /* ---------------- Downloads ---------------- */
  function save(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function currentBundle() {
    const key = state.target + '|' + [...state.excluded].sort().join(',') + '|' + state.manifest.agent.name;
    if (state.bundle && state.bundleKey === key) return state.bundle;
    const b = await E.bundle(state.manifest, state.target, state.excluded);
    state.bundle = b;
    state.bundleKey = key;
    return b;
  }

  $('everywhere').addEventListener('click', async () => {
    if (!state.manifest) return;
    const btn = $('everywhere');
    btn.disabled = true;
    try {
      const b = await E.bundleEverywhere(state.manifest, state.excluded);
      save(new Blob([b.zip], { type: 'application/zip' }), b.filename);
      const r = $('receipt');
      r.textContent = '';
      r.append('Saved ' + b.filename + ': ' + b.fileCount + ' files for ' + b.platforms + ' platforms. Guide inside as BARGE-EVERYWHERE.md.');
      if (b.fingerprint) {
        r.append(document.createElement('br'), 'Fingerprint ');
        r.appendChild(el('code', null, b.fingerprint.slice(0, 16) + '…'));
      }
      r.hidden = false;
      toast('Your agent, ready for all ' + b.platforms + ' platforms');
    } catch (err) {
      toast('Barge could not build that bundle: ' + (err && err.message ? err.message : 'unknown error'));
    } finally {
      btn.disabled = false;
    }
  });

  $('download').addEventListener('click', async () => {
    if (!state.manifest) return;
    try {
      const b = await currentBundle();
      save(new Blob([b.zip], { type: 'application/zip' }), b.filename);
      const r = $('receipt');
      r.textContent = '';
      r.append('Saved ' + b.filename + '. Receipt inside as BARGE-RECEIPT.md.');
      if (b.fingerprint) {
        r.append(document.createElement('br'), 'Fingerprint ');
        r.appendChild(el('code', null, b.fingerprint.slice(0, 16) + '…'));
      }
      r.hidden = false;
      toast('Bundle ready for ' + E.platformName(state.target));
    } catch (err) {
      toast('Download failed: ' + (err && err.message ? err.message : 'unknown error'));
    }
  });

  $('savePkg').addEventListener('click', async () => {
    if (!state.manifest) return;
    try {
      const b = await currentBundle();
      save(new Blob([b.packageText], { type: 'application/json' }), b.packageName);
      toast('Package saved as ' + b.packageName);
    } catch (err) {
      toast('Could not save the package: ' + (err && err.message ? err.message : 'unknown error'));
    }
  });

  /* ---------------- Share & prove ---------------- */
  const W = window.BargeWeb3;
  const errText = e => (e && (e.code === 4001 || /rejected|denied/i.test(e.message || ''))) ? 'Cancelled in your wallet.' : (e && e.message ? e.message : 'Something went wrong.');
  W.onChange(addr => { $('walletLine').hidden = !addr; $('wl').textContent = addr ? W.short(addr) : ''; });
  $('wlOff').addEventListener('click', () => W.disconnect());
  function resetShare() {
    $('publishBox').hidden = true;
    $('publishBtn').setAttribute('aria-expanded', 'false');
    $('pubDesc').value = '';
    $('shareMsg').hidden = true;
    $('shareMsg').textContent = '';
  }
  function shareMsg(nodes) { const r = $('shareMsg'); r.textContent = ''; r.append(...nodes); r.hidden = false; }
  if (!W.lineageLive()) {
    $('ringBtn').disabled = true;
    $('ringHint').textContent = 'Lineages open as soon as the contract is live on Robinhood Chain.';
  }
  $('publishBtn').addEventListener('click', () => {
    const box = $('publishBox');
    box.hidden = !box.hidden;
    if (!box.hidden) { $('shareMsg').hidden = true; box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    $('publishBtn').setAttribute('aria-expanded', String(!box.hidden));
    if (!box.hidden) $('pubDesc').focus();
  });
  $('pubGo').addEventListener('click', async () => {
    if (!state.manifest) return;
    const btn = $('pubGo'), label = btn.textContent;
    btn.disabled = true;
    try {
      if (!W.address) { btn.textContent = 'Connecting…'; await W.connect(); }
      const b = await currentBundle();
      const sha = await E.sha256(b.packageText);
      const message = 'Barge Harbor\nAction: publish\nPackage: ' + sha + '\nTime: ' + new Date().toISOString();
      btn.textContent = 'Waiting for signature…';
      const signature = await W.sign(message);
      btn.textContent = 'Publishing…';
      const res = await fetch('/api/orchard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ package: b.packageText, description: $('pubDesc').value, address: W.address, message, signature }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Publishing failed.');
      const a = el('a', null, 'View it on the Harbor');
      a.href = 'harbor.html#' + encodeURIComponent(data.meta.id);
      shareMsg([document.createTextNode('Published. '), a]);
      $('pubDesc').value = '';
      $('publishBox').hidden = true;
      $('publishBtn').setAttribute('aria-expanded', 'false');
      toast('Published to Barge Harbor');
    } catch (e) {
      toast(errText(e));
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });
  $('ringBtn').addEventListener('click', async () => {
    if (!state.manifest || !W.lineageLive()) return;
    const btn = $('ringBtn'), label = btn.textContent;
    btn.disabled = true;
    try {
      if (!W.address) { btn.textContent = 'Connecting…'; await W.connect(); }
      const b = await currentBundle();
      if (!b.fingerprint) throw new Error('This browser cannot compute the package fingerprint.');
      const ids = E.PLATFORMS.map(p => p.id);
      const fromIdx = ids.indexOf(state.manifest.source);
      btn.textContent = 'Confirm in your wallet…';
      const tx = await W.ring(state.manifest.agent.id, b.fingerprint, fromIdx < 0 ? 255 : fromIdx, ids.indexOf(state.target));
      const a = el('a', null, 'View transaction');
      a.href = W.txUrl(tx); a.target = '_blank'; a.rel = 'noopener';
      shareMsg([document.createTextNode('Ring sent. '), a]);
      btn.textContent = 'Waiting for confirmation…';
      const r = await W.waitReceipt(tx);
      if (r && r.status === '0x1') { shareMsg([document.createTextNode('Ring added to the lineage. '), a]); toast('Ring added'); }
      else if (r) throw new Error('The transaction failed.');
    } catch (e) {
      toast(errText(e));
    } finally {
      btn.disabled = !W.lineageLive();
      btn.textContent = label;
    }
  });

  if (W.passportLive()) $('passportBtn').hidden = false;
  $('passportBtn').addEventListener('click', async () => {
    if (!state.manifest || !W.passportLive()) return;
    const btn = $('passportBtn'), label = btn.innerHTML;
    btn.disabled = true;
    try {
      if (!W.address) { btn.textContent = 'Connecting…'; await W.connect(); }
      const b = await currentBundle();
      if (!b.fingerprint) throw new Error('This browser cannot compute the package fingerprint.');
      const ids = E.PLATFORMS.map(p => p.id);
      const fromIdx = ids.indexOf(state.manifest.source);
      btn.textContent = 'Confirm in your wallet…';
      const tx = await W.stampPassport(state.manifest.agent.id, b.fingerprint, fromIdx < 0 ? 255 : fromIdx, state.manifest.agent.name);
      const a = el('a', null, 'View transaction');
      a.href = W.txUrl(tx); a.target = '_blank'; a.rel = 'noopener';
      shareMsg([document.createTextNode('Passport sent. '), a]);
      btn.textContent = 'Waiting for confirmation…';
      const r = await W.waitReceipt(tx);
      if (r && r.status === '0x1') {
        const id = await W.passportOf(W.address, await W.agentHash(state.manifest.agent.id));
        const pa = el('a', null, 'Open passport No. ' + id);
        pa.href = 'passport.html?id=' + id;
        shareMsg([document.createTextNode('Passport stamped on Robinhood Chain. '), pa]);
        toast('Passport No. ' + id + ' stamped');
      } else if (r) throw new Error('The transaction failed.');
    } catch (e) {
      toast(errText(e));
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  });

  /* ---------------- Inputs ---------------- */
  let nameTimer;
  $('agentName').addEventListener('input', e => {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => {
      state.manifest.agent.name = e.target.value.trim() || 'My agent';
      renderAll();
    }, 220);
  });
  $('reset').addEventListener('click', reset);

  $('pickDir').addEventListener('change', async e => { if (e.target.files.length) ingest(await fromFileList(e.target.files).catch(err => { showError(err.message); return []; })); });
  $('pickFiles').addEventListener('change', async e => { if (e.target.files.length) ingest(await fromFileList(e.target.files).catch(err => { showError(err.message); return []; })); });

  const drop = $('drop');
  let depth = 0;
  drop.addEventListener('dragenter', e => { e.preventDefault(); depth++; drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) drop.classList.remove('over'); });
  drop.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  drop.addEventListener('drop', async e => {
    e.preventDefault();
    depth = 0;
    drop.classList.remove('over');
    try {
      ingest(await fromDataTransfer(e.dataTransfer));
    } catch (err) {
      showError(err && err.message ? err.message : 'Barge could not read what you dropped.');
    }
  });
  drop.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === drop) { e.preventDefault(); $('pickDir').click(); }
  });
  // Stop the browser from opening files dropped outside the zone.
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => { if (!drop.contains(e.target)) e.preventDefault(); });

  /* ---------------- GitHub (V2) ---------------- */
  // Reads the agent files of a public GitHub repo straight from GitHub, in this tab.
  // Only files Barge recognizes are downloaded. Nothing goes through Barge's servers.
  const GH_MAX = 150;
  // In a repo, the agent lives at the root: root files, dot-folders like .claude or .cursor,
  // a root skills/ folder, and AGENTS.md / CLAUDE.md / GEMINI.md scoped to a sub-folder.
  // Tests, fixtures and examples are left out so their sample agents are not mixed in.
  const GH_NOISE = /(^|\/)(tests?|__tests__|fixtures?|examples?|samples?|testdata|vendor|third[-_]party|docs?)(\/|$)/i;
  const GH_SCOPED = /(^|\/)(AGENTS|CLAUDE|GEMINI)\.md$/i;
  function ghWanted(rel) {
    if (GH_NOISE.test(rel)) return false;
    if (!rel.includes('/')) return true;
    const top = rel.split('/')[0];
    if (top.startsWith('.') || top === 'skills') return true;
    return GH_SCOPED.test(rel);
  }
  function parseRepo(input) {
    let s = String(input || '').trim().replace(/\.git$/, '').replace(/\/+$/, '');
    if (!/github\.com/i.test(s) && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\/tree\/.+)?$/.test(s)) s = 'github.com/' + s;
    let m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s?#]+)\/([^/\s?#]+)(?:\/tree\/([^/\s?#]+)(?:\/([^?#\s]+))?)?/i.exec(s);
    if (!m) return null;
    return { owner: m[1], repo: m[2], branch: m[3] || '', dir: (m[4] || '').replace(/^\/+|\/+$/g, '') };
  }
  async function gh(url) {
    const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
    if (r.status === 404) throw new Error('Repo not found. Barge reads public GitHub repos only.');
    if (r.status === 403 || r.status === 429) throw new Error('GitHub is limiting requests from your network right now. Try again in a few minutes.');
    if (!r.ok) throw new Error('GitHub answered ' + r.status + '. Try again.');
    return r.json();
  }
  async function fromGitHub(input, preferTarget) {
    showError('');
    const ref = parseRepo(input);
    if (!ref) { showError('Paste a public GitHub repo, like github.com/owner/repo.'); return; }
    busy(true, 'Opening ' + ref.owner + '/' + ref.repo + ' on GitHub…');
    try {
      const meta = await gh('https://api.github.com/repos/' + ref.owner + '/' + ref.repo);
      const branch = ref.branch || meta.default_branch || 'main';
      const tree = await gh('https://api.github.com/repos/' + ref.owner + '/' + ref.repo + '/git/trees/' + encodeURIComponent(branch) + '?recursive=1');
      const prefix = ref.dir ? ref.dir + '/' : '';
      const wanted = [];
      for (const t of tree.tree || []) {
        if (t.type !== 'blob' || !t.path.startsWith(prefix)) continue;
        const rel = t.path.slice(prefix.length);
        if (!rel || skipPath(rel) || !ghWanted(rel)) continue;
        if (!E.classify(rel).type) continue;
        if (t.size > MAX_BYTES) continue;
        wanted.push({ path: t.path, rel });
      }
      if (!wanted.length) throw new Error('No agent files in ' + meta.full_name + (prefix ? '/' + ref.dir : '') + '. Barge looks for CLAUDE.md, AGENTS.md, .cursor/rules, GEMINI.md and the other files listed below.');
      const list = wanted.slice(0, GH_MAX);
      const skipped = wanted.slice(GH_MAX).map(w => ({ path: w.rel, reason: 'over the ' + GH_MAX + '-file limit' }));
      const entries = [];
      let done = 0;
      const base = 'https://raw.githubusercontent.com/' + ref.owner + '/' + ref.repo + '/' + encodeURIComponent(branch) + '/';
      for (let i = 0; i < list.length; i += 8) {
        await Promise.all(list.slice(i, i + 8).map(async w => {
          try {
            const r = await fetch(base + w.path.split('/').map(encodeURIComponent).join('/'));
            if (!r.ok) throw new Error(String(r.status));
            entries.push({ path: w.rel, bytes: new Uint8Array(await r.arrayBuffer()) });
          } catch (e) { skipped.push({ path: w.rel, reason: 'could not download' }); }
          done++;
          busy(true, 'Reading ' + meta.full_name + ': ' + done + ' / ' + list.length + ' files…');
        }));
      }
      const name = ref.dir ? ref.dir.split('/').pop() : meta.name;
      if (load(entries, skipped, preferTarget, { name })) {
        if (state.manifest && name) {
          state.manifest.agent.name = name;
          // A repo keeps the same agent ID every time it is loaded, so its passport and rings stay together.
          state.manifest.agent.id = 'github:' + (meta.full_name + (ref.dir ? '/' + ref.dir : '')).toLowerCase();
          state.bundle = null; renderAgent(); renderAll();
        }
        toast('Read ' + entries.length + ' agent file' + (entries.length > 1 ? 's' : '') + ' from ' + meta.full_name);
        const share = meta.full_name + (ref.branch || ref.dir ? '/tree/' + branch + (ref.dir ? '/' + ref.dir : '') : '');
        setBadge(share);
        try { history.replaceState(null, '', location.pathname + '?repo=' + encodeURIComponent(share) + (state.target ? '&to=' + state.target : '')); } catch (e) { /* ignore */ }
      }
    } catch (err) {
      showError(err && err.message ? err.message : 'Barge could not read that repo.');
    } finally {
      busy(false);
    }
  }
  $('ghForm').addEventListener('submit', e => { e.preventDefault(); fromGitHub($('ghUrl').value); });

  /* ---------------- Samples ---------------- */
  function loadSample(id, to) {
    const files = S.sampleFiles(id).map(f => ({ path: f.path, bytes: new TextEncoder().encode(f.text) }));
    return load(files, [], to);
  }
  const row = $('sampleRow');
  for (const p of E.PLATFORMS) {
    const s = S.SAMPLES[p.id];
    if (!s) continue;
    const b = el('button', 'sample');
    b.type = 'button';
    b.append(el('span', 'p', p.name), el('span', 'n', s.name), el('span', 'b', s.blurb));
    b.addEventListener('click', () => loadSample(p.id));
    row.appendChild(b);
  }

  const params = new URLSearchParams(location.search);
  const sp = params.get('sample');
  const orchardId = params.get('harbor') || params.get('orchard');
  const repoParam = params.get('repo');
  if (sp && S.SAMPLES[sp]) loadSample(sp, params.get('to'));
  else if (repoParam) { $('ghUrl').value = /github\.com/i.test(repoParam) ? repoParam : 'github.com/' + repoParam; fromGitHub(repoParam, params.get('to')); }
  else if (orchardId) {
    busy(true, 'Opening from Barge Harbor…');
    fetch('/api/orchard/' + encodeURIComponent(orchardId))
      .then(r => r.ok ? r.json() : Promise.reject(new Error('This agent is no longer on the Harbor.')))
      .then(d => load([{ path: E.slug(d.meta.name, 'agent') + '.barge', bytes: new TextEncoder().encode(d.package) }], [], params.get('to')))
      .catch(err => showError(err.message || 'Could not open this agent.'))
      .finally(() => busy(false));
  }
})();
