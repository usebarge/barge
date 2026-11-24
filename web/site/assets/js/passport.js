/* Agent passports: read straight from the BargePassport contract on Robinhood Chain. */
(function () {
  'use strict';
  const E = window.BargeEngine;
  const W = window.BargeWeb3;
  const C = window.BARGE_CONFIG || {};
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const pad = n => String(n).padStart(6, '0');
  const pName = i => (E.PLATFORMS[i] || {}).name || 'Unknown platform';
  const day = t => t ? new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '·';
  const short = a => W.short(a);

  function none(kicker, title, text) {
    $('noneKicker').textContent = kicker; $('noneTitle').textContent = title; $('noneText').textContent = text;
    $('none').hidden = false;
  }

  function mrz(p) {
    const clean = s => String(s).toUpperCase().replace(/[^A-Z0-9]+/g, '<');
    const l1 = ('P<BARGE<<' + clean(p.name) + '<<' + clean(pName(p.source))).padEnd(44, '<').slice(0, 44);
    const l2 = (pad(p.id) + '<' + clean(p.holder.slice(2, 14)) + '<4663<V' + p.version + '<' + p.fingerprint.slice(0, 12).toUpperCase()).padEnd(44, '<').slice(0, 44);
    return l1 + '\n' + l2;
  }

  async function showOne(id) {
    const [p] = await W.readPassports([id]);
    if (!p) return none('Unknown passport', 'No passport No. ' + pad(id) + '.', 'It has not been issued yet. Passports are numbered in the order they are stamped.');
    document.title = 'Barge | Passport No. ' + pad(p.id) + ' · ' + p.name;
    $('ppNo').textContent = pad(p.id);
    $('ppName').textContent = p.name;
    const h = $('ppHolder'); h.textContent = short(p.holder); h.href = W.addressUrl(p.holder);
    $('ppSource').textContent = pName(p.source);
    $('ppIssued').textContent = day(p.issuedAt);
    $('ppUpdated').textContent = day(p.updatedAt);
    $('ppVersion').textContent = 'v' + p.version;
    $('ppFp').textContent = p.fingerprint.slice(0, 16) + '…' + p.fingerprint.slice(-8);
    $('ppMrz').textContent = mrz(p);
    const list = $('ppRings');
    const rings = await W.ringsOf(p.holder, p.agentId).catch(() => []);
    if (!rings.length) list.appendChild(el('li', 'dim', 'No rings yet. Each barge can add one from the app.'));
    rings.forEach((r, i) => {
      const li = el('li');
      li.append(el('span', 'mono dim', 'Ring ' + (i + 1)), el('span', null, pName(r.fromIdx) + ' onto ' + pName(r.toIdx)), el('span', 'mono dim', day(r.time)));
      list.appendChild(li);
    });
    const acts = $('ppActions');
    try {
      const d = await fetch('/api/orchard').then(r => (r.ok ? r.json() : null));
      const it = d && (d.items || []).find(x => String(x.agentHash).toLowerCase() === p.agentId.toLowerCase() && String(x.author).toLowerCase() === p.holder.toLowerCase());
      if (it) {
        const a = el('a', 'btn sm solid', 'Open in Barge →'); a.href = 'app.html?harbor=' + encodeURIComponent(it.id); acts.appendChild(a);
        const b = el('a', 'btn sm', 'On the Harbor'); b.href = 'harbor.html#' + encodeURIComponent(it.id); acts.appendChild(b);
      }
    } catch (e) { /* the Harbor is optional here */ }
    const copy = el('button', 'btn sm', 'Copy link'); copy.type = 'button';
    copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.origin + '/passport.html?id=' + p.id); toast('Link copied'); } catch (e) { /* ignore */ } });
    acts.appendChild(copy);
    $('one').hidden = false;
  }

  async function showMany(total) {
    const ids = [];
    for (let i = total; i >= 1 && ids.length < 48; i--) ids.push(i);
    const list = await W.readPassports(ids);
    const box = $('ppList');
    for (const p of list) {
      const a = el('a', 'pp-card'); a.href = 'passport.html?id=' + p.id;
      a.append(el('span', 'mono dim', 'No. ' + pad(p.id)), el('b', null, p.name), el('span', 'dim', pName(p.source) + ' · v' + p.version), el('span', 'mono dim', short(p.holder) + ' · ' + day(p.updatedAt)));
      box.appendChild(a);
    }
    $('many').hidden = false;
  }

  let toastTimer;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2200); }

  (async () => {
    if (!W.passportLive()) { $('pTotal').textContent = '0'; return none('Coming with V3', 'Passports open soon.', 'As soon as the passport contract is live, every agent loaded in the app can be issued its passport on Robinhood Chain.'); }
    const total = await W.passportTotal().catch(() => null);
    $('pTotal').textContent = total == null ? '·' : total.toLocaleString('en-US');
    const id = Number(new URLSearchParams(location.search).get('id'));
    if (id > 0) return showOne(id);
    if (!total) return none('Not issued yet', 'No passport yet.', 'Load an agent in the app and issue the first one from the Share card.');
    return showMany(total);
  })().catch(() => none('Network', 'Robinhood Chain did not answer.', 'Try again in a moment.'));
})();
