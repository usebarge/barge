/*!
 * Barge engine — reads an AI agent from one platform, builds a universal
 * manifest, and writes it out for another platform. Runs fully client-side.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BargeEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FORMAT = 'barge/1';
  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8');

  /* ------------------------------------------------------------------ */
  /* Platforms and capabilities                                          */
  /* ------------------------------------------------------------------ */

  const PLATFORMS = [
    { id: 'claude-code', name: 'Claude Code', main: 'CLAUDE.md' },
    { id: 'codex', name: 'Codex CLI', main: 'AGENTS.md' },
    { id: 'cursor', name: 'Cursor', main: '.cursor/rules' },
    { id: 'gemini-cli', name: 'Gemini CLI', main: 'GEMINI.md' },
    { id: 'openclaw', name: 'OpenClaw', main: 'AGENTS.md + SOUL.md' },
    { id: 'windsurf', name: 'Windsurf', main: '.windsurf/rules' },
    { id: 'cline', name: 'Cline', main: '.clinerules' },
    { id: 'goose', name: 'Goose', main: '.goosehints' },
    { id: 'aider', name: 'Aider', main: 'CONVENTIONS.md' },
    { id: 'hermes', name: 'Hermes Agent', main: 'SOUL.md + AGENTS.md' },
    // Appended only: the index of each platform is written on-chain by the Lineage.
    { id: 'copilot', name: 'GitHub Copilot', main: '.github/copilot-instructions.md' },
    { id: 'opencode', name: 'OpenCode', main: 'AGENTS.md + opencode.json' },
    { id: 'kiro', name: 'Kiro', main: '.kiro/steering' },
    { id: 'roo', name: 'Roo Code', main: '.roo/rules' },
    { id: 'kilo', name: 'Kilo Code', main: '.kilo/rules + kilo.jsonc' },
    { id: 'antigravity', name: 'Antigravity', main: 'AGENTS.md + .agents/' },
    { id: 'qwen', name: 'Qwen Code', main: 'QWEN.md' },
    { id: 'droid', name: 'Factory Droid', main: 'AGENTS.md + .factory/' },
    { id: 'zed', name: 'Zed', main: '.rules' },
    { id: 'continue', name: 'Continue', main: '.continue/rules' },
    { id: 'junie', name: 'Junie', main: '.junie/AGENTS.md' },
    { id: 'amp', name: 'Amp', main: 'AGENTS.md + .amp/' },
    { id: 'augment', name: 'Augment', main: '.augment/rules' },
    { id: 'trae', name: 'Trae', main: '.trae/rules' },
    { id: 'crush', name: 'Crush', main: 'CRUSH.md' }
  ];
  const PLATFORM_IDS = PLATFORMS.map(p => p.id);
  const platformName = id => (PLATFORMS.find(p => p.id === id) || { name: id }).name;

  const KINDS = [
    { id: 'identity', label: 'Identity' },
    { id: 'instructions', label: 'Instructions' },
    { id: 'memory', label: 'Memory' },
    { id: 'skills', label: 'Skills' },
    { id: 'commands', label: 'Commands' },
    { id: 'subagents', label: 'Subagents' },
    { id: 'tools', label: 'Tools (MCP)' },
    { id: 'permissions', label: 'Permissions' },
    { id: 'routines', label: 'Routines' }
  ];

  // native = carried as-is · converted = rewritten into the target's format · none = no equivalent
  const CAPS = {
    'claude-code': { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'native', commands: 'native', subagents: 'native', tools: 'native', permissions: 'native', routines: 'none' },
    codex: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'native', commands: 'native', subagents: 'none', tools: 'native', permissions: 'converted', routines: 'none' },
    cursor: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'converted', commands: 'native', subagents: 'none', tools: 'native', permissions: 'none', routines: 'none' },
    'gemini-cli': { identity: 'converted', instructions: 'native', memory: 'native', skills: 'converted', commands: 'converted', subagents: 'none', tools: 'native', permissions: 'none', routines: 'none' },
    openclaw: { identity: 'native', instructions: 'native', memory: 'native', skills: 'native', commands: 'converted', subagents: 'none', tools: 'converted', permissions: 'none', routines: 'converted' },
    windsurf: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'converted', commands: 'native', subagents: 'none', tools: 'native', permissions: 'none', routines: 'none' },
    cline: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'native', commands: 'native', subagents: 'none', tools: 'native', permissions: 'none', routines: 'none' },
    goose: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'converted', commands: 'none', subagents: 'none', tools: 'native', permissions: 'none', routines: 'none' },
    aider: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'converted', commands: 'none', subagents: 'none', tools: 'none', permissions: 'none', routines: 'none' },
    hermes: { identity: 'native', instructions: 'native', memory: 'native', skills: 'native', commands: 'converted', subagents: 'none', tools: 'native', permissions: 'none', routines: 'none' },
    copilot: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'native', commands: 'converted', subagents: 'converted', tools: 'native', permissions: 'none', routines: 'none' },
    opencode: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'native', commands: 'native', subagents: 'converted', tools: 'native', permissions: 'converted', routines: 'none' },
    kiro: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'native', commands: 'converted', subagents: 'none', tools: 'native', permissions: 'none', routines: 'none' },
    roo: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'native', commands: 'native', subagents: 'converted', tools: 'native', permissions: 'none', routines: 'none' },
    kilo: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'native', commands: 'native', subagents: 'converted', tools: 'native', permissions: 'converted', routines: 'none' },
    antigravity: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'native', commands: 'converted', subagents: 'converted', tools: 'native', permissions: 'none', routines: 'none' },
    qwen: { identity: 'converted', instructions: 'native', memory: 'native', skills: 'native', commands: 'converted', subagents: 'converted', tools: 'native', permissions: 'converted', routines: 'none' },
    droid: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'native', commands: 'native', subagents: 'converted', tools: 'native', permissions: 'none', routines: 'none' },
    zed: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'converted', commands: 'none', subagents: 'none', tools: 'native', permissions: 'none', routines: 'none' },
    continue: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'converted', commands: 'converted', subagents: 'none', tools: 'native', permissions: 'none', routines: 'none' },
    junie: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'native', commands: 'converted', subagents: 'none', tools: 'native', permissions: 'none', routines: 'none' },
    amp: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'native', commands: 'converted', subagents: 'none', tools: 'native', permissions: 'none', routines: 'none' },
    augment: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'native', commands: 'native', subagents: 'none', tools: 'native', permissions: 'none', routines: 'none' },
    trae: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'native', commands: 'converted', subagents: 'none', tools: 'native', permissions: 'none', routines: 'none' },
    crush: { identity: 'converted', instructions: 'native', memory: 'converted', skills: 'native', commands: 'converted', subagents: 'none', tools: 'native', permissions: 'none', routines: 'none' }
  };

  const KEPT = 'Kept in the .barge package so nothing is lost.';
  const NOTES = {
    'claude-code': {
      identity: 'Written at the top of CLAUDE.md.',
      memory: 'Facts become a Memory section in CLAUDE.md.',
      routines: 'Claude Code has no scheduled routines. ' + KEPT
    },
    codex: {
      identity: 'Written at the top of AGENTS.md.',
      memory: 'Facts become a Memory section in AGENTS.md.',
      subagents: 'Codex CLI has no subagents. ' + KEPT,
      permissions: 'Codex uses an approval policy, not rule lists. Set to on-request; your rules stay as comments.',
      routines: 'Codex CLI has no scheduled routines. ' + KEPT
    },
    cursor: {
      identity: 'Becomes an always-on rule.',
      memory: 'Becomes an always-on memory rule.',
      skills: 'Becomes an agent-requested rule. Its files travel alongside.',
      subagents: 'Cursor has no file-based subagents. ' + KEPT,
      permissions: 'Cursor has no file-based permission rules. ' + KEPT,
      routines: 'Cursor has no scheduled routines. ' + KEPT
    },
    'gemini-cli': {
      identity: 'Written at the top of GEMINI.md.',
      skills: 'Copied to .gemini/skills and indexed in GEMINI.md.',
      commands: 'Rewritten as a TOML command. $ARGUMENTS becomes {{args}}.',
      subagents: 'Gemini CLI has no file-based subagents. ' + KEPT,
      permissions: 'Gemini CLI has no matching rule format. ' + KEPT,
      routines: 'Gemini CLI has no scheduled routines. ' + KEPT
    },
    openclaw: {
      commands: 'Becomes a skill the agent can call.',
      tools: 'Listed in TOOLS.md for you to connect.',
      routines: 'Written to HEARTBEAT.paused.md. Rename it to HEARTBEAT.md to switch it on.',
      subagents: 'OpenClaw has no file-based subagents. ' + KEPT,
      permissions: 'OpenClaw has no matching rule format. ' + KEPT
    },
    windsurf: {
      identity: 'Becomes an always-on rule.',
      memory: 'Becomes an always-on memory rule.',
      skills: 'Becomes a model-decision rule. Its files travel alongside.',
      subagents: 'Windsurf has no file-based subagents. ' + KEPT,
      permissions: 'Windsurf has no file-based permission rules. ' + KEPT,
      routines: 'Windsurf has no scheduled routines. ' + KEPT
    },
    cline: {
      identity: 'Becomes a rule in .clinerules.',
      memory: 'Becomes a memory rule in .clinerules.',
      subagents: 'Cline has no file-based subagents. ' + KEPT,
      permissions: 'Cline sets command permissions outside files. ' + KEPT,
      routines: 'Cline has no scheduled routines. ' + KEPT
    },
    goose: {
      identity: 'Written at the top of .goosehints.',
      memory: 'Facts become a Memory section in .goosehints.',
      skills: 'Copied to .goose/skills and indexed in .goosehints.',
      commands: 'Goose uses recipes, not slash commands. ' + KEPT,
      subagents: 'Goose has no file-based subagents. ' + KEPT,
      permissions: 'Goose has no matching rule format. ' + KEPT,
      routines: 'Goose has no scheduled routines. ' + KEPT
    },
    aider: {
      identity: 'Written at the top of CONVENTIONS.md.',
      memory: 'Facts become a Memory section in CONVENTIONS.md.',
      skills: 'Copied next to CONVENTIONS.md and indexed in it.',
      commands: 'Aider has no custom commands. ' + KEPT,
      subagents: 'Aider has no subagents. ' + KEPT,
      tools: 'Aider does not run MCP servers. ' + KEPT,
      permissions: 'Aider has no matching rule format. ' + KEPT,
      routines: 'Aider has no scheduled routines. ' + KEPT
    },
    hermes: {
      commands: 'Becomes a skill the agent can call.',
      subagents: 'Hermes Agent has no file-based subagents. ' + KEPT,
      permissions: 'Hermes Agent keeps its own command allowlist. ' + KEPT,
      routines: 'Hermes Agent cron jobs use their own format. ' + KEPT
    },
    copilot: {
      identity: 'Written at the top of .github/copilot-instructions.md.',
      memory: 'Facts become a Memory section in .github/copilot-instructions.md.',
      commands: 'Becomes a prompt file. $ARGUMENTS becomes ${input:args}.',
      subagents: 'Becomes a custom agent. Its tool list is not carried over.',
      permissions: 'Copilot has no file-based permission rules. ' + KEPT,
      routines: 'Copilot has no scheduled routines. ' + KEPT
    },
    opencode: {
      identity: 'Written at the top of AGENTS.md.',
      memory: 'Facts become a Memory section in AGENTS.md.',
      subagents: 'Becomes an OpenCode subagent. Its tool list is not carried over.',
      permissions: 'Bash, Edit and WebFetch rules become OpenCode permission rules. Other rules stay in the .barge package.',
      routines: 'OpenCode has no scheduled routines. ' + KEPT
    },
    kiro: {
      identity: 'Becomes an always-on steering file.',
      memory: 'Becomes an always-on memory steering file.',
      commands: 'Becomes a manual steering file you call with /.',
      subagents: 'Kiro has no matching file format for subagents. ' + KEPT,
      permissions: 'Kiro has no file-based permission rules. ' + KEPT,
      routines: 'Kiro has no scheduled routines. ' + KEPT
    },
    roo: {
      identity: 'Becomes a rule in .roo/rules.',
      memory: 'Becomes a memory rule in .roo/rules.',
      subagents: 'Becomes a custom mode in .roomodes.',
      permissions: 'Roo Code sets approvals outside files. ' + KEPT,
      routines: 'Roo Code has no scheduled routines. ' + KEPT
    },
    kilo: {
      identity: 'Becomes a rule in .kilo/rules.',
      memory: 'Becomes a memory rule in .kilo/rules.',
      subagents: 'Becomes a Kilo agent. Its tool list is not carried over.',
      permissions: 'Bash, Edit and WebFetch rules become Kilo permission rules. Other rules stay in the .barge package.',
      routines: 'Kilo Code has no scheduled routines. ' + KEPT
    },
    antigravity: {
      identity: 'Written at the top of AGENTS.md.',
      memory: 'Facts become a Memory section in AGENTS.md.',
      commands: 'Becomes a skill, which Antigravity also offers as a slash command.',
      subagents: 'Becomes a custom agent. Its tool list is not carried over.',
      permissions: 'Antigravity sets permissions outside these files. ' + KEPT,
      routines: 'Antigravity has no scheduled routines. ' + KEPT
    },
    qwen: {
      identity: 'Written at the top of QWEN.md.',
      commands: 'Rewritten as a TOML command. $ARGUMENTS becomes {{args}}.',
      subagents: 'Becomes a Qwen subagent. Its tool list is not carried over.',
      permissions: 'Copied to permissions in .qwen/settings.json. Check the tool names.',
      routines: 'Qwen Code has no scheduled routines. ' + KEPT
    },
    droid: {
      identity: 'Written at the top of AGENTS.md.',
      memory: 'Facts become a Memory section in AGENTS.md.',
      subagents: 'Becomes a custom droid. Its tool list is not carried over.',
      permissions: 'Droid sets autonomy outside these files. ' + KEPT,
      routines: 'Factory Droid has no scheduled routines. ' + KEPT
    },
    zed: {
      identity: 'Written at the top of .rules.',
      memory: 'Facts become a Memory section in .rules.',
      skills: 'Copied to .zed/skills and indexed in .rules.',
      commands: 'Zed has no file-based slash commands. ' + KEPT,
      subagents: 'Zed has no file-based subagents. ' + KEPT,
      permissions: 'Zed has no file-based permission rules. ' + KEPT,
      routines: 'Zed has no scheduled routines. ' + KEPT
    },
    continue: {
      identity: 'Becomes an always-on rule.',
      memory: 'Becomes an always-on memory rule.',
      skills: 'Copied to .continue/skills and indexed in a rule.',
      commands: 'Becomes an invokable prompt. $ARGUMENTS becomes {{{ input }}}.',
      subagents: 'Continue has no file-based subagents. ' + KEPT,
      permissions: 'Continue has no file-based permission rules. ' + KEPT,
      routines: 'Continue has no scheduled routines. ' + KEPT
    },
    junie: {
      identity: 'Written at the top of .junie/AGENTS.md.',
      memory: 'Facts become a Memory section in .junie/AGENTS.md.',
      commands: 'Becomes a skill the agent can call.',
      subagents: 'Junie has no file-based subagents. ' + KEPT,
      permissions: 'Junie sets approvals outside these files. ' + KEPT,
      routines: 'Junie has no scheduled routines. ' + KEPT
    },
    amp: {
      identity: 'Written at the top of AGENTS.md.',
      memory: 'Facts become a Memory section in AGENTS.md.',
      commands: 'Becomes a skill the agent can call.',
      subagents: 'Amp has no file-based subagents. ' + KEPT,
      permissions: 'Amp permission rules use their own format. ' + KEPT,
      routines: 'Amp has no scheduled routines. ' + KEPT
    },
    augment: {
      identity: 'Becomes an always-applied rule.',
      memory: 'Becomes an always-applied memory rule.',
      subagents: 'Augment has no matching file format for subagents. ' + KEPT,
      permissions: 'Augment sets tool permissions outside these files. ' + KEPT,
      routines: 'Augment has no scheduled routines. ' + KEPT
    },
    trae: {
      identity: 'Becomes an always-on rule.',
      memory: 'Becomes an always-on memory rule.',
      commands: 'Becomes a skill the agent can call.',
      subagents: 'Trae has no matching file format for subagents. ' + KEPT,
      permissions: 'Trae has no file-based permission rules. ' + KEPT,
      routines: 'Trae has no scheduled routines. ' + KEPT
    },
    crush: {
      identity: 'Written at the top of CRUSH.md.',
      memory: 'Facts become a Memory section in CRUSH.md.',
      commands: 'Becomes a skill the agent can call.',
      subagents: 'Crush has no file-based subagents. ' + KEPT,
      permissions: 'Crush only lists allowed tool names. ' + KEPT,
      routines: 'Crush has no scheduled routines. ' + KEPT
    }
  };

  /* ------------------------------------------------------------------ */
  /* Small utilities                                                     */
  /* ------------------------------------------------------------------ */

  function uid() {
    const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    let s = '';
    for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s.slice(0, 8) + '-' + s.slice(8, 12) + '-4' + s.slice(13, 16) + '-a' + s.slice(17, 20) + '-' + s.slice(20, 32);
  }

  function slug(s, fallback) {
    const out = String(s || '')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
    return out || fallback || 'item';
  }

  function uniqueSlug(base, used) {
    let s = base, n = 2;
    while (used.has(s)) s = base + '-' + n++;
    used.add(s);
    return s;
  }

  function envName(s) {
    return String(s || 'SECRET').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'SECRET';
  }

  function normPath(p) {
    p = String(p || '').replace(/\\/g, '/');
    if (/^[a-zA-Z]:\//.test(p) || p.startsWith('/')) p = p.replace(/^[a-zA-Z]:\//, '').replace(/^\/+/, '');
    const parts = [];
    for (const seg of p.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') return null;
      parts.push(seg);
    }
    return parts.join('/');
  }

  function safeRel(p) {
    const n = normPath(p);
    return n && !/^[a-zA-Z]:/.test(n) ? n : null;
  }

  function isBinary(bytes) {
    const n = Math.min(bytes.length, 8000);
    for (let i = 0; i < n; i++) if (bytes[i] === 0) return true;
    return false;
  }

  function toBytes(x) {
    if (x instanceof Uint8Array) return x;
    if (typeof x === 'string') return enc.encode(x);
    if (x && x.buffer instanceof ArrayBuffer) return new Uint8Array(x.buffer, x.byteOffset || 0, x.byteLength);
    if (x instanceof ArrayBuffer) return new Uint8Array(x);
    return enc.encode(String(x == null ? '' : x));
  }

  function b64encode(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  function b64decode(str) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(str, 'base64'));
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  const clone = o => JSON.parse(JSON.stringify(o));

  // JSON with comments and trailing commas (JSONC), as used by VS Code, Zed, OpenCode and Kilo.
  function stripJsonc(src) {
    src = String(src || '').replace(/^\uFEFF/, '');
    let out = '', i = 0, str = false;
    const n = src.length;
    while (i < n) {
      const c = src[i];
      if (str) {
        out += c;
        if (c === '\\') { out += src[i + 1] || ''; i += 2; continue; }
        if (c === '"') str = false;
        i++;
        continue;
      }
      if (c === '"') { str = true; out += c; i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
      if (c === ',') {
        let j = i + 1;
        while (j < n && /\s/.test(src[j])) j++;
        if (src[j] === '}' || src[j] === ']') { i++; continue; }
      }
      out += c;
      i++;
    }
    return out;
  }
  const parseJsonc = text => JSON.parse(stripJsonc(text));

  // Brings every environment reference style back to ${NAME}.
  function normRef(v, origin) {
    let s = String(v);
    s = s.replace(/\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g, '${$1}');
    // VS Code input variables are prompted secrets: they come back as environment references.
    s = s.replace(/\$\{input:([A-Za-z0-9_.-]+)\}/g, (_, id) => '${' + id.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase() + '}');
    s = s.replace(/(^|[^$])\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g, '$1${$2}');
    if (origin === 'crush') s = s.replace(/\$(?!\{)([A-Za-z_][A-Za-z0-9_]*)/g, '${$1}');
    return s;
  }
  const trimLines = s => String(s || '').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/^\n+|\n+$/g, '');

  /* ------------------------------------------------------------------ */
  /* Frontmatter (YAML subset)                                           */
  /* ------------------------------------------------------------------ */

  function parseScalar(v) {
    v = v.trim();
    if (v === '') return '';
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      if (v.startsWith('"')) { try { return JSON.parse(v); } catch (e) { return v.slice(1, -1); } }
      return v.slice(1, -1).replace(/''/g, "'");
    }
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(',').map(x => parseScalar(x)).filter(x => x !== '');
    return v;
  }

  function parseFrontmatter(text) {
    text = String(text || '').replace(/^﻿/, '').replace(/\r\n/g, '\n');
    const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
    if (!m) return { data: {}, raw: {}, body: text };
    const data = {}, raw = {};
    let lastKey = null;
    for (const line of m[1].split('\n')) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const item = /^\s+-\s+(.*)$/.exec(line);
      if (item && lastKey) {
        if (!Array.isArray(data[lastKey])) data[lastKey] = [];
        data[lastKey].push(parseScalar(item[1]));
        continue;
      }
      const kv = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line);
      if (kv) {
        lastKey = kv[1];
        const v = kv[2];
        raw[lastKey] = v.trim();
        data[lastKey] = (v === '|' || v === '>') ? '' : parseScalar(v);
      } else if (lastKey && typeof data[lastKey] === 'string') {
        data[lastKey] = (data[lastKey] ? data[lastKey] + ' ' : '') + line.trim();
      }
    }
    return { data, raw, body: text.slice(m[0].length) };
  }

  function yamlValue(v) {
    if (typeof v === 'boolean' || typeof v === 'number') return String(v);
    if (Array.isArray(v)) return '[' + v.map(yamlValue).join(', ') + ']';
    v = String(v);
    if (v === '' || /^[\s'"\[\]{}>|*&!%@`#,?-]/.test(v) || /: |\s#|\n|^(true|false|null|yes|no)$/i.test(v) || /\s$/.test(v)) return JSON.stringify(v);
    return v;
  }

  function writeFrontmatter(data, body) {
    const keys = Object.keys(data).filter(k => data[k] !== undefined && data[k] !== null && data[k] !== '');
    if (!keys.length) return trimLines(body) + '\n';
    return '---\n' + keys.map(k => k + ': ' + (k === 'globs' && typeof data[k] === 'string' ? data[k] : yamlValue(data[k]))).join('\n') + '\n---\n\n' + trimLines(body) + '\n';
  }

  /* ------------------------------------------------------------------ */
  /* TOML (subset sufficient for agent configs)                          */
  /* ------------------------------------------------------------------ */

  function parseTOML(src) {
    src = String(src || '').replace(/^﻿/, '').replace(/\r\n/g, '\n');
    const out = {};
    let cur = out, i = 0;
    const n = src.length;
    const err = m => new Error('TOML ' + m + ' (line ' + (src.slice(0, i).split('\n').length) + ')');
    const ws = () => { while (i < n && (src[i] === ' ' || src[i] === '\t')) i++; };
    const skipLine = () => { while (i < n && src[i] !== '\n') i++; };
    const wsnl = () => {
      for (;;) {
        ws();
        if (src[i] === '#') skipLine();
        if (src[i] === '\n') { i++; continue; }
        break;
      }
    };
    function esc() {
      i++;
      const c = src[i++];
      switch (c) {
        case 'n': return '\n'; case 't': return '\t'; case 'r': return '\r';
        case 'b': return '\b'; case 'f': return '\f'; case '"': return '"'; case '\\': return '\\';
        case 'u': { const h = src.substr(i, 4); i += 4; return String.fromCharCode(parseInt(h, 16)); }
        case 'U': { const h = src.substr(i, 8); i += 8; return String.fromCodePoint(parseInt(h, 16)); }
        case '\n': case ' ': case '\t': { i--; while (i < n && /\s/.test(src[i])) i++; return ''; }
        default: return c;
      }
    }
    function str() {
      if (src.startsWith('"""', i)) {
        i += 3; if (src[i] === '\n') i++;
        let s = '';
        while (i < n && !src.startsWith('"""', i)) s += src[i] === '\\' ? esc() : src[i++];
        if (i >= n) throw err('unterminated string');
        i += 3;
        while (src[i] === '"') { s += '"'; i++; }
        return s;
      }
      if (src.startsWith("'''", i)) {
        i += 3; if (src[i] === '\n') i++;
        const e = src.indexOf("'''", i);
        if (e < 0) throw err('unterminated string');
        let s = src.slice(i, e); i = e + 3;
        while (src[i] === "'") { s += "'"; i++; }
        return s;
      }
      if (src[i] === '"') {
        i++;
        let s = '';
        while (i < n && src[i] !== '"') {
          if (src[i] === '\n') throw err('newline in string');
          s += src[i] === '\\' ? esc() : src[i++];
        }
        i++;
        return s;
      }
      if (src[i] === "'") {
        i++;
        const e = src.indexOf("'", i);
        if (e < 0) throw err('unterminated string');
        const s = src.slice(i, e); i = e + 1;
        return s;
      }
      throw err('expected string');
    }
    function key() {
      ws();
      if (src[i] === '"' || src[i] === "'") return str();
      const s = i;
      while (i < n && /[A-Za-z0-9_-]/.test(src[i])) i++;
      if (s === i) throw err('expected key');
      return src.slice(s, i);
    }
    function keyPath() {
      const ks = [key()];
      ws();
      while (src[i] === '.') { i++; ks.push(key()); ws(); }
      return ks;
    }
    function setPath(o, kp, v) {
      let t = o;
      for (let j = 0; j < kp.length - 1; j++) {
        if (typeof t[kp[j]] !== 'object' || t[kp[j]] === null || Array.isArray(t[kp[j]])) t[kp[j]] = {};
        t = t[kp[j]];
      }
      t[kp[kp.length - 1]] = v;
    }
    function value() {
      ws();
      const c = src[i];
      if (c === '"' || c === "'") return str();
      if (c === '[') {
        i++;
        const arr = [];
        for (;;) {
          wsnl();
          if (src[i] === ']') { i++; break; }
          arr.push(value());
          wsnl();
          if (src[i] === ',') { i++; continue; }
          if (src[i] === ']') { i++; break; }
          throw err('bad array');
        }
        return arr;
      }
      if (c === '{') {
        i++;
        const o = {};
        ws();
        if (src[i] === '}') { i++; return o; }
        for (;;) {
          const kp = keyPath();
          ws();
          if (src[i] !== '=') throw err('expected =');
          i++;
          setPath(o, kp, value());
          ws();
          if (src[i] === ',') { i++; continue; }
          if (src[i] === '}') { i++; break; }
          throw err('bad inline table');
        }
        return o;
      }
      const s = i;
      while (i < n && !/[,\]}\n#]/.test(src[i])) i++;
      const raw = src.slice(s, i).trim();
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      const num = Number(raw.replace(/_/g, ''));
      if (raw !== '' && !isNaN(num) && /^[+-]?[\d._]+(e[+-]?\d+)?$/i.test(raw)) return num;
      if (raw === '') throw err('expected value');
      return raw;
    }
    function table(kp, isArr) {
      let t = out;
      for (let j = 0; j < kp.length; j++) {
        const k = kp[j];
        if (j === kp.length - 1 && isArr) {
          if (!Array.isArray(t[k])) t[k] = [];
          const o = {};
          t[k].push(o);
          return o;
        }
        if (t[k] === undefined || typeof t[k] !== 'object' || t[k] === null) t[k] = {};
        t = Array.isArray(t[k]) ? t[k][t[k].length - 1] : t[k];
      }
      return t;
    }
    for (;;) {
      wsnl();
      if (i >= n) break;
      if (src[i] === '[') {
        const isArr = src[i + 1] === '[';
        i += isArr ? 2 : 1;
        const kp = keyPath();
        ws();
        if (src[i] !== ']') throw err('expected ]');
        i += isArr ? 2 : 1;
        cur = table(kp, isArr);
      } else {
        const kp = keyPath();
        ws();
        if (src[i] !== '=') throw err('expected =');
        i++;
        setPath(cur, kp, value());
      }
      ws();
      if (src[i] === '#') skipLine();
      if (i < n && src[i] !== '\n') throw err('unexpected text');
    }
    return out;
  }

  const tomlKey = k => /^[A-Za-z0-9_-]+$/.test(k) ? k : JSON.stringify(k);

  function tomlString(s) {
    s = String(s);
    if (s.includes('\n')) {
      return '"""\n' + s.replace(/\\/g, '\\\\').replace(/"""/g, '""\\"') + (s.endsWith('"') ? '\\\n' : '') + '"""';
    }
    return JSON.stringify(s).replace(/\\\//g, '/');
  }

  function tomlValue(v) {
    if (Array.isArray(v)) return '[' + v.map(tomlValue).join(', ') + ']';
    if (typeof v === 'boolean' || typeof v === 'number') return String(v);
    if (v && typeof v === 'object') return '{ ' + Object.keys(v).map(k => tomlKey(k) + ' = ' + tomlValue(v[k])).join(', ') + ' }';
    return tomlString(v);
  }

  /* ------------------------------------------------------------------ */
  /* YAML (subset sufficient for agent configs)                          */
  /* ------------------------------------------------------------------ */

  function yamlStripComment(s) {
    let q = null;
    for (let k = 0; k < s.length; k++) {
      const c = s[k];
      if (q) { if (c === q && s[k - 1] !== '\\') q = null; }
      else if (c === '"' || c === "'") q = c;
      else if (c === '#' && (k === 0 || /\s/.test(s[k - 1]))) return s.slice(0, k).trimEnd();
    }
    return s.trimEnd();
  }

  function yamlFlow(v) {
    let p = 0;
    const ws = () => { while (p < v.length && /\s/.test(v[p])) p++; };
    function key() {
      ws();
      if (v[p] === '"' || v[p] === "'") return val();
      const st = p;
      while (p < v.length && v[p] !== ':') p++;
      return v.slice(st, p).trim();
    }
    function val() {
      ws();
      const c = v[p];
      if (c === '[') {
        p++; const a = []; ws();
        if (v[p] === ']') { p++; return a; }
        for (;;) { a.push(val()); ws(); if (v[p] === ',') { p++; continue; } if (v[p] === ']') { p++; break; } throw new Error('YAML: bad list'); }
        return a;
      }
      if (c === '{') {
        p++; const o = {}; ws();
        if (v[p] === '}') { p++; return o; }
        for (;;) { const k = key(); ws(); if (v[p] !== ':') throw new Error('YAML: bad map'); p++; o[k] = val(); ws(); if (v[p] === ',') { p++; continue; } if (v[p] === '}') { p++; break; } throw new Error('YAML: bad map'); }
        return o;
      }
      if (c === '"') { let e = p + 1; while (e < v.length && (v[e] !== '"' || v[e - 1] === '\\')) e++; const out = JSON.parse(v.slice(p, e + 1)); p = e + 1; return out; }
      if (c === "'") { let e = p + 1; for (;;) { e = v.indexOf("'", e); if (e < 0) throw new Error('YAML: bad string'); if (v[e + 1] === "'") { e += 2; continue; } break; } const out = v.slice(p + 1, e).replace(/''/g, "'"); p = e + 1; return out; }
      const st = p;
      while (p < v.length && !/[,\]}]/.test(v[p])) p++;
      return yamlScalar(v.slice(st, p));
    }
    return val();
  }

  function yamlScalar(v) {
    v = String(v).trim();
    if (v === '' || v === '~' || v === 'null') return null;
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (v[0] === '"') { try { return JSON.parse(v); } catch (e) { return v.slice(1, -1); } }
    if (v[0] === "'") return v.slice(1, -1).replace(/''/g, "'");
    if (v[0] === '[' || v[0] === '{') return yamlFlow(v);
    return v;
  }

  function parseYAML(src) {
    const toks = [];
    for (const raw of String(src || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n')) {
      if (!raw.trim() || /^\s*#/.test(raw) || /^(---|\.\.\.)\s*$/.test(raw)) continue;
      const indent = raw.match(/^ */)[0].length;
      toks.push({ indent, text: yamlStripComment(raw.slice(indent)), raw: raw.slice(indent) });
    }
    let i = 0;
    const isItem = t => t.text === '-' || t.text.startsWith('- ');
    function block(ind) {
      if (i >= toks.length) return null;
      return isItem(toks[i]) ? list(ind) : map(ind);
    }
    function list(ind) {
      const out = [];
      while (i < toks.length && toks[i].indent === ind && isItem(toks[i])) {
        const rest = toks[i].text === '-' ? '' : toks[i].text.slice(2).trim();
        i++;
        if (!rest) { out.push(i < toks.length && toks[i].indent > ind ? block(toks[i].indent) : null); continue; }
        if (!/^[\[{"']/.test(rest) && /^[^:]+?\s*:(\s|$)/.test(rest)) {
          toks.splice(i, 0, { indent: ind + 2, text: rest, raw: rest });
          out.push(map(ind + 2));
        } else out.push(yamlScalar(rest));
      }
      return out;
    }
    function map(ind) {
      const out = {};
      while (i < toks.length && toks[i].indent === ind && !isItem(toks[i])) {
        const m = /^("[^"]*"|'[^']*'|[^:]+?)\s*:(?:\s+(.*)|$)$/.exec(toks[i].text);
        if (!m) throw new Error('YAML: cannot read "' + toks[i].text.slice(0, 40) + '"');
        let k = m[1];
        if (/^["']/.test(k)) k = k.slice(1, -1);
        const v = m[2] == null ? '' : m[2].trim();
        i++;
        if (v === '') {
          if (i < toks.length && (toks[i].indent > ind || (toks[i].indent === ind && isItem(toks[i])))) out[k] = block(toks[i].indent);
          else out[k] = null;
        } else if (/^[|>][-+]?$/.test(v)) {
          const parts = []; const base = i < toks.length ? toks[i].indent : 0;
          while (i < toks.length && toks[i].indent > ind) { parts.push(' '.repeat(toks[i].indent - base) + toks[i].raw); i++; }
          out[k] = v[0] === '>' ? parts.join(' ') : parts.join('\n');
        } else out[k] = yamlScalar(v);
      }
      return out;
    }
    if (!toks.length) return {};
    const res = block(toks[0].indent);
    if (i < toks.length) throw new Error('YAML: unexpected indentation near "' + toks[i].text.slice(0, 40) + '"');
    return res;
  }

  const yKey = k => /^[A-Za-z0-9_-]+$/.test(k) ? k : JSON.stringify(k);
  const yScalar = v => typeof v === 'string' ? JSON.stringify(v) : String(v);
  function toYAML(v, indent) {
    indent = indent || 0;
    const pad = ' '.repeat(indent);
    if (Array.isArray(v)) {
      if (!v.length) return ' []';
      if (v.every(x => x === null || typeof x !== 'object')) return ' [' + v.map(yScalar).join(', ') + ']';
      return '\n' + v.map(x => pad + '-' + toYAML(x, indent + 2).replace(/^\n\s*/, ' ')).join('\n');
    }
    if (v && typeof v === 'object') {
      const ks = Object.keys(v);
      if (!ks.length) return ' {}';
      return '\n' + ks.map(k => pad + yKey(k) + ':' + toYAML(v[k], indent + 2)).join('\n');
    }
    return ' ' + yScalar(v);
  }

  /* ------------------------------------------------------------------ */
  /* Markdown helpers                                                    */
  /* ------------------------------------------------------------------ */

  // Splits a markdown document on level-2 headings. Headings inside code fences are ignored.
  function splitH2(md) {
    const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
    const sections = [{ title: null, lines: [] }];
    let fence = false;
    for (const line of lines) {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      const h = !fence && /^##\s+(.+?)\s*#*\s*$/.exec(line);
      if (h && !/^###/.test(line)) sections.push({ title: h[1].trim(), lines: [] });
      else sections[sections.length - 1].lines.push(line);
    }
    return sections.map(s => ({ title: s.title, body: s.lines.join('\n') }));
  }

  function bullets(md) {
    const out = [];
    let cur = null;
    for (const line of String(md || '').replace(/\r\n/g, '\n').split('\n')) {
      const b = /^\s*[-*+]\s+(.*)$/.exec(line);
      if (b) { if (cur) out.push(cur); cur = b[1].trim(); }
      else if (cur && /^\s{2,}\S/.test(line)) cur += ' ' + line.trim();
      else if (cur) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
    return out.filter(Boolean);
  }

  const MARKER_RE = /^\s*<!--\s*barge:agent\s+([^>]*)-->\s*\n?/;

  function readMarker(md) {
    const m = MARKER_RE.exec(md || '');
    if (!m) return { attrs: null, body: md };
    const attrs = {};
    m[1].replace(/([a-z]+)="([^"]*)"/g, (_, k, v) => { attrs[k] = v.replace(/&quot;/g, '"').replace(/&amp;/g, '&'); return ''; });
    return { attrs, body: md.slice(m[0].length) };
  }

  function marker(m) {
    const q = s => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return '<!-- barge:agent id="' + q(m.agent.id) + '" name="' + q(m.agent.name) + '" source="' + q(m.source) + '"' + (m.target ? ' for="' + q(m.target) + '"' : '') + ' -->';
  }

  const MEMORY_TITLES = /^(memory|memories|gemini added memories|qwen added memories|remembered facts)$/i;
  const PERSONA_TITLES = /^(persona|soul|tone|voice)$/i;
  const PROFILE_TITLES = /^(about the user|user profile|user)$/i;
  const SKILLS_INDEX_TITLES = /^(skills)$/i;

  // Pulls Barge-recognised sections (memory, persona, profile) out of a main instruction file.
  function digestMain(md, ctx, origin, name) {
    const mk = readMarker(String(md || '').replace(/^﻿/, '').replace(/\r\n/g, '\n'));
    if (mk.attrs) {
      if (mk.attrs.name) ctx.nameHint = mk.attrs.name;
      if (mk.attrs.id) ctx.idHint = mk.attrs.id;
    }
    let body = mk.body;
    if (mk.attrs && ctx.nameHint) {
      // Barge writes "# Name" right after its marker
      body = body.replace(new RegExp('^\\s*#\\s+' + ctx.nameHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\n'), '');
    }
    if (!mk.attrs) {
      const h1 = /^\s*#\s+([^\n#]{1,40}?)\s*#*\s*(\n|$)/.exec(body);
      if (h1 && !/\.(md|mdc)$/i.test(h1[1]) && !/^(claude|agents|gemini|instructions|rules|readme|project|memory)\b/i.test(h1[1]) && h1[1].trim().split(/\s+/).length <= 3) {
        if (!ctx.h1Name) ctx.h1Name = h1[1].trim();
        body = body.slice(h1[0].length);
      }
    }
    const keep = [];
    for (const sec of splitH2(body)) {
      if (sec.title && MEMORY_TITLES.test(sec.title)) {
        for (const b of bullets(sec.body)) ctx.memory.push({ kind: 'fact', content: b, origin });
        continue;
      }
      if (sec.title && PERSONA_TITLES.test(sec.title) && mk.attrs) {
        ctx.persona.push(trimLines(sec.body));
        continue;
      }
      if (sec.title && PROFILE_TITLES.test(sec.title) && mk.attrs) {
        if (trimLines(sec.body)) ctx.memory.push({ kind: 'profile', content: trimLines(sec.body), origin });
        continue;
      }
      if (sec.title && SKILLS_INDEX_TITLES.test(sec.title) && /barge:skills-index/.test(sec.body)) continue;
      if (sec.title && /^instructions$/i.test(sec.title) && mk.attrs) { keep.push(sec.body); continue; }
      keep.push(sec.title ? '## ' + sec.title + '\n' + sec.body : sec.body);
    }
    const content = trimLines(keep.join('\n'));
    if (content) ctx.instructions.push({ name, content, origin });
  }

  /* ------------------------------------------------------------------ */
  /* Secret detection and redaction                                      */
  /* ------------------------------------------------------------------ */

  const SECRET_PATTERNS = [
    ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g],
    ['Anthropic key', /\bsk-ant-[A-Za-z0-9_-]{20,}/g],
    ['OpenAI key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/g],
    ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/g],
    ['GitHub token', /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g],
    ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}/g],
    ['AWS key', /\bAKIA[0-9A-Z]{16}\b/g],
    ['Google key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
    ['Stripe key', /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g],
    ['wallet key', /\b0x[a-fA-F0-9]{64}\b/g],
    ['bearer token', /\bBearer\s+(?!\$\{)[A-Za-z0-9._~+/-]{20,}=*/g]
  ];
  const ASSIGN_RE = /\b([A-Za-z0-9_]*(?:API[_-]?KEY|ACCESS[_-]?TOKEN|AUTH[_-]?TOKEN|SECRET|PASSWORD|PRIVATE[_-]?KEY)[A-Za-z0-9_]*)(\s*[=:]\s*["']?)([^\s"'`,;]{8,})/gi;
  const SECRET_KEY_RE = /(KEY|TOKEN|SECRET|PASSW|PWD|AUTH|CREDENTIAL|COOKIE|SESSION|PRIVATE)/i;
  const REF_RE = /^\$\{?[A-Za-z_][A-Za-z0-9_:.-]*\}?$/;

  function isRef(v) { return REF_RE.test(String(v).trim()) || /^\$\{[^}]+\}$/.test(String(v).trim()); }

  function redactText(text, where, secrets) {
    let s = String(text);
    for (const [label, re] of SECRET_PATTERNS) {
      s = s.replace(re, () => { secrets.push({ where, label, ref: null }); return '[redacted ' + label + ']'; });
    }
    s = s.replace(ASSIGN_RE, (all, k, sep, v) => {
      if (isRef(v) || /^\[redacted/.test(v) || /^<.*>$/.test(v) || /^(true|false|null|none|undefined)$/i.test(v) || /^your[_-]/i.test(v)) return all;
      secrets.push({ where, label: k, ref: null });
      return k + sep + '[redacted]';
    });
    return s;
  }

  function redactTool(t, secrets) {
    const where = 'Tool · ' + t.name;
    const base = envName(t.name);
    for (const k of Object.keys(t.env || {})) {
      const v = String(t.env[k]);
      if (!v || isRef(v)) continue;
      let hit = SECRET_KEY_RE.test(k);
      if (!hit) { const probe = []; redactText(v, where, probe); hit = probe.length > 0; }
      if (hit) { t.env[k] = '${' + envName(k) + '}'; secrets.push({ where, label: k, ref: envName(k) }); }
    }
    for (const k of Object.keys(t.headers || {})) {
      const v = String(t.headers[k]);
      if (!v || /\$\{/.test(v)) continue;
      if (/^authorization$/i.test(k) || SECRET_KEY_RE.test(k)) {
        const ref = base + '_' + (/^authorization$/i.test(k) ? 'TOKEN' : envName(k));
        const scheme = /^(Bearer|Basic|Token)\s+/i.exec(v);
        t.headers[k] = (scheme ? scheme[0] : '') + '${' + ref + '}';
        secrets.push({ where, label: k, ref });
      }
    }
    if (Array.isArray(t.args)) {
      for (let j = 0; j < t.args.length; j++) {
        const a = String(t.args[j]);
        const flag = /^(--?(?:api[-_]?key|token|secret|password|access[-_]?token|auth))(=)(.+)$/i.exec(a);
        if (flag && !isRef(flag[3])) {
          const ref = base + '_' + envName(flag[1].replace(/^-+/, ''));
          t.args[j] = flag[1] + '=${' + ref + '}';
          secrets.push({ where, label: flag[1], ref });
          continue;
        }
        const prev = j > 0 ? String(t.args[j - 1]) : '';
        if (/^--?(?:api[-_]?key|token|secret|password|access[-_]?token|auth)$/i.test(prev) && !isRef(a)) {
          const ref = base + '_' + envName(prev.replace(/^-+/, ''));
          t.args[j] = '${' + ref + '}';
          secrets.push({ where, label: prev, ref });
          continue;
        }
        const probe = [];
        const r = redactText(a, where, probe);
        if (probe.length) {
          const ref = base + '_SECRET';
          t.args[j] = r.replace(/\[redacted[^\]]*\]/g, '${' + ref + '}');
          secrets.push({ where, label: probe[0].label, ref });
        }
      }
    }
    if (t.url) {
      try {
        const u = new URL(t.url);
        let changed = false;
        u.searchParams.forEach((v, k) => {
          if (SECRET_KEY_RE.test(k) && v && !/\$\{/.test(v)) {
            const ref = base + '_' + envName(k);
            u.searchParams.set(k, '__BARGE_' + ref + '__');
            secrets.push({ where, label: k, ref });
            changed = true;
          }
        });
        if (changed) t.url = u.toString().replace(/__BARGE_([A-Z0-9_]+)__/g, '${$1}');
      } catch (e) { /* not a full URL, leave it */ }
    }
  }

  function redactManifest(m) {
    const secrets = [];
    const txt = (s, where) => redactText(s, where, secrets);
    m.agent.persona = txt(m.agent.persona || '', 'Identity');
    if (m.agent.identityDoc) m.agent.identityDoc = txt(m.agent.identityDoc, 'Identity');
    for (const x of m.instructions) x.content = txt(x.content, 'Instructions · ' + x.name);
    for (const x of m.memory) x.content = txt(x.content, 'Memory');
    for (const x of m.commands) x.prompt = txt(x.prompt, 'Command · ' + x.name);
    for (const x of m.subagents) x.content = txt(x.content, 'Subagent · ' + x.name);
    for (const x of m.routines) x.content = txt(x.content, 'Routine · ' + x.name);
    for (const s of m.skills) for (const f of s.files) if (typeof f.content === 'string') f.content = txt(f.content, 'Skill · ' + s.name);
    for (const t of m.tools) redactTool(t, secrets);
    m.secrets = (m.secrets || []).concat(secrets);
    return m;
  }

  /* ------------------------------------------------------------------ */
  /* Zip                                                                 */
  /* ------------------------------------------------------------------ */

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function zip(files, date) {
    date = date || new Date();
    const dosTime = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xFFFF;
    const dosDate = (((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xFFFF;
    const chunks = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.path);
      const data = toBytes(f.content);
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 0x0314, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, dosTime, true);
      ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true);
      ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint16(30, 0, true);
      ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true);
      ch.setUint32(38, (0o100644 << 16) >>> 0, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    const all = chunks.concat(central, [new Uint8Array(end.buffer)]);
    const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
    let p = 0;
    for (const a of all) { out.set(a, p); p += a.length; }
    return out;
  }

  const ZIP_LIMITS = { entries: 2000, total: 64 * 1024 * 1024, ratio: 200 };

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed zip files.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  // Reads a zip into [{path, bytes}], refusing unsafe archives.
  async function unzip(input) {
    const u8 = toBytes(input);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a valid zip file.');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    if (count > ZIP_LIMITS.entries) throw new Error('Zip has too many files (' + count + ').');
    const out = [], blocked = [];
    let total = 0;
    for (let k = 0; k < count; k++) {
      if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) throw new Error('Corrupted zip directory.');
      const flags = dv.getUint16(p + 8, true);
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const usize = dv.getUint32(p + 24, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const extAttr = dv.getUint32(p + 38, true);
      const lho = dv.getUint32(p + 42, true);
      const rawName = (flags & 0x800) ? dec.decode(u8.subarray(p + 46, p + 46 + nlen)) : String.fromCharCode.apply(null, u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + xlen + clen;
      if (rawName.endsWith('/')) continue;
      const isLink = ((extAttr >>> 16) & 0o170000) === 0o120000;
      const name = normPath(rawName);
      if (!name || /(^|\/)\.\.(\/|$)/.test(rawName) || /^([a-zA-Z]:|\/)/.test(rawName)) { blocked.push({ path: rawName, reason: 'unsafe path' }); continue; }
      if (isLink) { blocked.push({ path: rawName, reason: 'symbolic link' }); continue; }
      if (flags & 1) { blocked.push({ path: rawName, reason: 'encrypted entry' }); continue; }
      if (csize > 0 && usize / csize > ZIP_LIMITS.ratio && usize > 1024 * 1024) { blocked.push({ path: rawName, reason: 'suspicious compression ratio' }); continue; }
      total += usize;
      if (total > ZIP_LIMITS.total) throw new Error('Zip is too large once unpacked.');
      if (lho + 30 > u8.length || dv.getUint32(lho, true) !== 0x04034b50) throw new Error('Corrupted zip entry.');
      const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
      const data = u8.subarray(start, start + csize);
      let bytes;
      if (method === 0) bytes = data.slice();
      else if (method === 8) bytes = await inflateRaw(data);
      else { blocked.push({ path: rawName, reason: 'unsupported compression' }); continue; }
      if (bytes.length !== usize) { blocked.push({ path: rawName, reason: 'size mismatch' }); continue; }
      out.push({ path: name, bytes });
    }
    return { entries: out, blocked };
  }

  /* ------------------------------------------------------------------ */
  /* Reading an agent                                                    */
  /* ------------------------------------------------------------------ */

  const IGNORED_SEGMENTS = new Set(['node_modules', '.git', '.svn', '__pycache__', '.venv', 'venv', 'dist', 'build', '.next']);
  const IGNORED_FILES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);
  const KNOWN_ROOTS = new Set(['.claude', '.codex', '.cursor', '.gemini', '.windsurf', '.clinerules', '.cline', '.goose', '.hermes', '.agents', '.agent', '.codeium', '.config', 'skills', 'memory', 'memories', 'prompts', 'commands', 'conventions',
    '.github', '.vscode', '.opencode', '.kiro', '.roo', '.kilo', '.kilocode', '.qwen', '.factory', '.zed', '.continue', '.junie', '.amp', '.augment', '.trae', '.crush']);
  const SKILL_ROOTS = {
    '.claude/': 'claude-code', '.codex/': 'codex', '.cursor/': 'cursor', '.gemini/': 'gemini-cli', '.windsurf/': 'windsurf', '.clinerules/': 'cline',
    '.goose/': 'goose', '.hermes/': 'hermes', 'conventions/': 'aider', '.agents/': null, '.agent/': null, '.github/': 'copilot', '.opencode/': 'opencode',
    '.kiro/': 'kiro', '.roo/': 'roo', '.kilo/': 'kilo', '.kilocode/': 'kilo', '.qwen/': 'qwen', '.factory/': 'droid', '.zed/': 'zed',
    '.continue/': 'continue', '.junie/': 'junie', '.trae/': 'trae', '.crush/': 'crush', '.augment/': 'augment'
  };
  const SKILL_RE = new RegExp('(^|/)(' + Object.keys(SKILL_ROOTS).map(k => k.replace(/[.]/g, '\\.')).join('|') + ')?skills/([^/]+)/(.+)$', 'i');
  const MAX_FILE = 2 * 1024 * 1024;

  function classify(path) {
    const lp = path.toLowerCase();
    const base = lp.split('/').pop();
    const skill = SKILL_RE.exec(path.replace(/(^|\/)\.opencode\/skill\//i, '$1.opencode/skills/'));
    if (skill) {
      const pre = (skill[2] || '').toLowerCase();
      const platform = pre in SKILL_ROOTS ? SKILL_ROOTS[pre] : 'openclaw';
      return { type: 'skill', platform, skill: skill[3], rel: skill[4], weight: pre && platform ? 2 : (platform ? 1 : 0) };
    }
    // GitHub Copilot
    if (/(^|\/)\.github\/copilot-instructions\.md$/.test(lp)) return { type: 'main', platform: 'copilot', weight: 3 };
    if (/(^|\/)\.github\/instructions\/.+\.instructions\.md$/.test(lp)) return { type: 'rule', platform: 'copilot', weight: 2 };
    if (/(^|\/)\.github\/prompts\/.+\.prompt\.md$/.test(lp)) return { type: 'command-md', platform: 'copilot', weight: 2 };
    if (/(^|\/)\.github\/(agents\/[^/]+\.agent\.md|chatmodes\/[^/]+\.chatmode\.md)$/.test(lp)) return { type: 'subagent', platform: 'copilot', weight: 2 };
    if (/(^|\/)\.vscode\/mcp\.json$/.test(lp)) return { type: 'mcp-json', platform: 'copilot', weight: 2 };
    // OpenCode
    if (/^(\.opencode\/)?opencode\.jsonc?$/.test(lp) || /\/(\.opencode\/)?opencode\.jsonc?$/.test(lp)) return { type: 'oc-config', platform: 'opencode', weight: 3 };
    if (/(^|\/)\.opencode\/commands?\/.+\.md$/.test(lp)) return { type: 'command-md', platform: 'opencode', weight: 2 };
    if (/(^|\/)\.opencode\/agents?\/[^/]+\.md$/.test(lp)) return { type: 'subagent', platform: 'opencode', weight: 2 };
    // Kilo Code
    if (/(^|\/)(\.kilo\/)?kilo\.jsonc?$/.test(lp)) return { type: 'oc-config', platform: 'kilo', weight: 3 };
    if (/(^|\/)(\.kilo|\.kilocode)\/rules\/[^/]+\.md$/.test(lp)) return { type: 'rule', platform: 'kilo', weight: 2 };
    if (/(^|\/)(\.kilo\/commands|\.kilocode\/workflows|\.kilocode\/commands)\/.+\.md$/.test(lp)) return { type: 'command-md', platform: 'kilo', weight: 2 };
    if (/(^|\/)\.kilo\/agents\/[^/]+\.md$/.test(lp)) return { type: 'subagent', platform: 'kilo', weight: 2 };
    if (/(^|\/)(\.kilo|\.kilocode)\/mcp\.json$/.test(lp)) return { type: 'mcp-json', platform: 'kilo', weight: 2 };
    // Roo Code
    if (/(^|\/)\.roo\/rules(-[^/]+)?\/[^/]+\.(md|txt)$/.test(lp)) return { type: 'rule', platform: 'roo', weight: 2 };
    if (/(^|\/)\.roo\/commands\/.+\.md$/.test(lp)) return { type: 'command-md', platform: 'roo', weight: 2 };
    if (/(^|\/)\.roo\/mcp\.json$/.test(lp)) return { type: 'mcp-json', platform: 'roo', weight: 2 };
    if (base === '.roomodes') return { type: 'roomodes', platform: 'roo', weight: 2 };
    // Kiro
    if (/(^|\/)\.kiro\/steering\/[^/]+\.md$/.test(lp)) return { type: 'rule', platform: 'kiro', weight: 2 };
    if (/(^|\/)\.kiro\/settings\/mcp\.json$/.test(lp)) return { type: 'mcp-json', platform: 'kiro', weight: 2 };
    // Antigravity
    if (/(^|\/)\.agents?\/rules\/[^/]+\.md$/.test(lp)) return { type: 'rule', platform: 'antigravity', weight: 2 };
    if (/(^|\/)\.agents?\/agents\/[^/]+\.md$/.test(lp)) return { type: 'subagent', platform: 'antigravity', weight: 2 };
    if (/(^|\/)(\.agents\/|\.gemini\/config\/|antigravity\/)mcp_config\.json$/.test(lp)) return { type: 'mcp-json', platform: 'antigravity', weight: 2 };
    // Qwen Code
    if (/(^|\/)\.qwen\/settings\.json$/.test(lp)) return { type: 'settings-json', platform: 'qwen', weight: 2 };
    if (/(^|\/)\.qwen\/commands\/.+\.toml$/.test(lp)) return { type: 'command-toml', platform: 'qwen', weight: 2 };
    if (/(^|\/)\.qwen\/commands\/.+\.md$/.test(lp)) return { type: 'command-md', platform: 'qwen', weight: 2 };
    if (/(^|\/)\.qwen\/agents\/[^/]+\.md$/.test(lp)) return { type: 'subagent', platform: 'qwen', weight: 2 };
    // Factory Droid
    if (/(^|\/)\.factory\/mcp\.json$/.test(lp)) return { type: 'mcp-json', platform: 'droid', weight: 2 };
    if (/(^|\/)\.factory\/commands\/.+\.md$/.test(lp)) return { type: 'command-md', platform: 'droid', weight: 2 };
    if (/(^|\/)\.factory\/droids\/[^/]+\.md$/.test(lp)) return { type: 'subagent', platform: 'droid', weight: 2 };
    // Zed
    if (/(^|\/)\.zed\/settings\.json$/.test(lp)) return { type: 'settings-json', platform: 'zed', weight: 2 };
    // Continue
    if (/(^|\/)\.continue\/rules\/[^/]+\.md$/.test(lp)) return { type: 'rule', platform: 'continue', weight: 2 };
    if (/(^|\/)\.continue\/prompts\/[^/]+\.(md|prompt)$/.test(lp)) return { type: 'command-md', platform: 'continue', weight: 2 };
    if (/(^|\/)\.continue\/mcpservers\/[^/]+\.ya?ml$/.test(lp)) return { type: 'continue-mcp', platform: 'continue', weight: 2 };
    if (/(^|\/)\.continue\/mcpservers\/[^/]+\.json$/.test(lp)) return { type: 'mcp-json', platform: 'continue', weight: 2 };
    // Junie
    if (/(^|\/)\.junie\/(agents|guidelines)\.md$/.test(lp)) return { type: 'main', platform: 'junie', weight: 3 };
    if (/(^|\/)\.junie\/guidelines\/[^/]+\.md$/.test(lp)) return { type: 'rule', platform: 'junie', weight: 2 };
    if (/(^|\/)\.junie\/mcp\/mcp\.json$/.test(lp)) return { type: 'mcp-json', platform: 'junie', weight: 2 };
    // Amp
    if (/(^|\/)\.amp\/settings\.jsonc?$/.test(lp)) return { type: 'settings-json', platform: 'amp', weight: 2 };
    // Augment
    if (/(^|\/)\.augment\/rules\/.+\.md$/.test(lp)) return { type: 'rule', platform: 'augment', weight: 2 };
    if (/(^|\/)\.augment\/commands\/.+\.md$/.test(lp)) return { type: 'command-md', platform: 'augment', weight: 2 };
    if (/(^|\/)\.augment\/(settings|mcp)\.json$/.test(lp)) return { type: 'mcp-json', platform: 'augment', weight: 2 };
    // Trae
    if (/(^|\/)\.trae\/rules\/[^/]+\.md$/.test(lp)) return { type: 'rule', platform: 'trae', weight: 2 };
    if (/(^|\/)\.trae\/(project_rules|user_rules)\.md$/.test(lp)) return { type: 'main', platform: 'trae', weight: 3 };
    if (/(^|\/)\.trae\/mcp\.json$/.test(lp)) return { type: 'mcp-json', platform: 'trae', weight: 2 };
    // Crush

    if (/(^|\/)\.windsurf\/rules\/.+\.md$/.test(lp)) return { type: 'ws-rule', platform: 'windsurf', weight: 2 };
    if (/(^|\/)\.windsurf\/workflows\/.+\.md$/.test(lp)) return { type: 'command-md', platform: 'windsurf', weight: 2 };
    if (base === '.windsurfrules') return { type: 'main', platform: 'windsurf', weight: 3 };
    if (/(^|\/)(\.codeium\/windsurf\/|windsurf\/)?mcp_config\.json$/.test(lp)) return { type: 'mcp-json', platform: 'windsurf', weight: 2 };
    if (/(^|\/)\.clinerules\/workflows\/.+\.md$/.test(lp)) return { type: 'command-md', platform: 'cline', weight: 2 };
    if (/(^|\/)\.clinerules\/(hooks)\//.test(lp)) return { type: null };
    if (/(^|\/)(\.clinerules|\.cline\/rules)\/[^/]+\.(md|txt)$/.test(lp)) return { type: 'cline-rule', platform: 'cline', weight: 2 };
    if (base === '.clinerules') return { type: 'main', platform: 'cline', weight: 3 };
    if (base === 'cline_mcp_settings.json') return { type: 'mcp-json', platform: 'cline', weight: 2 };
    if (base === '.goosehints') return { type: 'main', platform: 'goose', weight: 3 };
    if (/(^|\/)goose\/config\.ya?ml$/.test(lp)) return { type: 'yaml-config', platform: 'goose', weight: 2 };
    if (base === 'conventions.md') return { type: 'main', platform: 'aider', weight: 3 };
    if (/^\.aider\.conf\.ya?ml$/.test(base)) return { type: 'marker', platform: 'aider', weight: 2 };
    if (/(^|\/)\.hermes\/config\.ya?ml$/.test(lp) || (/^config\.ya?ml$/.test(lp))) return { type: 'yaml-config', platform: 'hermes', weight: 0 };
    if (/(^|\/)memories\/memory\.md$/.test(lp)) return { type: 'memory-md', platform: 'hermes', weight: 3, hermes: true };
    if (/(^|\/)memories\/user\.md$/.test(lp)) return { type: 'user', platform: 'hermes', weight: 3, hermes: true };
    if (/(^|\/)memories\/logs\/[^/]+\.md$/.test(lp)) return { type: 'memory-log', platform: 'hermes', weight: 0 };
    if (/(^|\/)\.hermes\/soul\.md$/.test(lp)) return { type: 'soul', platform: 'hermes', weight: 3, hermes: true };
    if (base.endsWith('.barge')) return { type: 'package', platform: null };
    if (/(^|\/)\.claude\/commands\/.+\.md$/.test(lp)) return { type: 'command-md', platform: 'claude-code', weight: 2 };
    if (/(^|\/)\.claude\/agents\/[^/]+\.md$/.test(lp)) return { type: 'subagent', platform: 'claude-code', weight: 2 };
    if (/(^|\/)\.claude\/settings(\.local)?\.json$/.test(lp)) return { type: 'claude-settings', platform: 'claude-code', weight: 2 };
    if (/(^|\/)\.codex\/prompts\/[^/]+\.md$/.test(lp) || /^prompts\/[^/]+\.md$/.test(lp)) return { type: 'command-md', platform: 'codex', weight: 2 };
    if (/(^|\/)\.cursor\/commands\/.+\.md$/.test(lp)) return { type: 'command-md', platform: 'cursor', weight: 2 };
    if (/(^|\/)\.cursor\/rules\/.+\.(mdc|md)$/.test(lp)) return { type: 'cursor-rule', platform: 'cursor', weight: 2 };
    if (/(^|\/)\.gemini\/commands\/.+\.toml$/.test(lp)) return { type: 'command-toml', platform: 'gemini-cli', weight: 2 };
    if (/(^|\/)\.gemini\/settings\.json$/.test(lp)) return { type: 'mcp-json', platform: 'gemini-cli', weight: 2 };
    if (/(^|\/)\.cursor\/mcp\.json$/.test(lp)) return { type: 'mcp-json', platform: 'cursor', weight: 2 };
    if (base === '.mcp.json' || base === 'claude_desktop_config.json' || base === '.claude.json') return { type: 'mcp-json', platform: 'claude-code', weight: 2 };
    if (base === 'mcp.json') return { type: 'mcp-json', platform: null, weight: 0 };
    if (base === 'config.toml' && (/(^|\/)\.codex\//.test(lp) || !lp.includes('/'))) return { type: 'codex-config', platform: 'codex', weight: 2 };
    if (base === '.cursorrules') return { type: 'main', platform: 'cursor', weight: 2 };
    // Single-file platforms, checked after every rules folder so a rule named qwen.md stays a rule.
    if (base === '.roorules') return { type: 'main', platform: 'roo', weight: 3 };
    if (base === 'qwen.md') return { type: 'main', platform: 'qwen', weight: 3 };
    if (base === '.rules') return { type: 'main', platform: 'zed', weight: 3 };
    if (base === '.continuerules') return { type: 'main', platform: 'continue', weight: 3 };
    if (base === '.augment-guidelines') return { type: 'main', platform: 'augment', weight: 3 };
    if (base === 'crush.md' || base === 'crush.local.md') return { type: 'main', platform: 'crush', weight: 3 };
    if (base === '.crush.json' || base === 'crush.json') return { type: 'mcp-json', platform: 'crush', weight: 2 };
    if (base === 'claude.md' || base === 'claude.local.md') return { type: 'main', platform: 'claude-code', weight: 3 };
    if (base === 'gemini.md') return { type: 'main', platform: 'gemini-cli', weight: 3 };
    if (base === 'agents.md') return { type: 'main', platform: 'agents-md', weight: 2 };
    if (base === 'soul.md') return { type: 'soul', platform: 'openclaw', weight: 3 };
    if (base === 'identity.md') return { type: 'identity', platform: 'openclaw', weight: 3 };
    if (base === 'user.md') return { type: 'user', platform: 'openclaw', weight: 2 };
    if (base === 'tools.md') return { type: 'tools-md', platform: 'openclaw', weight: 1 };
    if (base === 'memory.md') return { type: 'memory-md', platform: 'openclaw', weight: 2 };
    if (base === 'heartbeat.md' || base === 'heartbeat.paused.md') return { type: 'heartbeat', platform: 'openclaw', weight: 2 };
    if (/(^|\/)memory\/[^/]+\.md$/.test(lp)) return { type: 'memory-log', platform: 'openclaw', weight: 0 };
    return { type: null };
  }

  function emptyManifest() {
    return {
      format: FORMAT,
      createdAt: new Date().toISOString(),
      source: null,
      agent: { id: uid(), name: 'My agent', persona: '', identityDoc: '' },
      instructions: [], memory: [], skills: [], commands: [], subagents: [], tools: [],
      permissions: { allow: [], ask: [], deny: [], policy: null, origin: null },
      routines: [], secrets: []
    };
  }

  function stripCommonRoot(entries) {
    if (!entries.length) return { entries, root: null };
    const firsts = new Set(entries.map(e => e.path.split('/')[0]));
    const nested = entries.every(e => e.path.includes('/'));
    if (firsts.size === 1 && nested) {
      const root = [...firsts][0];
      if (!KNOWN_ROOTS.has(root.toLowerCase())) {
        return { entries: entries.map(e => ({ path: e.path.slice(root.length + 1), bytes: e.bytes })), root };
      }
    }
    return { entries, root: null };
  }

  function parseMcpServers(obj, origin, tools, warnings, where) {
    if (!obj || typeof obj !== 'object') return 0;
    const mcpMap = obj.mcp && typeof obj.mcp === 'object' && !Array.isArray(obj.mcp) ? (obj.mcp.servers || obj.mcp) : null;
    let servers = obj.mcpServers || obj.mcp_servers || obj.context_servers || obj['amp.mcpServers'] || mcpMap || obj.servers;
    if (Array.isArray(servers)) {
      const o = {};
      servers.forEach((x, k) => { if (x && typeof x === 'object') o[String(x.name || 'server-' + (k + 1))] = x; });
      servers = o;
    }
    if (!servers || typeof servers !== 'object') return 0;
    let n = 0;
    for (const name of Object.keys(servers)) {
      const s = servers[name];
      if (!s || typeof s !== 'object') continue;
      let command = s.command, args = Array.isArray(s.args) ? s.args.map(String) : [];
      let env = s.env || s.environment || {};
      if (command && typeof command === 'object' && !Array.isArray(command)) {
        args = (Array.isArray(command.args) ? command.args.map(String) : []).concat(args);
        env = Object.assign({}, command.env || {}, env);
        command = command.path || command.command || '';
      }
      if (Array.isArray(command)) { args = command.slice(1).map(String).concat(args); command = command[0]; }
      if (Array.isArray(env)) {
        const o = {};
        for (const kv of env) { const m = /^([^=]+)=(.*)$/.exec(String(kv)); if (m) o[m[1]] = m[2]; }
        env = o;
      }
      const url = s.url || s.httpUrl || s.serverUrl || s.uri || '';
      const t = {
        name,
        transport: url ? 'http' : 'stdio',
        command: command ? normRef(command, origin) : '',
        args: args.map(a => normRef(a, origin)),
        env: {},
        url: url ? normRef(url, origin) : '',
        headers: {},
        cwd: s.cwd || '',
        origin
      };
      for (const k of Object.keys(env || {})) t.env[k] = normRef(env[k], origin);
      const hdr = s.headers || s.http_headers || (s.requestOptions && s.requestOptions.headers) || {};
      for (const k of Object.keys(hdr)) t.headers[k] = normRef(hdr[k], origin);
      if (s.bearer_token_env_var) t.headers.Authorization = 'Bearer ${' + s.bearer_token_env_var + '}';
      if (Array.isArray(s.env_vars)) for (const k of s.env_vars) if (!(k in t.env)) t.env[k] = '${' + k + '}';
      if (!t.command && !t.url) { warnings.push(where + ': server "' + name + '" has no command or URL.'); continue; }
      tools.push(t);
      n++;
    }
    return n;
  }

  // OpenCode and Kilo permission rules -> Barge rules (Claude Code syntax).
  function readOcPermission(p, perms, origin) {
    if (!p || typeof p !== 'object') return 0;
    let n = 0;
    const add = (k, r) => { if (['allow', 'ask', 'deny'].includes(k) && !perms[k].includes(r)) { perms[k].push(r); n++; } };
    const names = { edit: 'Edit', webfetch: 'WebFetch', read: 'Read', write: 'Write' };
    for (const key of Object.keys(p)) {
      const v = p[key];
      if (key === 'bash' && v && typeof v === 'object') {
        for (const pat of Object.keys(v)) add(String(v[pat]), 'Bash(' + (pat === '*' ? '*' : pat.replace(/ \*$/, ':*')) + ')');
      } else if (key === 'bash' && typeof v === 'string') add(v, 'Bash');
      else if (names[key] && typeof v === 'string') add(v, names[key]);
    }
    if (n) perms.origin = perms.origin || origin;
    return n;
  }

  function fromPackageObject(obj) {
    if (!obj || obj.format !== FORMAT) throw new Error('This .barge package uses an unknown format.');
    const m = emptyManifest();
    Object.assign(m, clone(obj));
    m.agent = Object.assign(emptyManifest().agent, obj.agent || {});
    for (const k of ['instructions', 'memory', 'skills', 'commands', 'subagents', 'tools', 'routines', 'secrets']) if (!Array.isArray(m[k])) m[k] = [];
    m.permissions = Object.assign(emptyManifest().permissions, obj.permissions || {});
    for (const s of m.skills) {
      s.files = (s.files || []).map(f => {
        const path = safeRel(f.path);
        if (!path) return null;
        return f.base64 != null ? { path, bytes: b64decode(f.base64) } : { path, content: String(f.content || '') };
      }).filter(Boolean);
    }
    return m;
  }

  function finalize(m) {
    const all = ['instructions', 'memory', 'skills', 'commands', 'subagents', 'tools', 'routines'];
    for (const k of all) for (const x of m[k]) if (!x.id) x.id = uid();
    if (!m.agent.id) m.agent.id = uid();
    return m;
  }

  // Rule frontmatter -> Barge scope, per platform.
  function ruleScope(p, d) {
    const list = v => Array.isArray(v) ? v.join(',') : String(v || '');
    const desc = String(d.description || '');
    const everywhere = g => !g || /^\*\*(\/\*)?$/.test(g.trim());
    if (p === 'copilot') { const g = list(d.applyTo); return { description: desc, globs: everywhere(g) ? '' : g, alwaysApply: everywhere(g) }; }
    if (p === 'kiro') {
      const inc = String(d.inclusion || 'always');
      const g = list(d.fileMatchPattern || d.fileMatch);
      return { description: desc, globs: inc === 'fileMatch' ? g : '', alwaysApply: inc === 'always' };
    }
    if (p === 'augment') return { description: desc, globs: '', alwaysApply: String(d.type || 'always_apply') === 'always_apply' };
    if (p === 'continue' || p === 'trae') {
      const g = list(d.globs);
      return { description: desc, globs: g, alwaysApply: d.alwaysApply === true || (d.alwaysApply == null && !g) };
    }
    return { description: desc, globs: '', alwaysApply: true };
  }

  /**
   * Reads files into a manifest.
   * @param {Array<{path:string, bytes?:Uint8Array, text?:string}>} input
   */
  function readAgent(input, opts) {
    opts = opts || {};
    const report = { detected: null, scores: {}, recognized: [], ignored: [], warnings: [], root: null, fromPackage: false };
    let entries = [];
    for (const f of input || []) {
      const path = normPath(f.path);
      if (!path) { report.ignored.push({ path: String(f.path), reason: 'unsafe path' }); continue; }
      const segs = path.split('/');
      if (segs.some(s => IGNORED_SEGMENTS.has(s))) continue;
      if (IGNORED_FILES.has(segs[segs.length - 1].toLowerCase())) continue;
      const bytes = f.bytes ? toBytes(f.bytes) : enc.encode(String(f.text == null ? '' : f.text));
      entries.push({ path, bytes });
    }
    const stripped = stripCommonRoot(entries);
    entries = stripped.entries;
    report.root = stripped.root;

    // A .barge package wins on its own.
    const pkg = entries.find(e => e.path.toLowerCase().endsWith('.barge'));
    if (pkg && (entries.length === 1 || opts.preferPackage)) {
      const m = fromPackageObject(JSON.parse(dec.decode(pkg.bytes)));
      report.fromPackage = true;
      report.detected = m.source;
      report.recognized.push({ path: pkg.path, as: 'Barge package' });
      return { manifest: finalize(m), report };
    }

    const m = emptyManifest();
    const ctx = { instructions: [], memory: [], persona: [], nameHint: null, idHint: null };
    const scores = {};
    const add = (p, w) => { if (p) scores[p] = (scores[p] || 0) + (w == null ? 1 : w); };
    const strongOpenclaw = new Set(['soul', 'identity', 'user', 'memory-md', 'heartbeat', 'tools-md']);
    let openclawMarkers = 0, openclawOnly = 0, hermesMarkers = 0, rootSoulWeight = 0;
    const skills = new Map();
    const pendingAgentsMd = [];
    const usedNames = new Set();

    for (const e of entries) {
      const c = classify(e.path);
      if (!c.type) { report.ignored.push({ path: e.path, reason: 'not an agent file' }); continue; }
      if (c.type === 'package') { report.ignored.push({ path: e.path, reason: 'extra .barge package' }); continue; }
      const binary = isBinary(e.bytes);
      if (c.type !== 'skill' && binary) { report.ignored.push({ path: e.path, reason: 'binary file' }); continue; }
      if (e.bytes.length > MAX_FILE) { report.ignored.push({ path: e.path, reason: 'larger than 2 MB' }); continue; }
      const text = binary ? null : dec.decode(e.bytes).replace(/^﻿/, '').replace(/\r\n/g, '\n');
      add(c.platform, c.weight);
      if (c.platform === 'openclaw' && strongOpenclaw.has(c.type)) { openclawMarkers++; if (c.type !== 'soul') openclawOnly++; else rootSoulWeight += c.weight; }
      if (c.platform === 'hermes' && c.type !== 'yaml-config' && c.type !== 'memory-log') hermesMarkers++;
      const base = e.path.split('/').pop();
      const stem = base.replace(/\.[^.]+$/, '').replace(/\.(instructions|prompt|agent|chatmode)$/i, '');
      const argsBack = p => p.replace(/\$\{input:[^}]*\}/g, '$ARGUMENTS').replace(/\{\{\{\s*input\s*\}\}\}/g, '$ARGUMENTS').replace(/\{\{\s*args\s*\}\}/g, '$ARGUMENTS');
      try {
        switch (c.type) {
          case 'skill': {
            const key = c.skill.toLowerCase();
            if (!skills.has(key)) skills.set(key, { folder: c.skill, platform: c.platform, files: [] });
            const rel = safeRel(c.rel);
            if (rel) skills.get(key).files.push(binary ? { path: rel, bytes: e.bytes } : { path: rel, content: text });
            report.recognized.push({ path: e.path, as: 'Skill · ' + c.skill });
            break;
          }
          case 'main': {
            if (c.platform === 'agents-md') { pendingAgentsMd.push({ e, text }); break; }
            digestMain(text, ctx, c.platform, base);
            report.recognized.push({ path: e.path, as: 'Instructions' });
            break;
          }
          case 'cursor-rule':
          case 'ws-rule':
          case 'cline-rule':
          case 'rule': {
            const fm = parseFrontmatter(text);
            if (/barge:pointer|barge:skills-index/.test(fm.body)) { report.recognized.push({ path: e.path, as: 'Barge pointer (skipped)' }); break; }
            if (/barge:command/.test(fm.body)) {
              const nm = /barge:command\s+name="([^"]*)"/.exec(fm.body);
              const name = uniqueSlug(slug(nm ? nm[1] : stem.replace(/^cmd-/, ''), 'command'), usedNames);
              m.commands.push({ name, description: String(fm.data.description || ''), argumentHint: '', allowedTools: '', prompt: trimLines(fm.body.replace(/<!--\s*barge:command[^>]*-->\n?/, '')), origin: c.platform });
              report.recognized.push({ path: e.path, as: 'Command · /' + name });
              break;
            }
            if (/barge:identity/.test(fm.body)) { digestCursorIdentity(fm.body, ctx); report.recognized.push({ path: e.path, as: 'Identity' }); break; }
            if (/barge:memory/.test(fm.body)) { digestMain('<!-- barge:agent -->\n' + fm.body.replace(/<!--\s*barge:memory\s*-->\n?/, ''), ctx, c.platform, base); report.recognized.push({ path: e.path, as: 'Memory' }); break; }
            const content = trimLines(fm.body);
            const d = fm.data;
            const list = v => Array.isArray(v) ? v.join(',') : (v || '');
            let scope;
            if (c.type === 'ws-rule') {
              const trig = String(d.trigger || 'always_on');
              scope = { description: d.description || '', globs: trig === 'glob' ? list(d.globs) : '', alwaysApply: trig === 'always_on' };
            } else if (c.type === 'cline-rule') {
              scope = { description: d.description || '', globs: list(d.paths), alwaysApply: !d.paths };
            } else if (c.type === 'rule') {
              scope = ruleScope(c.platform, d);
            } else {
              scope = { description: d.description || '', globs: list(d.globs), alwaysApply: d.alwaysApply !== false && !(d.globs) };
            }
            if (content) ctx.instructions.push({ name: stem, content, origin: c.platform, scope });
            report.recognized.push({ path: e.path, as: 'Rule' });
            break;
          }
          case 'marker': {
            report.recognized.push({ path: e.path, as: 'Config' });
            break;
          }
          case 'yaml-config': {
            const y = parseYAML(text) || {};
            let n = 0;
            if (c.platform === 'goose') {
              const ext = y.extensions;
              const entries = Array.isArray(ext) ? ext.map(x => [x && x.name, x]) : Object.entries(ext || {});
              const servers = {};
              for (const [k, x] of entries) {
                if (!x || typeof x !== 'object') continue;
                const type = String(x.type || '');
                if (type === 'builtin' || type === 'platform' || (!x.cmd && !x.command && !x.uri && !x.url)) continue;
                const env = Object.assign({}, x.envs || x.env || {});
                for (const ek of (x.env_keys || [])) if (!(ek in env)) env[ek] = '${' + ek + '}';
                servers[x.name || k] = { command: x.cmd || x.command || '', args: x.args || [], env, url: x.uri || x.url || '', headers: x.headers || {} };
              }
              n = parseMcpServers({ mcpServers: servers }, 'goose', m.tools, report.warnings, e.path);
            } else if (y && y.mcp_servers) {
              n = parseMcpServers({ mcpServers: y.mcp_servers }, 'hermes', m.tools, report.warnings, e.path);
              add('hermes', 2);
            }
            if (!n && c.platform === 'hermes') { report.ignored.push({ path: e.path, reason: 'no MCP servers in this config' }); break; }
            report.recognized.push({ path: e.path, as: 'Tools · ' + n + ' MCP server' + (n === 1 ? '' : 's') });
            break;
          }
          case 'command-md': {
            const fm = parseFrontmatter(text);
            const name = uniqueSlug(slug(fm.data.name || stem, 'command'), usedNames);
            m.commands.push({
              name, description: String(fm.data.description || ''),
              argumentHint: String(fm.raw['argument-hint'] || '').replace(/^"(.*)"$/, '$1'),
              allowedTools: fm.data['allowed-tools'] ? String(fm.data['allowed-tools']) : '',
              prompt: argsBack(trimLines(fm.body)), origin: c.platform
            });
            report.recognized.push({ path: e.path, as: 'Command · /' + name });
            break;
          }
          case 'command-toml': {
            const t = parseTOML(text);
            const relDir = e.path.replace(/^.*?\.(gemini|qwen)\/commands\//i, '').replace(/\.toml$/i, '');
            const name = uniqueSlug(slug(relDir.replace(/\//g, '-'), 'command'), usedNames);
            m.commands.push({
              name, description: String(t.description || ''), argumentHint: '', allowedTools: '',
              prompt: trimLines(String(t.prompt || '')).replace(/\{\{\s*args\s*\}\}/g, '$ARGUMENTS'), origin: c.platform
            });
            report.recognized.push({ path: e.path, as: 'Command · /' + name });
            break;
          }
          case 'subagent': {
            const fm = parseFrontmatter(text);
            m.subagents.push({
              name: slug(fm.data.name || stem, 'subagent'), description: String(fm.data.description || ''),
              tools: c.platform === 'claude-code' && fm.data.tools ? String(fm.data.tools) : '', model: c.platform === 'claude-code' && fm.data.model ? String(fm.data.model) : '',
              content: trimLines(fm.body), origin: c.platform
            });
            report.recognized.push({ path: e.path, as: 'Subagent' });
            break;
          }
          case 'claude-settings': {
            const j = JSON.parse(text);
            const p = j.permissions || {};
            for (const k of ['allow', 'ask', 'deny']) if (Array.isArray(p[k])) for (const r of p[k]) if (!m.permissions[k].includes(String(r))) m.permissions[k].push(String(r));
            if (p.defaultMode) m.permissions.policy = Object.assign({}, m.permissions.policy, { defaultMode: String(p.defaultMode) });
            m.permissions.origin = 'claude-code';
            const n = parseMcpServers(j, 'claude-code', m.tools, report.warnings, e.path);
            report.recognized.push({ path: e.path, as: n ? 'Permissions + tools' : 'Permissions' });
            break;
          }
          case 'oc-config': {
            const j = parseJsonc(text);
            const n = parseMcpServers(j, c.platform, m.tools, report.warnings, e.path);
            const pn = readOcPermission(j.permission, m.permissions, c.platform);
            report.recognized.push({ path: e.path, as: (c.platform === 'kilo' ? 'Kilo' : 'OpenCode') + ' config' + (n ? ' · ' + n + ' MCP server' + (n > 1 ? 's' : '') : '') + (pn ? ' · permissions' : '') });
            break;
          }
          case 'settings-json': {
            const j = parseJsonc(text);
            const n = parseMcpServers(j, c.platform, m.tools, report.warnings, e.path);
            let pn = 0;
            if (c.platform === 'qwen' && j.permissions && typeof j.permissions === 'object') {
              for (const k of ['allow', 'ask', 'deny']) if (Array.isArray(j.permissions[k])) for (const r of j.permissions[k]) if (!m.permissions[k].includes(String(r))) { m.permissions[k].push(String(r)); pn++; }
              if (pn) m.permissions.origin = m.permissions.origin || 'qwen';
            }
            if (!n && !pn) { report.ignored.push({ path: e.path, reason: 'no MCP servers in these settings' }); break; }
            report.recognized.push({ path: e.path, as: (n ? 'Tools · ' + n + ' MCP server' + (n > 1 ? 's' : '') : 'Settings') + (pn ? ' · permissions' : '') });
            break;
          }
          case 'continue-mcp': {
            const y = parseYAML(text) || {};
            const n = parseMcpServers(y, 'continue', m.tools, report.warnings, e.path);
            report.recognized.push({ path: e.path, as: 'Tools · ' + n + ' MCP server' + (n === 1 ? '' : 's') });
            break;
          }
          case 'roomodes': {
            let j;
            try { j = parseJsonc(text); } catch (err) { j = parseYAML(text) || {}; }
            const modes = Array.isArray(j.customModes) ? j.customModes : [];
            for (const md of modes) {
              if (!md || typeof md !== 'object') continue;
              const body = [md.roleDefinition, md.customInstructions].filter(Boolean).map(String).join('\n\n');
              m.subagents.push({ name: slug(md.slug || md.name, 'subagent'), description: String(md.whenToUse || md.description || ''), tools: '', model: '', content: trimLines(body), origin: 'roo' });
            }
            report.recognized.push({ path: e.path, as: 'Custom modes · ' + modes.length });
            break;
          }
          case 'mcp-json': {
            const j = parseJsonc(text);
            const n = parseMcpServers(j, c.platform || 'claude-code', m.tools, report.warnings, e.path);
            if (c.platform === 'gemini-cli' && j.tools && (Array.isArray(j.tools.exclude) || Array.isArray(j.excludeTools))) {
              for (const r of (j.tools.exclude || j.excludeTools)) m.permissions.deny.push(String(r));
              m.permissions.origin = m.permissions.origin || 'gemini-cli';
            }
            report.recognized.push({ path: e.path, as: n ? 'Tools · ' + n + ' MCP server' + (n > 1 ? 's' : '') : 'Settings' });
            break;
          }
          case 'codex-config': {
            const t = parseTOML(text);
            const n = parseMcpServers({ mcp_servers: t.mcp_servers }, 'codex', m.tools, report.warnings, e.path);
            if (t.approval_policy || t.sandbox_mode) {
              m.permissions.policy = Object.assign({}, m.permissions.policy, { approval_policy: t.approval_policy, sandbox_mode: t.sandbox_mode });
              m.permissions.origin = m.permissions.origin || 'codex';
            }
            const commented = (text.match(/^#\s*barge:(allow|ask|deny)\s+(.+)$/gm) || []);
            for (const line of commented) {
              const mm = /^#\s*barge:(allow|ask|deny)\s+(.+)$/.exec(line);
              if (mm && !m.permissions[mm[1]].includes(mm[2].trim())) m.permissions[mm[1]].push(mm[2].trim());
            }
            report.recognized.push({ path: e.path, as: 'Codex config' + (n ? ' · ' + n + ' MCP server' + (n > 1 ? 's' : '') : '') });
            break;
          }
          case 'soul': {
            let body = text;
            const idm = /<!--\s*barge-id:\s*([0-9a-f-]{8,})\s*-->\n?/i.exec(body);
            if (idm) {
              ctx.idHint = ctx.idHint || idm[1];
              body = body.replace(idm[0], '');
              const h = /^\s*#\s+(.+)\n?/.exec(body);
              if (h) { ctx.nameHint = ctx.nameHint || h[1].trim(); body = body.slice(h[0].length); }
            }
            body = trimLines(body.replace(/^#\s*SOUL\.md[^\n]*\n/i, ''));
            if (body) ctx.persona.push(body);
            report.recognized.push({ path: e.path, as: 'Persona' });
            break;
          }
          case 'identity': {
            const nm = /(?:^|\n)\s*[-*]?\s*\**name\**\s*:\**\s*(.+)/i.exec(text);
            if (nm) ctx.nameHint = ctx.nameHint || nm[1].replace(/\*+/g, '').trim();
            const idm = /barge-id:\s*([0-9a-f-]{8,})/i.exec(text);
            if (idm) ctx.idHint = idm[1];
            m.agent.identityDoc = trimLines(text.replace(/<!--\s*barge-id:[^>]*-->\n?/i, ''));
            report.recognized.push({ path: e.path, as: 'Identity' });
            break;
          }
          case 'user': {
            const body = trimLines(text.replace(/^#\s*USER\.md[^\n]*\n/i, ''));
            if (body) ctx.memory.push({ kind: 'profile', content: body, origin: c.platform });
            report.recognized.push({ path: e.path, as: 'Memory · user profile' });
            break;
          }
          case 'memory-md': {
            const body = text.replace(/^#\s*MEMORY\.md[^\n]*\n/i, '');
            const bl = bullets(body).length ? bullets(body) : (body.includes('\u00a7') ? body.split(/\n?\u00a7\n?/).map(trimLines).filter(Boolean) : []);
            if (bl.length) for (const b of bl) ctx.memory.push({ kind: 'fact', content: b, origin: c.platform });
            else if (trimLines(body)) ctx.memory.push({ kind: 'fact', content: trimLines(body), origin: c.platform });
            report.recognized.push({ path: e.path, as: 'Memory' });
            break;
          }
          case 'memory-log': {
            const dm = /(\d{4}-\d{2}-\d{2})/.exec(stem);
            if (trimLines(text)) ctx.memory.push({ kind: 'log', date: dm ? dm[1] : stem, content: trimLines(text), origin: c.platform });
            report.recognized.push({ path: e.path, as: 'Memory · daily log' });
            break;
          }
          case 'heartbeat': {
            const body = trimLines(text.replace(/<!--[\s\S]*?-->/g, '').replace(/^#\s*HEARTBEAT[^\n]*\n/i, '').replace(/^Rename this file to HEARTBEAT\.md[^\n]*\n?/m, ''));
            if (body) m.routines.push({ name: 'heartbeat', content: body, schedule: 'heartbeat', paused: true, origin: 'openclaw' });
            report.recognized.push({ path: e.path, as: 'Routine (imported paused)' });
            break;
          }
          case 'tools-md': {
            let body = text;
            const block = /<!--\s*barge:mcp\s*-->\s*```json\n([\s\S]*?)\n```/i.exec(body);
            if (block) {
              try { parseMcpServers(JSON.parse(block[1]), 'openclaw', m.tools, report.warnings, e.path); } catch (err) { report.warnings.push(e.path + ': MCP block could not be read.'); }
              body = body.replace(block[0], '').replace(/##\s*MCP servers\s*\n(?:[^\n]*\n)*?(?=##|$)/i, '');
            }
            body = trimLines(body.replace(/^#\s*TOOLS\.md[^\n]*\n/i, ''));
            if (body) ctx.instructions.push({ name: 'TOOLS.md', content: body, origin: 'openclaw', role: 'tool-notes' });
            report.recognized.push({ path: e.path, as: 'Tool notes' });
            break;
          }
        }
      } catch (err) {
        report.warnings.push(e.path + ': ' + (err && err.message ? err.message : 'could not be read'));
      }
    }

    // AGENTS.md belongs to OpenClaw when OpenClaw markers exist, otherwise to Codex.
    const hermesish = hermesMarkers > 0 && openclawOnly === 0;
    if (hermesish && rootSoulWeight) { scores.openclaw = (scores.openclaw || 0) - rootSoulWeight; add('hermes', rootSoulWeight); }
    const openclawish = !hermesish && openclawMarkers > 0;
    const agentsFamily = ['codex', 'opencode', 'kilo', 'droid', 'amp', 'antigravity', 'junie', 'crush'].filter(p => scores[p] > 0).sort((a, b) => scores[b] - scores[a]);
    for (const { e, text } of pendingAgentsMd) {
      const fa = readMarker(text).attrs;
      const hinted = fa && fa.for && ['codex', 'hermes', 'openclaw', 'opencode', 'kilo', 'droid', 'amp', 'antigravity', 'junie', 'crush'].includes(fa.for) ? fa.for : null;
      const owner = hermesish ? 'hermes' : openclawish ? 'openclaw' : (hinted || agentsFamily[0] || 'codex');
      add(owner, 2);
      digestMain(text, ctx, owner, 'AGENTS.md');
      report.recognized.push({ path: e.path, as: 'Instructions' });
    }

    // Skills
    for (const [, s] of skills) {
      const main = s.files.find(f => f.path.toLowerCase() === 'skill.md' && typeof f.content === 'string');
      if (!main) {
        // A folder under skills/ without SKILL.md is not a skill.
        for (const f of s.files) report.ignored.push({ path: 'skills/' + s.folder + '/' + f.path, reason: 'skill folder has no SKILL.md' });
        report.recognized = report.recognized.filter(r => r.as !== 'Skill · ' + s.folder);
        continue;
      }
      const fm = parseFrontmatter(main.content);
      m.skills.push({
        name: slug(fm.data.name || s.folder, 'skill'),
        description: String(fm.data.description || ''),
        files: s.files.sort((a, b) => (a.path.toLowerCase() === 'skill.md' ? -1 : b.path.toLowerCase() === 'skill.md' ? 1 : a.path.localeCompare(b.path))),
        origin: s.platform
      });
    }
    delete scores['agents-md'];

    // Commands that Barge turned into OpenClaw skills come back as commands.
    m.skills = m.skills.filter(s => {
      const main = s.files[0];
      if (main && typeof main.content === 'string' && /barge:command/.test(main.content)) {
        const fm = parseFrontmatter(main.content);
        m.commands.push({ name: uniqueSlug(s.name, usedNames), description: String(fm.data.description || ''), argumentHint: '', allowedTools: '', prompt: trimLines(fm.body.replace(/<!--\s*barge:command\s*-->\n?/, '')), origin: s.origin || 'openclaw' });
        return false;
      }
      return true;
    });

    const toolNames = new Set();
    m.tools = m.tools.filter(t => { if (toolNames.has(t.name)) return false; toolNames.add(t.name); return true; });
    m.instructions = ctx.instructions.filter(x => x.role !== 'tool-notes').concat(ctx.instructions.filter(x => x.role === 'tool-notes'));
    m.memory = ctx.memory;
    m.agent.persona = ctx.persona.filter(Boolean).join('\n\n');
    const pretty = s => s ? s.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim() : s;
    m.agent.name = ctx.nameHint || ctx.h1Name || pretty(stripped.root) || opts.name || 'My agent';
    if (ctx.idHint) m.agent.id = ctx.idHint;

    const ranked = Object.keys(scores).filter(k => PLATFORM_IDS.includes(k)).sort((a, b) => scores[b] - scores[a] || PLATFORM_IDS.indexOf(a) - PLATFORM_IDS.indexOf(b));
    report.scores = scores;
    report.detected = ranked[0] || null;
    m.source = report.detected;

    redactManifest(m);
    return { manifest: finalize(m), report };
  }

  function digestCursorIdentity(body, ctx) {
    const clean = body.replace(/<!--\s*barge:identity[^>]*-->\n?/, '');
    const mk = /<!--\s*barge:identity\s+([^>]*)-->/.exec(body);
    if (mk) {
      const id = /id="([^"]*)"/.exec(mk[1]); const nm = /name="([^"]*)"/.exec(mk[1]);
      if (id) ctx.idHint = id[1];
      if (nm) ctx.nameHint = nm[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    }
    const persona = trimLines(trimLines(clean).replace(/^#\s+[^\n]*(\n|$)/, '').replace(/^\s*##\s*Persona\s*(\n|$)/i, ''));
    if (persona) ctx.persona.push(persona);
  }

  /* ------------------------------------------------------------------ */
  /* Items (for previews and selection)                                  */
  /* ------------------------------------------------------------------ */

  function listItems(m) {
    const items = [];
    const persona = !!(m.agent.persona || m.agent.identityDoc);
    items.push({ id: 'identity', kind: 'identity', name: m.agent.name, detail: persona ? 'Name, ID and persona' : 'Name and ID', origin: m.source });
    for (const x of m.instructions) items.push({ id: x.id, kind: 'instructions', name: x.name, detail: lines(x.content) + ' lines' + (x.scope && x.scope.globs ? ' · ' + x.scope.globs : ''), origin: x.origin });
    for (const x of m.memory) items.push({ id: x.id, kind: 'memory', name: x.kind === 'log' ? 'Log · ' + x.date : x.kind === 'profile' ? 'User profile' : clip(x.content, 72), detail: x.kind === 'fact' ? 'Fact' : x.kind === 'log' ? lines(x.content) + ' lines' : 'Profile', origin: x.origin, group: x.kind });
    for (const x of m.skills) items.push({ id: x.id, kind: 'skills', name: x.name, detail: x.files.length + ' file' + (x.files.length > 1 ? 's' : ''), origin: x.origin });
    for (const x of m.commands) items.push({ id: x.id, kind: 'commands', name: '/' + x.name, detail: x.description || clip(x.prompt, 60), origin: x.origin });
    for (const x of m.subagents) items.push({ id: x.id, kind: 'subagents', name: x.name, detail: x.description || '', origin: x.origin });
    for (const x of m.tools) items.push({ id: x.id, kind: 'tools', name: x.name, detail: x.transport === 'http' ? hostOf(x.url) : [x.command].concat(x.args.slice(0, 2)).join(' '), origin: x.origin });
    const p = m.permissions;
    const rules = p.allow.length + p.ask.length + p.deny.length;
    if (rules || p.policy) items.push({ id: 'permissions', kind: 'permissions', name: 'Permissions', detail: rules ? p.allow.length + ' allow · ' + p.ask.length + ' ask · ' + p.deny.length + ' deny' : 'Approval policy', origin: p.origin });
    for (const x of m.routines) items.push({ id: x.id, kind: 'routines', name: x.name, detail: 'Imported paused', origin: x.origin });
    return items;
  }

  const lines = s => String(s || '').split('\n').length;
  const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const hostOf = u => { try { return new URL(u).host; } catch (e) { return u; } };

  function selectItems(m, excluded) {
    if (!excluded || !excluded.size) return m;
    const out = clone(Object.assign({}, m, { skills: [] }));
    out.skills = m.skills.filter(x => !excluded.has(x.id));
    for (const k of ['instructions', 'memory', 'commands', 'subagents', 'tools', 'routines']) out[k] = out[k].filter(x => !excluded.has(x.id));
    if (excluded.has('permissions')) out.permissions = { allow: [], ask: [], deny: [], policy: null, origin: null };
    if (excluded.has('identity')) { out.agent.persona = ''; out.agent.identityDoc = ''; }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Writers                                                             */
  /* ------------------------------------------------------------------ */

  function envRef(v, style) {
    return String(v).replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, n) => {
      if (style === 'cursor' || style === 'windsurf' || style === 'vscode' || style === 'roo') return '${env:' + n + '}';
      if (style === 'oc') return '{env:' + n + '}';
      if (style === 'crush') return '$' + n;
      return '${' + n + '}';
    });
  }

  // OpenCode / Kilo MCP block.
  function ocServers(m) {
    const out = {};
    for (const t of m.tools) {
      if (t.transport === 'http') {
        const s = { type: 'remote', url: envRef(t.url, 'oc') };
        const h = {};
        for (const k of Object.keys(t.headers)) h[k] = envRef(t.headers[k], 'oc');
        if (Object.keys(h).length) s.headers = h;
        out[t.name] = s;
      } else {
        const s = { type: 'local', command: [t.command].concat(t.args).map(a => envRef(a, 'oc')) };
        const env = {};
        for (const k of Object.keys(t.env)) env[k] = envRef(t.env[k], 'oc');
        if (Object.keys(env).length) s.environment = env;
        if (t.cwd) s.cwd = t.cwd;
        out[t.name] = s;
      }
    }
    return out;
  }

  // Barge rules -> OpenCode / Kilo permission block. Only rules with a sure equivalent are written.
  function ocPermission(p) {
    const out = {}, bash = {};
    for (const k of ['allow', 'ask', 'deny']) for (const r of p[k]) {
      const b = /^Bash\((.*)\)$/.exec(r);
      if (b) { bash[b[1] === '*' ? '*' : b[1].replace(/:\*$/, ' *')] = k; continue; }
      if (r === 'Bash') { bash['*'] = k; continue; }
      if (/^(Edit|Write|MultiEdit)$/.test(r)) { out.edit = k; continue; }
      if (r === 'WebFetch') out.webfetch = k;
    }
    if (Object.keys(bash).length) out.bash = bash;
    return Object.keys(out).length ? out : null;
  }

  // Identity, instructions and memory as one folder of rule files.
  function rulesSet(m, dir, fm, opts) {
    opts = opts || {};
    const files = [{ path: dir + '/identity.md', content: writeFrontmatter(fm('identity') || {}, identityRuleBody(m)) }];
    for (const x of m.instructions) {
      const sc = x.scope || {};
      const body = sc.globs && !opts.globs ? '_Applies to: ' + sc.globs + '_\n\n' + x.content : x.content;
      files.push({ path: dir + '/' + x.slug + '.md', content: writeFrontmatter(fm('rule', x) || {}, body) });
    }
    const mem = memoryRuleBody(m);
    if (mem) files.push({ path: dir + '/memory.md', content: writeFrontmatter(fm('memory') || {}, mem) });
    return files;
  }

  function jsonServers(m, style) {
    const out = {};
    for (const t of m.tools) {
      const env = {};
      for (const k of Object.keys(t.env)) env[k] = envRef(t.env[k], style);
      const headers = {};
      for (const k of Object.keys(t.headers)) headers[k] = envRef(t.headers[k], style);
      let s;
      if (t.transport === 'http') {
        if (style === 'gemini') s = { httpUrl: envRef(t.url, style) };
        else if (style === 'claude') s = { type: 'http', url: envRef(t.url, style) };
        else if (style === 'windsurf') s = { serverUrl: envRef(t.url, style) };
        else if (style === 'cline') s = { type: 'streamableHttp', url: envRef(t.url, style) };
        else if (style === 'roo') s = { type: 'streamable-http', url: envRef(t.url, style) };
        else if (style === 'vscode' || style === 'droid' || style === 'crush') s = { type: 'http', url: envRef(t.url, style) };
        else if (style === 'antigravity') s = { serverUrl: envRef(t.url, style) };
        else s = { url: envRef(t.url, style) };
        if (Object.keys(headers).length) s.headers = headers;
      } else {
        s = (style === 'vscode' || style === 'droid' || style === 'crush') ? { type: 'stdio', command: t.command } : { command: t.command };
        if (t.args.length) s.args = t.args.map(a => envRef(a, style));
        if (Object.keys(env).length) s.env = env;
        if (t.cwd) s.cwd = t.cwd;
      }
      out[t.name] = s;
    }
    return out;
  }

  function personaBlock(m) {
    const parts = [];
    if (m.agent.persona) parts.push(m.agent.persona);
    return parts.join('\n\n');
  }

  function mainDoc(m, opts) {
    opts = opts || {};
    const out = [marker(m), '', '# ' + m.agent.name, ''];
    const persona = personaBlock(m);
    if (persona && !opts.noPersona) out.push('## Persona', '', persona, '');
    const ins = opts.instructions || m.instructions;
    const titled = x => ins.length > 1 && !/^##\s/.test(x.content.trim()) && x.name && !/^(claude|agents|gemini)(\.local)?\.md$|^\.cursorrules$/i.test(x.name);
    // Keeps instructions that open with a level-1 heading out of the Persona section.
    if (persona && !opts.noPersona && ins.length && !titled(ins[0]) && !/^##\s/.test(ins[0].content.trim())) out.push('## Instructions', '');
    ins.forEach((x, idx) => {
      const showTitle = titled(x);
      if (showTitle) out.push('## ' + x.name.replace(/\.(md|mdc)$/i, ''), '');
      if (x.scope && x.scope.globs && opts.noteGlobs !== false) out.push('_Applies to: ' + x.scope.globs + '_', '');
      out.push(x.content, '');
      void idx;
    });
    const profile = m.memory.filter(x => x.kind === 'profile');
    if (profile.length && !opts.noProfile) out.push('## About the user', '', profile.map(x => x.content).join('\n\n'), '');
    const facts = m.memory.filter(x => x.kind === 'fact');
    if (facts.length && !opts.noFacts) out.push('## ' + (opts.memoryTitle || 'Memory'), '', facts.map(x => '- ' + x.content.replace(/\n+/g, ' ')).join('\n'), '');
    if (opts.extra) out.push(opts.extra, '');
    return trimLines(out.join('\n')) + '\n';
  }

  function commandMd(c, withFm) {
    const data = {};
    if (withFm) {
      if (c.description) data.description = c.description;
      if (c.argumentHint) data['argument-hint'] = c.argumentHint;
      if (withFm === 'claude' && c.allowedTools) data['allowed-tools'] = c.allowedTools;
    }
    return writeFrontmatter(data, c.prompt);
  }

  function skillFiles(s, prefix) {
    return s.files.map(f => ({ path: prefix + '/' + s.slug + '/' + f.path, content: f.bytes ? f.bytes : f.content }));
  }

  function logFiles(m, prefix) {
    return m.memory.filter(x => x.kind === 'log').map(x => ({ path: prefix + slug(x.date, 'log') + '.md', content: trimLines(x.content) + '\n' }));
  }

  function assignSlugs(m) {
    const used = { skills: new Set(), commands: new Set(), subagents: new Set(), instructions: new Set(['identity', 'memory']) };
    for (const s of m.skills) s.slug = uniqueSlug(slug(s.name, 'skill'), used.skills);
    for (const c of m.commands) c.slug = uniqueSlug(slug(c.name, 'command'), used.commands);
    for (const a of m.subagents) a.slug = uniqueSlug(slug(a.name, 'subagent'), used.subagents);
    for (const x of m.instructions) x.slug = uniqueSlug(slug(x.name.replace(/\.(md|mdc)$/i, ''), 'rules'), used.instructions);
  }

  function identityRuleBody(m) {
    const q = s => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const body = ['<!-- barge:identity id="' + q(m.agent.id) + '" name="' + q(m.agent.name) + '" -->', '', '# ' + m.agent.name];
    if (m.agent.persona) body.push('', '## Persona', '', m.agent.persona);
    return body.join('\n');
  }

  function memoryRuleBody(m) {
    const facts = m.memory.filter(x => x.kind === 'fact');
    const profile = m.memory.filter(x => x.kind === 'profile');
    if (!facts.length && !profile.length) return null;
    const body = ['<!-- barge:memory -->'];
    if (profile.length) body.push('## About the user', '', profile.map(x => x.content).join('\n\n'), '');
    if (facts.length) body.push('## Memory', '', facts.map(x => '- ' + x.content.replace(/\n+/g, ' ')).join('\n'));
    return body.join('\n');
  }

  function skillsIndex(m, prefix) {
    if (!m.skills.length) return '';
    return '## Skills\n\n<!-- barge:skills-index -->\nRead the matching file before using a skill.\n\n' +
      m.skills.map(s => '- **' + s.name + '**' + (s.description ? ': ' + s.description : '') + ' (`' + prefix + '/' + s.slug + '/SKILL.md`)').join('\n');
  }

  function commandSkills(m, prefix) {
    const used = new Set(m.skills.map(s => s.slug));
    return m.commands.map(c => {
      const sl = uniqueSlug(c.slug, used);
      return { path: prefix + '/' + sl + '/SKILL.md', content: writeFrontmatter({ name: sl, description: c.description || 'Command /' + c.name }, '<!-- barge:command -->\n' + c.prompt) };
    });
  }

  const WRITERS = {
    'claude-code'(m) {
      const files = [{ path: 'CLAUDE.md', content: mainDoc(m) }];
      for (const c of m.commands) files.push({ path: '.claude/commands/' + c.slug + '.md', content: commandMd(c, 'claude') });
      for (const s of m.skills) files.push(...skillFiles(s, '.claude/skills'));
      for (const a of m.subagents) files.push({ path: '.claude/agents/' + a.slug + '.md', content: writeFrontmatter({ name: a.slug, description: a.description, tools: a.tools, model: a.model }, a.content) });
      if (m.tools.length) files.push({ path: '.mcp.json', content: JSON.stringify({ mcpServers: jsonServers(m, 'claude') }, null, 2) + '\n' });
      const p = m.permissions;
      if (p.allow.length || p.ask.length || p.deny.length) {
        const perms = {};
        for (const k of ['allow', 'ask', 'deny']) if (p[k].length) perms[k] = p[k].slice();
        files.push({ path: '.claude/settings.json', content: JSON.stringify({ permissions: perms }, null, 2) + '\n' });
      }
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    codex(m) {
      const files = [{ path: 'AGENTS.md', content: mainDoc(m) }];
      const lines = [];
      const p = m.permissions;
      if (p.allow.length || p.ask.length || p.deny.length || p.policy) {
        lines.push('# Barge: Codex uses an approval policy instead of rule lists.');
        lines.push('# Your original rules are kept below as comments. Nothing was widened.');
        lines.push('approval_policy = "on-request"');
        lines.push('sandbox_mode = "workspace-write"');
        for (const k of ['allow', 'ask', 'deny']) for (const r of p[k]) lines.push('# barge:' + k + ' ' + r);
        lines.push('');
      }
      for (const t of m.tools) {
        lines.push('[mcp_servers.' + tomlKey(t.name) + ']');
        if (t.transport === 'http') {
          lines.push('url = ' + tomlString(t.url.replace(/\$\{([A-Za-z0-9_]+)\}/g, 'SET_$1')));
          const auth = Object.keys(t.headers).find(k => /^authorization$/i.test(k));
          const ref = auth && /\$\{([A-Za-z0-9_]+)\}/.exec(t.headers[auth]);
          if (ref) lines.push('bearer_token_env_var = ' + tomlString(ref[1]));
          const other = Object.keys(t.headers).filter(k => k !== auth);
          if (other.length) {
            const h = {};
            for (const k of other) h[k] = t.headers[k].replace(/\$\{([A-Za-z0-9_]+)\}/g, 'SET_$1');
            lines.push('http_headers = ' + tomlValue(h));
          }
        } else {
          lines.push('command = ' + tomlString(t.command));
          if (t.args.length) lines.push('args = ' + tomlValue(t.args.map(a => a.replace(/\$\{([A-Za-z0-9_]+)\}/g, 'SET_$1'))));
          const keys = Object.keys(t.env);
          if (keys.length) {
            const env = {};
            const refs = [];
            for (const k of keys) {
              const r = /^\$\{([A-Za-z0-9_]+)\}$/.exec(t.env[k]);
              if (r) { env[k] = 'SET_ME'; refs.push(k); } else env[k] = t.env[k];
            }
            if (refs.length) lines.push('# Barge: replace SET_ME with your value for ' + refs.join(', '));
            lines.push('env = ' + tomlValue(env));
          }
          if (t.cwd) lines.push('cwd = ' + tomlString(t.cwd));
        }
        lines.push('');
      }
      if (lines.length) files.push({ path: '.codex/config.toml', content: trimLines(lines.join('\n')) + '\n' });
      for (const c of m.commands) files.push({ path: '.codex/prompts/' + c.slug + '.md', content: commandMd(c, 'codex') });
      for (const s of m.skills) files.push(...skillFiles(s, '.codex/skills'));
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    cursor(m) {
      const files = [];
      const q = s => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      const idBody = ['<!-- barge:identity id="' + q(m.agent.id) + '" name="' + q(m.agent.name) + '" -->', '', '# ' + m.agent.name];
      if (m.agent.persona) idBody.push('', '## Persona', '', m.agent.persona);
      files.push({ path: '.cursor/rules/identity.mdc', content: writeFrontmatter({ description: 'Who this agent is', alwaysApply: true }, idBody.join('\n')) });
      for (const x of m.instructions) {
        const sc = x.scope || {};
        const desc = sc.description || 'Instructions from ' + x.name;
        const data = sc.globs ? { description: desc, globs: sc.globs, alwaysApply: false } : { description: desc, alwaysApply: sc.alwaysApply !== false };
        files.push({ path: '.cursor/rules/' + x.slug + '.mdc', content: writeFrontmatter(data, x.content) });
      }
      const facts = m.memory.filter(x => x.kind === 'fact');
      const profile = m.memory.filter(x => x.kind === 'profile');
      if (facts.length || profile.length) {
        const body = ['<!-- barge:memory -->'];
        if (profile.length) body.push('## About the user', '', profile.map(x => x.content).join('\n\n'), '');
        if (facts.length) body.push('## Memory', '', facts.map(x => '- ' + x.content.replace(/\n+/g, ' ')).join('\n'));
        files.push({ path: '.cursor/rules/memory.mdc', content: writeFrontmatter({ description: 'What this agent remembers', alwaysApply: true }, body.join('\n')) });
      }
      for (const s of m.skills) {
        files.push(...skillFiles(s, '.cursor/skills'));
        const main = s.files[0] && typeof s.files[0].content === 'string' ? parseFrontmatter(s.files[0].content).body : '';
        const others = s.files.slice(1).map(f => '- `.cursor/skills/' + s.slug + '/' + f.path + '`');
        const body = ['<!-- barge:pointer -->', trimLines(main)];
        if (others.length) body.push('', 'Supporting files:', ...others);
        files.push({ path: '.cursor/rules/skill-' + s.slug + '.mdc', content: writeFrontmatter({ description: s.description || 'Skill: ' + s.name, alwaysApply: false }, body.join('\n')) });
      }
      for (const c of m.commands) files.push({ path: '.cursor/commands/' + c.slug + '.md', content: trimLines(c.prompt) + '\n' });
      if (m.tools.length) files.push({ path: '.cursor/mcp.json', content: JSON.stringify({ mcpServers: jsonServers(m, 'cursor') }, null, 2) + '\n' });
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    'gemini-cli'(m) {
      let extra = '';
      if (m.skills.length) {
        extra = '## Skills\n\n<!-- barge:skills-index -->\nRead the matching file before using a skill.\n\n' +
          m.skills.map(s => '- **' + s.name + '**' + (s.description ? ': ' + s.description : '') + ' (`.gemini/skills/' + s.slug + '/SKILL.md`)').join('\n');
      }
      const files = [{ path: 'GEMINI.md', content: mainDoc(m, { memoryTitle: 'Gemini Added Memories', extra }) }];
      if (m.tools.length) files.push({ path: '.gemini/settings.json', content: JSON.stringify({ mcpServers: jsonServers(m, 'gemini') }, null, 2) + '\n' });
      for (const c of m.commands) {
        const lines = [];
        if (c.description) lines.push('description = ' + tomlString(c.description));
        lines.push('prompt = ' + tomlString(c.prompt.replace(/\$ARGUMENTS/g, '{{args}}')));
        files.push({ path: '.gemini/commands/' + c.slug + '.toml', content: lines.join('\n') + '\n' });
      }
      for (const s of m.skills) files.push(...skillFiles(s, '.gemini/skills'));
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    openclaw(m) {
      const files = [];
      const idDoc = m.source === 'openclaw' && m.agent.identityDoc
        ? m.agent.identityDoc
        : '# IDENTITY.md\n\n- **Name:** ' + m.agent.name;
      files.push({ path: 'IDENTITY.md', content: '<!-- barge-id: ' + m.agent.id + ' -->\n' + trimLines(idDoc) + '\n' });
      if (m.agent.persona) files.push({ path: 'SOUL.md', content: trimLines(m.agent.persona) + '\n' });
      const main = m.instructions.filter(x => x.role !== 'tool-notes');
      const notes = m.instructions.filter(x => x.role === 'tool-notes');
      if (main.length) {
        files.push({ path: 'AGENTS.md', content: mainDoc(m, { instructions: main, noPersona: true, noProfile: true, noFacts: true, noteGlobs: true }) });
      }
      const toolsDoc = [];
      for (const x of notes) toolsDoc.push(x.content, '');
      if (m.tools.length) {
        toolsDoc.push('## MCP servers', '', 'Connect these servers in OpenClaw. Secrets were removed; set the listed variables yourself.', '');
        for (const t of m.tools) toolsDoc.push('- **' + t.name + '**: ' + (t.transport === 'http' ? t.url : [t.command].concat(t.args).join(' ')));
        toolsDoc.push('', '<!-- barge:mcp -->', '```json', JSON.stringify({ mcpServers: jsonServers(m, 'claude') }, null, 2), '```');
      }
      if (toolsDoc.length) files.push({ path: 'TOOLS.md', content: trimLines(toolsDoc.join('\n')) + '\n' });
      const profile = m.memory.filter(x => x.kind === 'profile');
      if (profile.length) files.push({ path: 'USER.md', content: trimLines(profile.map(x => x.content).join('\n\n')) + '\n' });
      const facts = m.memory.filter(x => x.kind === 'fact');
      if (facts.length) files.push({ path: 'MEMORY.md', content: '# MEMORY.md\n\n' + facts.map(x => '- ' + x.content.replace(/\n+/g, ' ')).join('\n') + '\n' });
      files.push(...logFiles(m, 'memory/'));
      for (const s of m.skills) files.push(...skillFiles(s, 'skills'));
      const usedSkill = new Set(m.skills.map(s => s.slug));
      for (const c of m.commands) {
        const sl = uniqueSlug(c.slug, usedSkill);
        files.push({ path: 'skills/' + sl + '/SKILL.md', content: writeFrontmatter({ name: sl, description: c.description || 'Command /' + c.name }, '<!-- barge:command -->\n' + c.prompt) });
      }
      if (m.routines.length) {
        files.push({ path: 'HEARTBEAT.paused.md', content: '# HEARTBEAT (paused by Barge)\n\nRename this file to HEARTBEAT.md to switch these routines on.\n\n' + m.routines.map(r => trimLines(r.content)).join('\n\n') + '\n' });
      }
      return files;
    },

    windsurf(m) {
      const files = [{ path: '.windsurf/rules/identity.md', content: writeFrontmatter({ trigger: 'always_on', description: 'Who this agent is' }, identityRuleBody(m)) }];
      for (const x of m.instructions) {
        const sc = x.scope || {};
        const desc = sc.description || 'Instructions from ' + x.name;
        const data = sc.globs ? { trigger: 'glob', description: desc, globs: sc.globs } : (sc.alwaysApply === false ? { trigger: 'model_decision', description: desc } : { trigger: 'always_on', description: desc });
        files.push({ path: '.windsurf/rules/' + x.slug + '.md', content: writeFrontmatter(data, x.content) });
      }
      const mem = memoryRuleBody(m);
      if (mem) files.push({ path: '.windsurf/rules/memory.md', content: writeFrontmatter({ trigger: 'always_on', description: 'What this agent remembers' }, mem) });
      for (const s of m.skills) {
        files.push(...skillFiles(s, '.windsurf/skills'));
        const main = s.files[0] && typeof s.files[0].content === 'string' ? parseFrontmatter(s.files[0].content).body : '';
        const others = s.files.slice(1).map(f => '- `.windsurf/skills/' + s.slug + '/' + f.path + '`');
        const body = ['<!-- barge:pointer -->', trimLines(main)];
        if (others.length) body.push('', 'Supporting files:', ...others);
        files.push({ path: '.windsurf/rules/skill-' + s.slug + '.md', content: writeFrontmatter({ trigger: 'model_decision', description: s.description || 'Skill: ' + s.name }, body.join('\n')) });
      }
      for (const c of m.commands) files.push({ path: '.windsurf/workflows/' + c.slug + '.md', content: writeFrontmatter({ description: c.description }, c.prompt) });
      if (m.tools.length) files.push({ path: '.codeium/windsurf/mcp_config.json', content: JSON.stringify({ mcpServers: jsonServers(m, 'windsurf') }, null, 2) + '\n' });
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    cline(m) {
      const files = [{ path: '.clinerules/identity.md', content: identityRuleBody(m) + '\n' }];
      for (const x of m.instructions) {
        const sc = x.scope || {};
        const data = sc.globs ? { paths: sc.globs.split(',').map(g => g.trim()).filter(Boolean) } : {};
        files.push({ path: '.clinerules/' + x.slug + '.md', content: writeFrontmatter(data, x.content) });
      }
      const mem = memoryRuleBody(m);
      if (mem) files.push({ path: '.clinerules/memory.md', content: mem + '\n' });
      for (const s of m.skills) files.push(...skillFiles(s, '.clinerules/skills'));
      for (const c of m.commands) files.push({ path: '.clinerules/workflows/' + c.slug + '.md', content: writeFrontmatter({ description: c.description }, c.prompt) });
      if (m.tools.length) files.push({ path: '.cline/data/settings/cline_mcp_settings.json', content: JSON.stringify({ mcpServers: jsonServers(m, 'cline') }, null, 2) + '\n' });
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    goose(m) {
      const files = [{ path: '.goosehints', content: mainDoc(m, { extra: skillsIndex(m, '.goose/skills') }) }];
      for (const s of m.skills) files.push(...skillFiles(s, '.goose/skills'));
      if (m.tools.length) {
        const ext = {};
        for (const t of m.tools) {
          const key = slug(t.name, 'server').replace(/-/g, '_');
          if (t.transport === 'http') {
            const headers = {};
            for (const k of Object.keys(t.headers)) headers[k] = t.headers[k];
            ext[key] = { name: t.name, type: 'streamable_http', uri: t.url, headers, enabled: true, timeout: 300 };
          } else {
            const envs = {}, keys = [];
            for (const k of Object.keys(t.env)) { if (/^\$\{[A-Za-z0-9_]+\}$/.test(t.env[k])) keys.push(k); else envs[k] = t.env[k]; }
            ext[key] = { name: t.name, type: 'stdio', cmd: t.command, args: t.args, enabled: true, envs, env_keys: keys, timeout: 300 };
          }
        }
        files.push({ path: '.config/goose/config.yaml', content: '# Barge: merge these extensions into ~/.config/goose/config.yaml.\n# Secrets are listed in env_keys. Add them with `goose configure`.\nextensions:' + toYAML(ext, 2) + '\n' });
      }
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    aider(m) {
      const files = [{ path: 'CONVENTIONS.md', content: mainDoc(m, { extra: skillsIndex(m, 'conventions/skills') }) }];
      files.push({ path: '.aider.conf.yml', content: '# Barge: load the agent conventions in every session.\nread: [CONVENTIONS.md]\n' });
      for (const s of m.skills) files.push(...skillFiles(s, 'conventions/skills'));
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    hermes(m) {
      const files = [];
      const soul = ['<!-- barge-id: ' + m.agent.id + ' -->', '# ' + m.agent.name];
      if (m.agent.persona) soul.push('', m.agent.persona);
      files.push({ path: '.hermes/SOUL.md', content: soul.join('\n') + '\n' });
      if (m.instructions.length) files.push({ path: 'AGENTS.md', content: mainDoc(m, { noPersona: true, noProfile: true, noFacts: true, noteGlobs: true }) });
      const facts = m.memory.filter(x => x.kind === 'fact');
      if (facts.length) files.push({ path: '.hermes/memories/MEMORY.md', content: facts.map(x => '- ' + x.content.replace(/\n+/g, ' ')).join('\n') + '\n' });
      const profile = m.memory.filter(x => x.kind === 'profile');
      if (profile.length) files.push({ path: '.hermes/memories/USER.md', content: trimLines(profile.map(x => x.content).join('\n\n')) + '\n' });
      files.push(...logFiles(m, '.hermes/memories/logs/'));
      for (const s of m.skills) files.push(...skillFiles(s, '.hermes/skills'));
      files.push(...commandSkills(m, '.hermes/skills'));
      if (m.tools.length) {
        const servers = {};
        for (const t of m.tools) {
          servers[t.name] = t.transport === 'http'
            ? Object.assign({ url: t.url }, Object.keys(t.headers).length ? { headers: t.headers } : {})
            : Object.assign({ command: t.command, args: t.args }, Object.keys(t.env).length ? { env: t.env } : {});
        }
        files.push({ path: '.hermes/config.yaml', content: '# Barge: merge into ~/.hermes/config.yaml. ${VAR} values come from ~/.hermes/.env.\nmcp_servers:' + toYAML(servers, 2) + '\n' });
      }
      return files;
    },

    copilot(m) {
      const scoped = m.instructions.filter(x => x.scope && x.scope.globs);
      const plain = m.instructions.filter(x => !(x.scope && x.scope.globs));
      const files = [{ path: '.github/copilot-instructions.md', content: mainDoc(m, { instructions: plain }) }];
      for (const x of scoped) {
        files.push({ path: '.github/instructions/' + x.slug + '.instructions.md', content: writeFrontmatter({ description: x.scope.description || 'Instructions from ' + x.name, applyTo: x.scope.globs }, x.content) });
      }
      for (const c of m.commands) {
        files.push({ path: '.github/prompts/' + c.slug + '.prompt.md', content: writeFrontmatter({ description: c.description, agent: 'agent' }, c.prompt.replace(/\$ARGUMENTS/g, '${input:args}')) });
      }
      for (const s of m.skills) files.push(...skillFiles(s, '.github/skills'));
      for (const a of m.subagents) files.push({ path: '.github/agents/' + a.slug + '.agent.md', content: writeFrontmatter({ name: a.slug, description: a.description }, a.content) });
      if (m.tools.length) files.push({ path: '.vscode/mcp.json', content: JSON.stringify({ servers: jsonServers(m, 'vscode') }, null, 2) + '\n' });
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    opencode(m) {
      const files = [{ path: 'AGENTS.md', content: mainDoc(m) }];
      const cfg = { $schema: 'https://opencode.ai/config.json' };
      if (m.tools.length) cfg.mcp = ocServers(m);
      const perm = ocPermission(m.permissions);
      if (perm) cfg.permission = perm;
      if (cfg.mcp || cfg.permission) files.push({ path: 'opencode.json', content: JSON.stringify(cfg, null, 2) + '\n' });
      for (const c of m.commands) files.push({ path: '.opencode/commands/' + c.slug + '.md', content: commandMd(c, 'codex') });
      for (const s of m.skills) files.push(...skillFiles(s, '.opencode/skills'));
      for (const a of m.subagents) files.push({ path: '.opencode/agents/' + a.slug + '.md', content: writeFrontmatter({ description: a.description || 'Subagent ' + a.name, mode: 'subagent' }, a.content) });
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    kiro(m) {
      const files = rulesSet(m, '.kiro/steering', (kind, x) => {
        if (kind === 'rule' && x.scope && x.scope.globs) return { inclusion: 'fileMatch', fileMatchPattern: x.scope.globs.split(',').map(g => g.trim()).filter(Boolean) };
        if (kind === 'rule' && x.scope && x.scope.alwaysApply === false) return { inclusion: 'manual', description: x.scope.description };
        return { inclusion: 'always' };
      }, { globs: true });
      for (const c of m.commands) {
        const q = String(c.name).replace(/"/g, '');
        files.push({ path: '.kiro/steering/cmd-' + c.slug + '.md', content: writeFrontmatter({ inclusion: 'manual', description: c.description }, '<!-- barge:command name="' + q + '" -->\n' + c.prompt) });
      }
      for (const s of m.skills) files.push(...skillFiles(s, '.kiro/skills'));
      if (m.tools.length) files.push({ path: '.kiro/settings/mcp.json', content: JSON.stringify({ mcpServers: jsonServers(m, 'claude') }, null, 2) + '\n' });
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    roo(m) {
      const files = rulesSet(m, '.roo/rules', () => null);
      for (const c of m.commands) files.push({ path: '.roo/commands/' + c.slug + '.md', content: commandMd(c, 'codex') });
      for (const s of m.skills) files.push(...skillFiles(s, '.roo/skills'));
      if (m.subagents.length) {
        const modes = m.subagents.map(a => ({ slug: a.slug, name: a.name, roleDefinition: a.content, whenToUse: a.description || 'Use for ' + a.name, groups: ['read', 'edit', 'command', 'mcp'] }));
        files.push({ path: '.roomodes', content: 'customModes:' + toYAML(modes, 2) + '\n' });
      }
      if (m.tools.length) files.push({ path: '.roo/mcp.json', content: JSON.stringify({ mcpServers: jsonServers(m, 'roo') }, null, 2) + '\n' });
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    kilo(m) {
      const files = rulesSet(m, '.kilo/rules', () => null);
      const cfg = { instructions: ['.kilo/rules/*.md'] };
      if (m.tools.length) cfg.mcp = ocServers(m);
      const perm = ocPermission(m.permissions);
      if (perm) cfg.permission = perm;
      files.push({ path: 'kilo.jsonc', content: '// Barge: Kilo Code settings for this agent.\n' + JSON.stringify(cfg, null, 2) + '\n' });
      for (const c of m.commands) files.push({ path: '.kilo/commands/' + c.slug + '.md', content: commandMd(c, 'codex') });
      for (const s of m.skills) files.push(...skillFiles(s, '.kilo/skills'));
      for (const a of m.subagents) files.push({ path: '.kilo/agents/' + a.slug + '.md', content: writeFrontmatter({ description: a.description || 'Subagent ' + a.name, mode: 'subagent' }, a.content) });
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    antigravity(m) {
      const files = [{ path: 'AGENTS.md', content: mainDoc(m) }];
      for (const s of m.skills) files.push(...skillFiles(s, '.agents/skills'));
      files.push(...commandSkills(m, '.agents/skills'));
      for (const a of m.subagents) files.push({ path: '.agents/agents/' + a.slug + '.md', content: writeFrontmatter({ name: a.slug, description: a.description }, a.content) });
      if (m.tools.length) files.push({ path: '.agents/mcp_config.json', content: JSON.stringify({ mcpServers: jsonServers(m, 'antigravity') }, null, 2) + '\n' });
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    qwen(m) {
      const files = [{ path: 'QWEN.md', content: mainDoc(m, { memoryTitle: 'Qwen Added Memories' }) }];
      const settings = {};
      if (m.tools.length) settings.mcpServers = jsonServers(m, 'gemini');
      const p = m.permissions;
      if (p.allow.length || p.ask.length || p.deny.length) {
        settings.permissions = {};
        for (const k of ['allow', 'ask', 'deny']) if (p[k].length) settings.permissions[k] = p[k].slice();
      }
      if (Object.keys(settings).length) files.push({ path: '.qwen/settings.json', content: JSON.stringify(settings, null, 2) + '\n' });
      for (const c of m.commands) {
        const lines = [];
        if (c.description) lines.push('description = ' + tomlString(c.description));
        lines.push('prompt = ' + tomlString(c.prompt.replace(/\$ARGUMENTS/g, '{{args}}')));
        files.push({ path: '.qwen/commands/' + c.slug + '.toml', content: lines.join('\n') + '\n' });
      }
      for (const s of m.skills) files.push(...skillFiles(s, '.qwen/skills'));
      for (const a of m.subagents) files.push({ path: '.qwen/agents/' + a.slug + '.md', content: writeFrontmatter({ name: a.slug, description: a.description || 'Subagent ' + a.name }, a.content) });
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    droid(m) {
      const files = [{ path: 'AGENTS.md', content: mainDoc(m) }];
      for (const c of m.commands) files.push({ path: '.factory/commands/' + c.slug + '.md', content: commandMd(c, 'codex') });
      for (const s of m.skills) files.push(...skillFiles(s, '.factory/skills'));
      for (const a of m.subagents) files.push({ path: '.factory/droids/' + a.slug + '.md', content: writeFrontmatter({ name: a.slug, description: a.description }, a.content) });
      if (m.tools.length) files.push({ path: '.factory/mcp.json', content: JSON.stringify({ mcpServers: jsonServers(m, 'droid') }, null, 2) + '\n' });
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    zed(m) {
      const files = [{ path: '.rules', content: mainDoc(m, { extra: skillsIndex(m, '.zed/skills') }) }];
      for (const s of m.skills) files.push(...skillFiles(s, '.zed/skills'));
      if (m.tools.length) files.push({ path: '.zed/settings.json', content: JSON.stringify({ context_servers: jsonServers(m, 'zed') }, null, 2) + '\n' });
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    continue(m) {
      const files = rulesSet(m, '.continue/rules', (kind, x) => {
        if (kind === 'identity') return { name: 'Identity', alwaysApply: true };
        if (kind === 'memory') return { name: 'Memory', alwaysApply: true };
        const sc = x.scope || {};
        if (sc.globs) return { name: x.name, description: sc.description, globs: sc.globs, alwaysApply: false };
        if (sc.alwaysApply === false) return { name: x.name, description: sc.description || 'Instructions from ' + x.name, alwaysApply: false };
        return { name: x.name, alwaysApply: true };
      }, { globs: true });
      if (m.skills.length) {
        for (const s of m.skills) files.push(...skillFiles(s, '.continue/skills'));
        files.push({ path: '.continue/rules/skills.md', content: writeFrontmatter({ name: 'Skills', alwaysApply: true }, skillsIndex(m, '.continue/skills')) });
      }
      for (const c of m.commands) {
        files.push({ path: '.continue/prompts/' + c.slug + '.md', content: writeFrontmatter({ name: c.slug, description: c.description, invokable: true }, c.prompt.replace(/\$ARGUMENTS/g, '{{{ input }}}')) });
      }
      if (m.tools.length) {
        const list = m.tools.map(t => {
          if (t.transport === 'http') {
            const s = { name: t.name, type: 'streamable-http', url: t.url };
            if (Object.keys(t.headers).length) s.requestOptions = { headers: t.headers };
            return s;
          }
          const s = { name: t.name, command: t.command };
          if (t.args.length) s.args = t.args;
          if (Object.keys(t.env).length) s.env = t.env;
          return s;
        });
        files.push({ path: '.continue/mcpServers/barge.yaml', content: 'name: Barge MCP servers\nversion: 0.0.1\nschema: v1\nmcpServers:' + toYAML(list, 2) + '\n' });
      }
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    junie(m) {
      const files = [{ path: '.junie/AGENTS.md', content: mainDoc(m) }];
      for (const s of m.skills) files.push(...skillFiles(s, '.junie/skills'));
      files.push(...commandSkills(m, '.junie/skills'));
      if (m.tools.length) files.push({ path: '.junie/mcp/mcp.json', content: JSON.stringify({ mcpServers: jsonServers(m, 'claude') }, null, 2) + '\n' });
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    amp(m) {
      const files = [{ path: 'AGENTS.md', content: mainDoc(m) }];
      for (const s of m.skills) files.push(...skillFiles(s, '.agents/skills'));
      files.push(...commandSkills(m, '.agents/skills'));
      if (m.tools.length) files.push({ path: '.amp/settings.json', content: JSON.stringify({ 'amp.mcpServers': jsonServers(m, 'amp') }, null, 2) + '\n' });
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    augment(m) {
      const files = rulesSet(m, '.augment/rules', (kind, x) => {
        if (kind === 'rule' && x.scope && x.scope.alwaysApply === false && !x.scope.globs) return { type: 'agent_requested', description: x.scope.description || 'Instructions from ' + x.name };
        return { type: 'always_apply' };
      });
      for (const c of m.commands) files.push({ path: '.augment/commands/' + c.slug + '.md', content: commandMd(c, 'codex') });
      for (const s of m.skills) files.push(...skillFiles(s, '.agents/skills'));
      if (m.tools.length) files.push({ path: '.augment/settings.json', content: JSON.stringify({ mcpServers: jsonServers(m, 'claude') }, null, 2) + '\n' });
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    trae(m) {
      const files = rulesSet(m, '.trae/rules', (kind, x) => {
        if (kind !== 'rule') return { alwaysApply: true };
        const sc = x.scope || {};
        if (sc.globs) return { description: sc.description, globs: sc.globs, alwaysApply: false };
        if (sc.alwaysApply === false) return { description: sc.description || 'Instructions from ' + x.name, alwaysApply: false };
        return { alwaysApply: true };
      }, { globs: true });
      for (const s of m.skills) files.push(...skillFiles(s, '.trae/skills'));
      files.push(...commandSkills(m, '.trae/skills'));
      if (m.tools.length) files.push({ path: '.trae/mcp.json', content: JSON.stringify({ mcpServers: jsonServers(m, 'claude') }, null, 2) + '\n' });
      files.push(...logFiles(m, 'memory/'));
      return files;
    },

    crush(m) {
      const files = [{ path: 'CRUSH.md', content: mainDoc(m) }];
      for (const s of m.skills) files.push(...skillFiles(s, '.crush/skills'));
      files.push(...commandSkills(m, '.crush/skills'));
      if (m.tools.length) files.push({ path: '.crush.json', content: JSON.stringify({ $schema: 'https://charm.land/crush.json', mcp: jsonServers(m, 'crush') }, null, 2) + '\n' });
      files.push(...logFiles(m, 'memory/'));
      return files;
    }
  };

  /* ------------------------------------------------------------------ */
  /* Planning                                                            */
  /* ------------------------------------------------------------------ */

  const GLOB_TARGETS = new Set(['cursor', 'windsurf', 'cline', 'copilot', 'kiro', 'continue', 'trae']);

  function itemStatus(m, target, item) {
    const cap = CAPS[target][item.kind];
    const notes = NOTES[target] || {};
    let status = cap === 'native' ? 'as-is' : cap;
    let note = cap === 'native' ? '' : (notes[item.kind] || '');
    if (item.kind === 'memory' && item.group === 'log' && target !== 'openclaw') {
      status = 'converted'; note = 'Saved under memory/. Not loaded automatically.';
    }
    if (item.kind === 'memory' && item.group === 'profile' && cap !== 'native') {
      status = 'converted'; note = 'Becomes an "About the user" section.';
    }
    if (item.kind === 'memory' && target === 'gemini-cli' && item.group === 'profile') {
      status = 'converted'; note = 'Becomes an "About the user" section in GEMINI.md.';
    }
    if (item.kind === 'instructions') {
      const x = m.instructions.find(i => i.id === item.id);
      if (x && x.scope && x.scope.globs && !GLOB_TARGETS.has(target)) { status = 'converted'; note = 'Scoped to ' + x.scope.globs + ' at the source. Here it applies everywhere, with the scope noted.'; }
      if (x && x.role === 'tool-notes' && target !== 'openclaw') { note = target === 'cursor' ? 'Becomes an always-on rule.' : 'Joins the main instructions.'; status = 'converted'; }
    }
    if (item.kind === 'commands') {
      const c = m.commands.find(i => i.id === item.id);
      if (c && target === 'cursor' && c.description && status === 'as-is') { status = 'converted'; note = 'Cursor commands have no description field. The prompt travels as-is.'; }
      if (c && c.allowedTools && target !== 'claude-code' && status !== 'none') { status = 'converted'; note = (note ? note + ' ' : '') + 'Its tool restrictions only exist in Claude Code.'; }
    }
    if (item.kind === 'tools') {
      const t = m.tools.find(i => i.id === item.id);
      const refs = t ? JSON.stringify([t.env, t.headers, t.args, t.url]).match(/\$\{[A-Za-z0-9_]+\}/g) : null;
      if (refs && refs.length) {
        if (status === 'as-is') status = 'converted';
        const n = new Set(refs).size;
        note = (note ? note + ' ' : '') + n + ' secret' + (n > 1 ? 's' : '') + ' to reconnect.';
      }
    }
    if (item.kind === 'permissions' && target === 'claude-code' && m.permissions.origin && m.permissions.origin !== 'claude-code') {
      if (!(m.permissions.allow.length + m.permissions.ask.length + m.permissions.deny.length)) { status = 'none'; note = 'Only an approval policy was found. Claude Code keeps its own defaults. ' + KEPT; }
    }
    if (item.kind === 'identity' && target === m.source && CAPS[target].identity !== 'native') {
      status = 'as-is'; note = '';
    }
    return { status, note };
  }

  function plan(manifest, target, excluded) {
    if (!WRITERS[target]) throw new Error('Unknown destination: ' + target);
    const m = selectItems(manifest, excluded);
    const work = clone(Object.assign({}, m, { skills: [] }));
    work.skills = m.skills.map(s => Object.assign({}, s, { files: s.files.map(f => f.bytes ? { path: f.path, bytes: f.bytes } : { path: f.path, content: f.content }) }));
    assignSlugs(work);
    work.target = target;
    const files = WRITERS[target](work);
    const items = listItems(m).map(it => Object.assign(it, itemStatus(m, target, it)));
    const counts = { 'as-is': 0, converted: 0, none: 0 };
    for (const it of items) counts[it.status]++;
    const secrets = [];
    const seen = new Set();
    for (const s of m.secrets || []) {
      const k = s.where + '|' + (s.ref || s.label);
      if (!seen.has(k)) { seen.add(k); secrets.push(s); }
    }
    return { target, files: dedupe(files), items, counts, secrets };
  }

  function dedupe(files) {
    const seen = new Map();
    for (const f of files) {
      const p = safeRel(f.path);
      if (!p) continue;
      seen.set(p, { path: p, content: f.content });
    }
    return [...seen.values()].sort((a, b) => sortKey(a.path).localeCompare(sortKey(b.path)));
  }
  const sortKey = p => (p.includes('/') ? '1' : '0') + p.toLowerCase();

  /* ------------------------------------------------------------------ */
  /* Packages, receipts, bundles                                         */
  /* ------------------------------------------------------------------ */

  function toPackage(m) {
    const out = clone(Object.assign({}, m, { skills: [] }));
    out.format = FORMAT;
    out.skills = m.skills.map(s => ({
      id: s.id, name: s.name, description: s.description, origin: s.origin,
      files: s.files.map(f => f.bytes ? { path: f.path, base64: b64encode(f.bytes) } : { path: f.path, content: f.content })
    }));
    return JSON.stringify(out, null, 2) + '\n';
  }

  function fromPackage(text) {
    return finalize(fromPackageObject(JSON.parse(text)));
  }

  async function sha256(text) {
    const c = globalThis.crypto && globalThis.crypto.subtle;
    if (!c) return null;
    const buf = await c.digest('SHA-256', enc.encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const INSTALL = {
    'claude-code': 'Copy everything into your project root. Claude Code reads CLAUDE.md, .claude/ and .mcp.json from there.',
    codex: 'Copy AGENTS.md into your project root. Copy the contents of .codex/ into ~/.codex/ (config, prompts and skills are global in Codex CLI).',
    cursor: 'Copy .cursor/ into your project root. Restart Cursor so it picks up the rules and MCP servers.',
    'gemini-cli': 'Copy GEMINI.md and .gemini/ into your project root. Run /memory refresh in Gemini CLI.',
    openclaw: 'Copy these files into your OpenClaw workspace (by default ~/.openclaw/workspace). Back up the existing files first.',
    windsurf: 'Copy .windsurf/ into your project root. Merge .codeium/windsurf/mcp_config.json into ~/.codeium/windsurf/mcp_config.json (Windsurf only reads MCP servers from there).',
    cline: 'Copy .clinerules/ into your project root. Merge .cline/data/settings/cline_mcp_settings.json into ~/.cline/data/settings/cline_mcp_settings.json.',
    goose: 'Copy .goosehints and .goose/ into your project root. Merge the extensions in .config/goose/config.yaml into ~/.config/goose/config.yaml.',
    aider: 'Copy CONVENTIONS.md, .aider.conf.yml and conventions/ into your project root. Aider loads CONVENTIONS.md on every session.',
    hermes: 'Copy AGENTS.md into your project root. Copy the contents of .hermes/ into ~/.hermes/ and merge config.yaml. Run /reload-mcp in Hermes.',
    copilot: 'Copy .github/ and .vscode/ into your repository root. Copilot picks up the instructions, prompts, skills, agents and MCP servers from there.',
    opencode: 'Copy AGENTS.md, opencode.json and .opencode/ into your project root. Values like {env:NAME} are read from your environment.',
    kiro: 'Copy .kiro/ into your project root. Kiro loads the steering files, skills and .kiro/settings/mcp.json from there.',
    roo: 'Copy .roo/ and .roomodes into your project root. Roo Code loads the rules, commands, skills, modes and MCP servers from there.',
    kilo: 'Copy .kilo/ and kilo.jsonc into your project root. Values like {env:NAME} are read from your environment.',
    antigravity: 'Copy AGENTS.md and .agents/ into your project root. Antigravity loads the skills, agents and .agents/mcp_config.json from there.',
    qwen: 'Copy QWEN.md and .qwen/ into your project root. Run /memory refresh in Qwen Code.',
    droid: 'Copy AGENTS.md and .factory/ into your project root. Droid loads the commands, skills, droids and MCP servers from there.',
    zed: 'Copy .rules and .zed/ into your project root. If Zed does not list the MCP servers, move context_servers into your Zed settings and fill in any ${NAME} values.',
    continue: 'Copy .continue/ into your project root. Fill in any ${NAME} values in .continue/mcpServers/barge.yaml.',
    junie: 'Copy .junie/ into your project root. Junie reads .junie/AGENTS.md, its skills and .junie/mcp/mcp.json.',
    amp: 'Copy AGENTS.md, .agents/ and .amp/ into your project root. Approve the workspace MCP servers when Amp asks.',
    augment: 'Copy .augment/ and .agents/ into your project root. Merge .augment/settings.json into ~/.augment/settings.json for the MCP servers.',
    trae: 'Copy .trae/ into your project root. Turn on project MCP in Trae settings to load .trae/mcp.json.',
    crush: 'Copy CRUSH.md, .crush/ and .crush.json into your project root. Values like $NAME are read from your environment.'
  };

  const STATUS_LABEL = { 'as-is': 'Carried as-is', converted: 'Converted', none: 'No equivalent' };

  async function bundle(manifest, target, excluded) {
    const p = plan(manifest, target, excluded);
    const selected = selectItems(manifest, excluded);
    const pkgText = toPackage(Object.assign({}, selected, { createdAt: new Date().toISOString() }));
    const fingerprint = await sha256(pkgText);
    const name = slug(manifest.agent.name, 'agent');
    const kindLabel = Object.fromEntries(KINDS.map(k => [k.id, k.label]));
    const r = [];
    r.push('# Barge receipt', '');
    r.push('- Agent: ' + manifest.agent.name + ' (' + manifest.agent.id + ')');
    r.push('- From: ' + (manifest.source ? platformName(manifest.source) : 'unknown'));
    r.push('- To: ' + platformName(target));
    r.push('- Date: ' + new Date().toISOString());
    if (fingerprint) r.push('- Package fingerprint (SHA-256): ' + fingerprint);
    r.push('- Result: ' + p.counts['as-is'] + ' carried as-is, ' + p.counts.converted + ' converted, ' + p.counts.none + ' with no equivalent');
    r.push('', '## Install', '', INSTALL[target], '');
    r.push('Your source agent was never modified. Keep a backup of anything you overwrite.', '');
    r.push('## Items', '');
    for (const it of p.items) r.push('- [' + STATUS_LABEL[it.status] + '] ' + kindLabel[it.kind] + ': ' + it.name + (it.note ? ' · ' + it.note : ''));
    const refs = [...new Set(p.secrets.filter(s => s.ref).map(s => s.ref))];
    if (p.secrets.length) {
      r.push('', '## Secrets', '', 'Barge removed ' + p.secrets.length + ' secret' + (p.secrets.length > 1 ? 's' : '') + ' before export. Nothing secret is in this bundle.');
      if (refs.length) r.push('', 'Set these variables before you use the tools:', '', ...refs.map(x => '- `' + x + '`'));
      const inText = p.secrets.filter(s => !s.ref);
      if (inText.length) r.push('', 'Secrets found inside text were replaced with `[redacted]`:', '', ...inText.map(s => '- ' + s.where + ' (' + s.label + ')'));
    }
    r.push('', '## Restore', '', 'Open `' + name + '.barge` in Barge to move this agent again, to any platform.', '');
    const files = p.files.concat([
      { path: 'BARGE-RECEIPT.md', content: r.join('\n') },
      { path: name + '.barge', content: pkgText }
    ]);
    return { plan: p, files, zip: zip(files), fingerprint, filename: name + '-' + target + '.zip', packageName: name + '.barge', packageText: pkgText };
  }

  // Barge Everywhere: one bundle with the agent laid out for every platform at once.
  // Files several platforms share (AGENTS.md, .agents/...) are written once when they match.
  // When two platforms need different content at the same path, the first keeps the path and
  // the other version is kept under .barge/alt/<platform>/ so nothing is lost.
  async function bundleEverywhere(manifest, excluded) {
    const selected = selectItems(manifest, excluded);
    const pkgText = toPackage(Object.assign({}, selected, { createdAt: new Date().toISOString() }));
    const fingerprint = await sha256(pkgText);
    const name = slug(manifest.agent.name, 'agent');
    const norm = f => (f.bytes ? Array.from(f.bytes).join(',') : String(f.content)).replace(/ for="[^"]*"/g, '');
    const order = PLATFORMS.map(p => p.id);
    if (manifest.source && order.includes(manifest.source)) { order.splice(order.indexOf(manifest.source), 1); order.unshift(manifest.source); }
    const byPath = new Map();
    const alts = [];
    const perPlatform = [];
    const secretRefs = new Set();
    let secretCount = 0;
    for (const id of order) {
      let p;
      try { p = plan(manifest, id, excluded); } catch (e) { perPlatform.push({ id, error: e.message }); continue; }
      secretCount = Math.max(secretCount, p.secrets.length);
      for (const sct of p.secrets) if (sct.ref) secretRefs.add(sct.ref);
      const paths = [];
      for (const f of p.files) {
        const have = byPath.get(f.path);
        if (!have) { byPath.set(f.path, { file: f, key: norm(f), platforms: [id] }); paths.push(f.path); continue; }
        if (have.key === norm(f)) { have.platforms.push(id); paths.push(f.path); continue; }
        const altPath = '.barge/alt/' + id + '/' + f.path;
        alts.push({ path: altPath, from: f.path, id, file: Object.assign({}, f, { path: altPath }) });
        paths.push(altPath);
      }
      perPlatform.push({ id, counts: p.counts, paths });
    }
    const r = [];
    r.push('# Barge Everywhere', '');
    r.push('- Agent: ' + manifest.agent.name + ' (' + manifest.agent.id + ')');
    r.push('- From: ' + (manifest.source ? platformName(manifest.source) : 'unknown'));
    r.push('- To: all ' + perPlatform.filter(x => !x.error).length + ' platforms Barge supports');
    r.push('- Date: ' + new Date().toISOString());
    if (fingerprint) r.push('- Package fingerprint (SHA-256): ' + fingerprint);
    r.push('', 'Copy the contents of this zip into your project root and the same agent works on every platform below.', '');
    r.push('Your source agent was never modified. Keep a backup of anything you overwrite.', '');
    if (secretCount) {
      r.push('## Secrets', '', 'Barge removed ' + secretCount + ' secret' + (secretCount > 1 ? 's' : '') + ' before export. Nothing secret is in this bundle.');
      if (secretRefs.size) r.push('', 'Set these variables before you use the tools:', '', ...[...secretRefs].map(x => '- `' + x + '`'));
      r.push('');
    }
    r.push('## Platforms', '');
    for (const x of perPlatform) {
      if (x.error) { r.push('### ' + platformName(x.id), '', 'Skipped: ' + x.error, ''); continue; }
      r.push('### ' + platformName(x.id), '');
      r.push(x.counts['as-is'] + ' carried as-is, ' + x.counts.converted + ' converted, ' + x.counts.none + ' with no equivalent.', '');
      r.push(INSTALL[x.id], '');
    }
    if (alts.length) {
      r.push('## Shared paths', '', 'Some platforms read the same file but need different content. The first version keeps the path; the others are kept here so nothing is lost:', '');
      for (const a of alts) r.push('- `' + a.from + '` for ' + platformName(a.id) + ': `' + a.path + '`');
      r.push('');
    }
    r.push('## Restore', '', 'Open `' + name + '.barge` in Barge to move this agent again, to any platform.', '');
    const files = [...byPath.values()].map(v => v.file).concat(alts.map(a => a.file)).concat([
      { path: 'BARGE-EVERYWHERE.md', content: r.join('\n') },
      { path: name + '.barge', content: pkgText }
    ]);
    return { files, zip: zip(files), fingerprint, filename: name + '-everywhere.zip', platforms: perPlatform.filter(x => !x.error).length, fileCount: files.length };
  }

  return {
    FORMAT, PLATFORMS, KINDS, CAPS, NOTES, STATUS_LABEL, INSTALL, bundleEverywhere,
    platformName, readAgent, classify, listItems, plan, bundle, toPackage, fromPackage, redactManifest,
    zip, unzip, crc32, parseTOML, parseFrontmatter, redactText, slug, normPath, isBinary, sha256
  };
});
