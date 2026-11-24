(function () {
  'use strict';
  const E = window.BargeEngine;
  const S = window.BargeSamples;
  const C = window.BARGE_CONFIG || {};
  const W = window.BargeWeb3;
  const $ = id => document.getElementById(id);

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
  }

  /* Barge slip: live preview on the sample agents */
  const from = $('from'), to = $('to');
  for (const p of E.PLATFORMS) {
    if (S.SAMPLES[p.id]) from.add(new Option(p.name, p.id));
    to.add(new Option(p.name, p.id));
  }
  from.value = 'claude-code';
  to.value = 'cursor';

  const cache = {};
  const manifestOf = id => (cache[id] = cache[id] || E.readAgent(S.sampleFiles(id)).manifest);
  const WORD = { 'as-is': 'as-is', converted: 'converted', none: 'kept' };

  function summary(items) {
    const c = { 'as-is': 0, converted: 0, none: 0 };
    for (const it of items) c[it.status]++;
    const used = Object.keys(c).filter(k => c[k]);
    return used.length === 1 ? WORD[used[0]] : used.map(k => c[k] + ' ' + WORD[k]).join(' · ');
  }

  function render() {
    if (from.value === to.value) {
      const ids = E.PLATFORMS.map(p => p.id);
      to.value = ids[(ids.indexOf(from.value) + 1) % ids.length];
    }
    const m = manifestOf(from.value);
    const plan = E.plan(m, to.value);
    $('agentName').textContent = m.agent.name;
    $('agentBlurb').textContent = S.SAMPLES[from.value].blurb;

    const ledger = $('ledger');
    ledger.textContent = '';
    for (const k of E.KINDS) {
      const its = plan.items.filter(i => i.kind === k.id);
      if (!its.length) continue;
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'k';
      label.textContent = k.label;
      const sqs = document.createElement('span');
      sqs.className = 'sqs';
      for (const it of its) {
        const s = document.createElement('span');
        s.className = 'sq ' + it.status;
        s.title = it.name + ' · ' + E.STATUS_LABEL[it.status];
        sqs.appendChild(s);
      }
      const st = document.createElement('span');
      st.className = 's';
      st.textContent = summary(its);
      li.append(label, sqs, st);
      ledger.appendChild(li);
    }

    const tally = $('tally');
    tally.textContent = '';
    for (const [k, label] of [['as-is', 'as-is'], ['converted', 'converted'], ['none', 'kept in package']]) {
      const span = document.createElement('span');
      const b = document.createElement('b');
      b.textContent = plan.counts[k];
      span.append(b, label);
      tally.appendChild(span);
    }
    $('runLink').href = 'app.html?sample=' + encodeURIComponent(from.value) + '&to=' + encodeURIComponent(to.value);
  }
  from.addEventListener('change', render);
  to.addEventListener('change', render);
  render();

  /* Platform matrix */
  const table = $('matrix');
  const hr = table.createTHead().insertRow();
  const corner = document.createElement('th');
  corner.scope = 'col';
  corner.innerHTML = '<span class="sr-only">Platform</span>';
  hr.appendChild(corner);
  for (const k of E.KINDS) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = k.label;
    hr.appendChild(th);
  }
  const tbody = table.createTBody();
  for (const p of E.PLATFORMS) {
    const tr = tbody.insertRow();
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = p.name;
    tr.appendChild(th);
    for (const k of E.KINDS) {
      const cap = E.CAPS[p.id][k.id];
      const status = cap === 'native' ? 'as-is' : cap;
      const td = tr.insertCell();
      const note = (E.NOTES[p.id] || {})[k.id];
      td.title = E.STATUS_LABEL[status] + (note ? ': ' + note : '');
      const sq = document.createElement('span');
      sq.className = 'sq ' + status;
      sq.setAttribute('aria-hidden', 'true');
      const sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = E.STATUS_LABEL[status];
      td.append(sq, sr);
    }
  }

  /* Token */
  const ca = (C.ca || '').trim();
  const fill = tpl => (tpl ? tpl.replace('{ca}', ca) : '');
  const caEl = $('ca');
  const links = [['lnkTrade', C.tradeUrl], ['lnkChart', C.chartUrl], ['lnkExplorer', C.explorerUrl]];
  if (ca) {
    caEl.textContent = ca;
    const copy = $('copyCa');
    copy.disabled = false;
    const heroCa = $('heroCa');
    if (heroCa) {
      $('heroCaVal').textContent = ca;
      heroCa.disabled = false;
      $('heroCaCopy').hidden = false;
      heroCa.addEventListener('click', () => copy.click());
    }
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(ca);
      } catch (e) {
        const r = document.createRange();
        r.selectNodeContents(caEl);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        document.execCommand('copy');
        sel.removeAllRanges();
      }
      toast('Contract address copied');
    });
    for (const [id, tpl] of links) {
      const a = $(id);
      const url = fill(tpl);
      if (url) { a.href = url; a.removeAttribute('aria-disabled'); } else a.hidden = true;
    }
  } else {
    caEl.classList.add('pending');
    for (const [id] of links) $(id).setAttribute('tabindex', '-1');
  }
  if (C.x) { const x = $('lnkX'); x.href = C.x; x.hidden = false; }

  /* V2: barge any GitHub repo, straight from the homepage */
  const heroGh = $('heroGh');
  if (heroGh) heroGh.addEventListener('submit', e => {
    e.preventDefault();
    const v = $('heroGhUrl').value.trim().replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/^github\.com\//i, '').replace(/\.git$/, '').replace(/\/+$/, '');
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\/tree\/.+)?$/.test(v)) { toast('Paste a public GitHub repo, like github.com/owner/repo'); $('heroGhUrl').focus(); return; }
    location.href = 'app.html?repo=' + encodeURIComponent(v);
  });

  /* Harbor + lineage counters */
  const orchardP = fetch('/api/orchard').then(r => (r.ok ? r.json() : null)).catch(() => null);
  orchardP.then(d => {
    if (d && Array.isArray(d.items)) $('orchardCount').textContent = d.items.length.toLocaleString('en-US');
  });

  /* Latest crossings: real Harbor publications and on-chain rings, newest first */
  const ago = t => {
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  };
  const pName = id => (E.PLATFORMS.find(p => p.id === id) || {}).name || '';
  const pIdx = i => (E.PLATFORMS[i] || {}).name || 'another platform';
  const shortA = a => (W && W.short ? W.short(a) : a);
  function row(kind, parts, when, href, label, external) {
    const li = document.createElement('li');
    const k = document.createElement('span'); k.className = 'f-kind mono'; k.textContent = kind; li.appendChild(k);
    const t = document.createElement('span'); t.className = 'f-text';
    for (const part of parts) {
      if (typeof part === 'string') t.appendChild(document.createTextNode(part));
      else { const b = document.createElement('b'); b.textContent = part.b; t.appendChild(b); }
    }
    li.appendChild(t);
    const w = document.createElement('span'); w.className = 'f-when mono'; w.textContent = when ? ago(when) : ''; li.appendChild(w);
    const a = document.createElement('a'); a.className = 'f-link'; a.href = href; a.textContent = label;
    if (external) { a.target = '_blank'; a.rel = 'noopener'; }
    li.appendChild(a);
    return li;
  }
  Promise.all([orchardP, W && W.recentRings ? W.recentRings(8).catch(() => null) : null]).then(([d, rings]) => {
    const items = d && Array.isArray(d.items) ? d.items : [];
    const names = new Map(items.filter(i => i.agentHash).map(i => [String(i.agentHash).toLowerCase(), i.name]));
    const ev = [];
    for (const it of items) {
      const when = Date.parse(it.createdAt) || 0;
      ev.push({ when, el: () => row('Harbor', [{ b: it.name || 'An agent' }, ' published' + (pName(it.source) ? ' from ' + pName(it.source) : '') + ' by ' + shortA(it.author || '')], when, 'harbor.html#' + encodeURIComponent(it.id), 'View →') });
    }
    for (const r of rings || []) {
      ev.push({ when: r.time, el: () => row('Crossing', [{ b: names.get(r.agentHash) || 'An agent' }, ' carried from ' + pIdx(r.fromIdx) + ' onto ' + pIdx(r.toIdx)], r.time, W.txUrl(r.tx), 'Blockscout ↗', true) });
    }
    if (!ev.length) return;
    ev.sort((a, b) => b.when - a.when);
    const list = $('feedList');
    for (const e of ev.slice(0, 6)) list.appendChild(e.el());
    $('feed').hidden = false;
  });
  if (W) {
    W.lineageTotals().then(t => {
      if (!t) return;
      $('lnCount').textContent = t.lineages.toLocaleString('en-US');
      $('lnRings').textContent = t.rings.toLocaleString('en-US');
    }).catch(() => {});
  }

  /* Calm fade-in on scroll */
  const targets = document.querySelectorAll('.sec-head, .route, .cargo-list, .matrix-wrap, .dock, .promises, .token, .closing');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -6% 0px' });
    targets.forEach(el => { el.classList.add('reveal'); io.observe(el); });
  }
})();
