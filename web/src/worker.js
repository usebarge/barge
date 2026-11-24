// BARGE edge: serves the static site and runs the Barge Orchard API.
// The Orchard stores public .barge packages in one Durable Object. Publishing requires a wallet
// signature, so an author address cannot be faked. Holder status is NOT checked here: the public
// Robinhood Chain RPC refuses Cloudflare's servers, so each visitor's browser reads balances and
// lineage rings straight from the chain and shows the badges itself.
import { verifyMessage, getAddress, id as keccakText } from './vendor/ethers.min.js';
import EngineModule from '../site/assets/js/engine.js';

const E = EngineModule && EngineModule.readAgent ? EngineModule : globalThis.BargeEngine;

const MAX_PACKAGE = 400 * 1024;      // bytes of package text accepted
const CHUNK = 100 * 1024;            // storage value size per chunk
const MAX_AGENTS = 5000;             // hard cap on stored agents
const PUBLISH_COOLDOWN = 120 * 1000; // per address
const SIGNATURE_WINDOW = 10 * 60 * 1000;

const json = (data, status = 200, cache = 0) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': cache ? `public, max-age=${cache}` : 'no-store',
    'x-content-type-options': 'nosniff'
  }
});
const fail = (msg, status = 400) => json({ error: msg }, status);

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const clean = (s, max) => String(s == null ? '' : s)
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

// Parses "Barge Harbor\nAction: x\nKey: value\nTime: iso" into an object.
function parseMessage(message) {
  const lines = String(message || '').split('\n');
  if (lines[0] !== 'Barge Harbor') return null;
  const out = {};
  for (const line of lines.slice(1)) {
    const m = /^([A-Za-z]+): (.+)$/.exec(line);
    if (!m) return null;
    out[m[1].toLowerCase()] = m[2];
  }
  return out;
}

function checkSignature(body, expectAction) {
  const msg = parseMessage(body.message);
  if (!msg || msg.action !== expectAction) return { error: 'Unexpected message.' };
  const t = Date.parse(msg.time);
  if (!t || Math.abs(Date.now() - t) > SIGNATURE_WINDOW) return { error: 'Signature expired. Sign again.' };
  let signer, claimed;
  try {
    claimed = getAddress(String(body.address || ''));
    signer = getAddress(verifyMessage(body.message, String(body.signature || '')));
  } catch (e) {
    return { error: 'Invalid signature.' };
  }
  if (signer !== claimed) return { error: 'Signature does not match the wallet.' };
  return { msg, address: signer };
}

export class Orchard {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const parts = url.pathname.replace(/\/+$/, '').split('/'); // ['', 'api', 'orchard', id?]
    const id = parts[3] ? decodeURIComponent(parts[3]) : null;
    try {
      if (request.method === 'GET' && !id) return await this.list();
      if (request.method === 'GET' && id) return await this.get(id);
      if (request.method === 'POST' && !id) return await this.publish(request);
      if (request.method === 'DELETE' && id) return await this.remove(request, id);
      return fail('Not found.', 404);
    } catch (err) {
      return fail('Server error.', 500);
    }
  }

  async list() {
    const map = await this.storage.list({ prefix: 'm:', limit: MAX_AGENTS });
    return json({ items: [...map.values()] }, 200, 15);
  }

  async get(id) {
    if (!/^[0-9a-z-]{8,40}$/.test(id)) return fail('Not found.', 404);
    const meta = await this.storage.get('m:' + id);
    if (!meta) return fail('Not found.', 404);
    const keys = Array.from({ length: meta.chunks }, (_, i) => 'p:' + id + ':' + i);
    const got = await this.storage.get(keys);
    const pkg = keys.map(k => got.get(k) || '').join('');
    return json({ meta, package: pkg }, 200, 300);
  }

  async publish(request) {
    const raw = await request.text();
    if (raw.length > MAX_PACKAGE + 4096) return fail('Package too large (max 400 KB).', 413);
    let body;
    try { body = JSON.parse(raw); } catch (e) { return fail('Invalid request.'); }
    const pkgText = String(body.package || '');
    if (!pkgText || pkgText.length > MAX_PACKAGE) return fail('Package too large (max 400 KB).', 413);

    const sig = checkSignature(body, 'publish');
    if (sig.error) return fail(sig.error, 401);
    if (sig.msg.package !== await sha256Hex(pkgText)) return fail('The signed package does not match.', 401);

    const last = await this.storage.get('rl:' + sig.address);
    if (last && Date.now() - last < PUBLISH_COOLDOWN) return fail('Wait two minutes between publishes.', 429);

    let m;
    try { m = E.fromPackage(pkgText); } catch (e) { return fail('This is not a valid .barge package.'); }
    E.redactManifest(m); // never trust the client: strip secrets again
    const items = E.listItems(m);
    if (items.length < 2) return fail('This agent is empty.');
    const sanitized = E.toPackage(m);
    const sha = await sha256Hex(sanitized);
    const dupe = await this.storage.get('h:' + sig.address + ':' + sha);
    if (dupe) return fail('You already published this exact agent.', 409);

    const count = (await this.storage.get('count')) || 0;
    if (count >= MAX_AGENTS) return fail('The Harbor is full for now.', 507);

    const now = Date.now();
    const id = String(9999999999999 - now).padStart(13, '0') + '-' + Math.random().toString(36).slice(2, 8);
    const kinds = {};
    for (const it of items) kinds[it.kind] = (kinds[it.kind] || 0) + 1;
    const meta = {
      id,
      name: clean(m.agent.name, 60) || 'Untitled agent',
      description: clean(body.description, 240),
      source: E.PLATFORMS.some(p => p.id === m.source) ? m.source : null,
      agentId: clean(m.agent.id, 64),
      agentHash: keccakText(String(m.agent.id)),
      kinds,
      items: items.length,
      author: sig.address,
      createdAt: new Date(now).toISOString(),
      sha,
      size: sanitized.length,
      chunks: Math.ceil(sanitized.length / CHUNK)
    };
    const writes = { ['m:' + id]: meta, ['h:' + sig.address + ':' + sha]: id, ['rl:' + sig.address]: now, count: count + 1 };
    for (let i = 0; i < meta.chunks; i++) writes['p:' + id + ':' + i] = sanitized.slice(i * CHUNK, (i + 1) * CHUNK);
    await this.storage.put(writes);
    return json({ ok: true, meta }, 201);
  }

  async remove(request, id) {
    let body;
    try { body = await request.json(); } catch (e) { return fail('Invalid request.'); }
    const sig = checkSignature(body, 'delete');
    if (sig.error) return fail(sig.error, 401);
    if (sig.msg.agent !== id) return fail('The signed agent does not match.', 401);
    const meta = await this.storage.get('m:' + id);
    if (!meta) return fail('Not found.', 404);
    if (meta.author !== sig.address) return fail('Only the author can remove this agent.', 403);
    const keys = ['m:' + id, 'h:' + meta.author + ':' + meta.sha];
    for (let i = 0; i < meta.chunks; i++) keys.push('p:' + id + ':' + i);
    await this.storage.delete(keys);
    const count = (await this.storage.get('count')) || 1;
    await this.storage.put('count', Math.max(0, count - 1));
    return json({ ok: true });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === '/api/orchard' || url.pathname.startsWith('/api/orchard/')) {
      const stub = env.ORCHARD.get(env.ORCHARD.idFromName('orchard'));
      return stub.fetch(request);
    }
    if (url.pathname.startsWith('/api/')) return fail('Not found.', 404);
    return env.ASSETS.fetch(request);
  }
};
