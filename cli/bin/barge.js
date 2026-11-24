#!/usr/bin/env node
/* Barge CLI: moves the AI agent in a folder onto another platform. Reads only, writes a zip. */
'use strict';
const fs = require('fs');
const path = require('path');
let E;
try { E = require('../engine.js'); } catch (e) { E = require('../../site/assets/js/engine.js'); }

const SKIP = new Set(['node_modules', '.git', '.svn', '__pycache__', '.venv', 'venv', '.next', 'dist', 'build']);
const MAX_FILES = 4000, MAX_BYTES = 2 * 1024 * 1024;
const ids = E.PLATFORMS.map(p => p.id);

function help() {
  console.log(`
  bargedot · move your AI agent to any platform        https://bargedot.fun

  Usage
    npx bargedot <platform> [folder]      convert the agent in folder (default: .)
    npx bargedot everywhere [folder]      lay it out for all ${ids.length} platforms at once
    npx bargedot list                     show the platform ids

  Options
    --out <file.zip>    where to write the zip (default: ./<agent>-<platform>.zip)
    --name <name>       agent name to use
    --force             overwrite the zip if it already exists

  Barge only reads your folder. Secrets are stripped before anything is written.
`);
}

function parse(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i];
    else if (a === '--name') o.name = argv[++i];
    else if (a === '--force') o.force = true;
    else if (a === '-h' || a === '--help') o.help = true;
    else o._.push(a);
  }
  return o;
}

function walk(root) {
  const out = [];
  (function go(dir, rel) {
    let list;
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const d of list) {
      if (SKIP.has(d.name)) continue;
      const r = rel ? rel + '/' + d.name : d.name;
      const full = path.join(dir, d.name);
      if (d.isDirectory()) go(full, r);
      else if (d.isFile()) {
        if (!E.classify(r).type) continue;
        if (out.length >= MAX_FILES) throw new Error('More than ' + MAX_FILES + ' agent files. Point bargedot at the folder your agent lives in.');
        const st = fs.statSync(full);
        if (st.size > MAX_BYTES) continue;
        out.push({ path: r, bytes: new Uint8Array(fs.readFileSync(full)) });
      }
    }
  })(root, '');
  return out;
}

(async () => {
  const o = parse(process.argv.slice(2));
  const cmd = (o._[0] || '').toLowerCase();
  if (o.help || !cmd) return help();
  if (cmd === 'list') {
    for (const p of E.PLATFORMS) console.log('  ' + p.id.padEnd(14) + p.name);
    return;
  }
  const everywhere = cmd === 'everywhere' || cmd === 'all';
  const target = everywhere ? null : (ids.includes(cmd) ? cmd : (E.PLATFORMS.find(p => p.name.toLowerCase() === cmd) || {}).id);
  if (!everywhere && !target) { console.error('  Unknown platform "' + cmd + '". Run: npx bargedot list'); process.exit(1); }
  const folder = path.resolve(o._[1] || '.');
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) { console.error('  Not a folder: ' + folder); process.exit(1); }

  const entries = walk(folder);
  if (!entries.length) { console.error('  No agent files in ' + folder + '. Barge looks for CLAUDE.md, AGENTS.md, GEMINI.md, .cursor/rules, .windsurf/rules and the like.'); process.exit(1); }
  const { manifest, report } = E.readAgent(entries, { name: o.name || path.basename(folder) });
  if (o.name) manifest.agent.name = o.name;
  if (!report.recognized.length) { console.error('  No agent files recognized in ' + folder + '.'); process.exit(1); }

  const b = everywhere ? await E.bundleEverywhere(manifest, new Set()) : await E.bundle(manifest, target, new Set());
  const out = path.resolve(o.out || b.filename);
  if (fs.existsSync(out) && !o.force) { console.error('  ' + out + ' already exists. Use --force to overwrite or --out to pick another name.'); process.exit(1); }
  fs.writeFileSync(out, Buffer.from(b.zip));

  const from = manifest.source ? E.platformName(manifest.source) : 'unknown';
  console.log('');
  console.log('  ' + manifest.agent.name + '  ·  ' + from + ' onto ' + (everywhere ? 'all ' + b.platforms + ' platforms' : E.platformName(target)));
  console.log('  ' + report.recognized.length + ' agent file' + (report.recognized.length > 1 ? 's' : '') + ' read' + (manifest.secrets && manifest.secrets.length ? ', ' + manifest.secrets.length + ' secret' + (manifest.secrets.length > 1 ? 's' : '') + ' stripped' : ''));
  if (!everywhere) console.log('  ' + b.plan.counts['as-is'] + ' as-is, ' + b.plan.counts.converted + ' converted, ' + b.plan.counts.none + ' kept in the package');
  console.log('  Saved ' + path.relative(process.cwd(), out) + (b.fingerprint ? '  (fingerprint ' + b.fingerprint.slice(0, 12) + '…)' : ''));
  console.log('');
  console.log('  ' + (everywhere ? 'Unzip it into your project root. BARGE-EVERYWHERE.md has the steps for each platform.' : E.INSTALL[target]));
  console.log('  Ring it on Robinhood Chain or publish it at https://bargedot.fun');
  console.log('');
})().catch(err => { console.error('  bargedot: ' + (err && err.message ? err.message : err)); process.exit(1); });
