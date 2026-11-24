const path = require('path');
const E = require(path.join(__dirname, '../web/site/assets/js/engine.js'));
const S = require(path.join(__dirname, '../web/site/assets/js/samples.js'));
const SECRETS = ['ghp_BargeDemo', 'lin_api_BargeDemo', 'sntrys_BargeDemo', 'figd_BargeDemo', 'ntn_BargeDemo'];
(async () => {
  let n = 0, bad = 0;
  for (const src of Object.keys(S.SAMPLES)) {
    const m = E.readAgent(S.sampleFiles(src)).manifest;
    for (const p of E.PLATFORMS) {
      const b = await E.bundle(m, p.id);
      for (const f of b.files) {
        const t = typeof f.content === 'string' ? f.content : '';
        for (const s of SECRETS) if (t.includes(s)) { bad++; console.log('LEAK', src, '->', p.id, f.path, s); }
        if (new RegExp('fe'+'rry','i').test(t + f.path)) { bad++; console.log('NAME', src, p.id, f.path); }
      }
      if (!b.files.some(f => f.path === 'BARGE-RECEIPT.md')) { bad++; console.log('NO RECEIPT', src, p.id); }
      const back = E.fromPackage(b.packageText);
      if (back.agent.name !== m.agent.name) { bad++; console.log('ROUNDTRIP', src, p.id); }
      n++;
    }
  }
  console.log(`${n} conversions, ${E.PLATFORMS.length} platforms, ${bad} problems`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
