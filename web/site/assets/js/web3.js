/* Barge wallet + chain helpers.
 * The wallet is only ever asked for access after a click. Nothing connects on page load.
 * Reads go straight from the browser to the public Robinhood Chain RPC. */
(function () {
  'use strict';
  const C = window.BARGE_CONFIG || {};
  const SEL = {
    balanceOf: '0x70a08231',
    totalSupply: '0x18160ddd',
    ring: '0x3b3a55aa',
    ringCount: '0x5b0c1c6e',
    lineages: '0xcf0bce40',
    totalRings: '0xe98583f3',
    ringsOf: '0x4872411b',
    stamp: '0x2938f3ec',
    passport: '0xb733b951',
    passportOf: '0xdb1ce4dc',
    passportTotal: '0x2ddbd13a'
  };
  const isAddr = a => /^0x[0-9a-fA-F]{40}$/.test(String(a || ''));
  const word = hex => String(hex).replace(/^0x/, '').toLowerCase().padStart(64, '0');
  const addrWord = a => word(String(a).slice(2));
  const toHex = n => '0x' + Number(n).toString(16);

  /* ---------- Reads (no wallet needed) ---------- */
  let rpcId = 1;
  async function rpcBatch(calls) {
    if (!calls.length) return [];
    const body = calls.map(c => ({ jsonrpc: '2.0', id: rpcId++, method: c.method, params: c.params }));
    const res = await fetch(C.rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('RPC ' + res.status);
    const out = await res.json();
    const arr = Array.isArray(out) ? out : [out];
    const byId = new Map(arr.map(r => [r.id, r]));
    return body.map(b => { const r = byId.get(b.id); return r && !r.error ? r.result : null; });
  }
  const ethCall = (to, data) => ({ method: 'eth_call', params: [{ to, data }, 'latest'] });
  const big = hex => (hex && hex !== '0x' ? BigInt(hex) : 0n);

  // Returns Map(address -> true/false) for holder status, or null when the token is not live yet.
  async function holders(addresses) {
    if (!isAddr(C.ca)) return null;
    const uniq = [...new Set(addresses.filter(isAddr).map(a => a.toLowerCase()))];
    const calls = [ethCall(C.ca, SEL.totalSupply)].concat(uniq.map(a => ethCall(C.ca, SEL.balanceOf + addrWord(a))));
    const out = new Map();
    for (let i = 0; i < calls.length; i += 50) {
      const res = await rpcBatch(calls.slice(i, i + 50));
      res.forEach((r, k) => { out.set(i + k, r); });
    }
    const supply = big(out.get(0));
    const map = new Map();
    uniq.forEach((a, k) => {
      const bal = big(out.get(k + 1));
      map.set(a, supply > 0n && bal * 10000n >= supply * BigInt(C.holdBps || 10));
    });
    return map;
  }

  // pairs: [{holder, agentHash}] -> Map("holder|hash" -> count). Null when no lineage contract.
  async function ringCounts(pairs) {
    if (!isAddr(C.lineage)) return null;
    const list = pairs.filter(p => isAddr(p.holder) && /^0x[0-9a-fA-F]{64}$/.test(p.agentHash || ''));
    const calls = list.map(p => ethCall(C.lineage, SEL.ringCount + addrWord(p.holder) + word(p.agentHash)));
    const map = new Map();
    for (let i = 0; i < calls.length; i += 50) {
      const res = await rpcBatch(calls.slice(i, i + 50));
      res.forEach((r, k) => { const p = list[i + k]; map.set(p.holder.toLowerCase() + '|' + p.agentHash.toLowerCase(), Number(big(r))); });
    }
    return map;
  }

  async function lineageTotals() {
    if (!isAddr(C.lineage)) return null;
    const [a, b] = await rpcBatch([ethCall(C.lineage, SEL.lineages), ethCall(C.lineage, SEL.totalRings)]);
    return { lineages: Number(big(a)), rings: Number(big(b)) };
  }

  // Latest Ringed events from the Lineage contract, newest first.
  const RINGED = '0x70b4a10c77ddd7c58c984ff21bbe83f09220dfe85bb134f1fb1685e63543e4ea';
  const LINEAGE_FROM = '0x747ab41'; // deploy block
  async function recentRings(limit) {
    if (!isAddr(C.lineage)) return null;
    const q = from => rpcBatch([{ method: 'eth_getLogs', params: [{ address: C.lineage, fromBlock: from, toBlock: 'latest', topics: [RINGED] }] }]).then(r => r[0]);
    let logs = await q(LINEAGE_FROM);
    if (!Array.isArray(logs)) {
      const [head] = await rpcBatch([{ method: 'eth_blockNumber', params: [] }]);
      const recent = Number(big(head)) - 500000;
      logs = await q(toHex(Math.max(recent, parseInt(LINEAGE_FROM, 16))));
    }
    if (!Array.isArray(logs)) return [];
    const last = logs.slice(-(limit || 8)).reverse();
    const blocks = [...new Set(last.map(l => l.blockNumber))];
    const res = await rpcBatch(blocks.map(b => ({ method: 'eth_getBlockByNumber', params: [b, false] })));
    const ts = new Map(blocks.map((b, i) => [b, res[i] ? Number(big(res[i].timestamp)) * 1000 : 0]));
    return last.map(l => {
      const d = String(l.data).replace(/^0x/, '');
      return {
        holder: '0x' + l.topics[1].slice(-40),
        agentHash: l.topics[2].toLowerCase(),
        fromIdx: parseInt(d.slice(64, 128), 16),
        toIdx: parseInt(d.slice(128, 192), 16),
        tx: l.transactionHash,
        time: ts.get(l.blockNumber) || 0
      };
    });
  }

  /* ---------- Passports ---------- */
  const W32 = 64;
  const at = (hex, i) => hex.slice(i * W32, (i + 1) * W32);
  const utf8 = new TextDecoder();
  function decodeString(hex, wordIdx) {
    const len = Number(BigInt('0x' + at(hex, wordIdx)));
    const bytes = hex.slice((wordIdx + 1) * W32, (wordIdx + 1) * W32 + len * 2);
    return utf8.decode(new Uint8Array((bytes.match(/../g) || []).map(b => parseInt(b, 16))));
  }
  async function passportTotal() {
    if (!isAddr(C.passport)) return null;
    const [r] = await rpcBatch([ethCall(C.passport, SEL.passportTotal)]);
    return Number(big(r));
  }
  function decodePassport(id, result) {
    if (!result || result === '0x') return null;
    const h = result.replace(/^0x/, '');
    const base = Number(BigInt('0x' + at(h, 0))) / 32; // tuple start, in words
    const w = i => at(h, base + i);
    const nameOff = Number(BigInt('0x' + w(7))) / 32;
    return {
      id,
      holder: '0x' + w(0).slice(24),
      agentId: '0x' + w(1),
      fingerprint: w(2),
      issuedAt: Number(BigInt('0x' + w(3))) * 1000,
      updatedAt: Number(BigInt('0x' + w(4))) * 1000,
      version: Number(BigInt('0x' + w(5))),
      source: Number(BigInt('0x' + w(6))),
      name: decodeString(h, base + nameOff)
    };
  }
  async function readPassports(ids) {
    if (!isAddr(C.passport) || !ids.length) return [];
    const res = await rpcBatch(ids.map(id => ethCall(C.passport, SEL.passport + word(Number(id).toString(16)))));
    return ids.map((id, i) => decodePassport(id, res[i])).filter(Boolean);
  }
  async function passportOf(holder, agentHashHex) {
    if (!isAddr(C.passport)) return 0;
    const [r] = await rpcBatch([ethCall(C.passport, SEL.passportOf + addrWord(holder) + word(agentHashHex))]);
    return Number(big(r));
  }
  async function ringsOf(holder, agentHashHex) {
    if (!isAddr(C.lineage)) return [];
    const [r] = await rpcBatch([ethCall(C.lineage, SEL.ringsOf + addrWord(holder) + word(agentHashHex))]);
    if (!r || r === '0x') return [];
    const h = r.replace(/^0x/, '');
    const n = Number(BigInt('0x' + at(h, 1)));
    const out = [];
    for (let i = 0; i < n; i++) {
      const b = 2 + i * 4;
      out.push({ fingerprint: at(h, b), time: Number(BigInt('0x' + at(h, b + 1))) * 1000, fromIdx: Number(BigInt('0x' + at(h, b + 2))), toIdx: Number(BigInt('0x' + at(h, b + 3))) });
    }
    return out;
  }
  // Issues or re-stamps the caller's passport for this agent. Returns the transaction hash.
  async function stampPassport(agentId, fingerprintHex, sourceIdx, name) {
    if (!isAddr(C.passport)) throw new Error('Passports open as soon as the contract is live.');
    if (!state.address) throw new Error('Connect your wallet first.');
    const fp = String(fingerprintHex).replace(/^0x/, '');
    if (!/^[0-9a-f]{64}$/i.test(fp)) throw new Error('Missing package fingerprint.');
    let nameBytes = new TextEncoder().encode(String(name || '').trim() || 'Agent');
    if (nameBytes.length > 64) nameBytes = nameBytes.slice(0, 64);
    while (nameBytes.length && (nameBytes[nameBytes.length - 1] & 0xC0) === 0x80) nameBytes = nameBytes.slice(0, -1); // keep valid UTF-8
    if (nameBytes.length && nameBytes[nameBytes.length - 1] >= 0xC0) nameBytes = nameBytes.slice(0, -1);
    const nameHex = [...nameBytes].map(b => b.toString(16).padStart(2, '0')).join('');
    const padded = nameHex.padEnd(Math.ceil(nameHex.length / 64) * 64 || 64, '0');
    const hash = await agentHash(agentId);
    await ensureChain();
    const data = SEL.stamp + word(hash) + word(fp) + word(Number(sourceIdx).toString(16)) + word('80') + word(nameBytes.length.toString(16)) + padded;
    return provider().request({ method: 'eth_sendTransaction', params: [{ from: state.address, to: C.passport, data }] });
  }

  /* ---------- Wallet (only after a click) ---------- */
  const listeners = new Set();
  const state = { address: null };
  const emit = () => listeners.forEach(fn => { try { fn(state.address); } catch (e) { /* ignore */ } });
  const provider = () => window.ethereum || null;
  let hooked = false;

  function hook(p) {
    if (hooked || !p || !p.on) return;
    hooked = true;
    p.on('accountsChanged', accs => {
      if (!state.address) return; // stay disconnected until the user clicks Connect again
      state.address = accs && accs[0] ? accs[0] : null;
      emit();
    });
  }

  async function connect() {
    const p = provider();
    if (!p) throw new Error('No wallet found. Install a browser wallet such as MetaMask or Rabby.');
    const accs = await p.request({ method: 'eth_requestAccounts' });
    if (!accs || !accs[0]) throw new Error('No account was shared.');
    state.address = accs[0];
    hook(p);
    emit();
    return state.address;
  }

  async function disconnect() {
    const p = provider();
    state.address = null;
    emit();
    try { if (p) await p.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }); } catch (e) { /* not every wallet supports it */ }
  }

  function utf8Hex(s) {
    return '0x' + [...new TextEncoder().encode(s)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function sign(message) {
    if (!state.address) throw new Error('Connect your wallet first.');
    return provider().request({ method: 'personal_sign', params: [utf8Hex(message), state.address] });
  }

  async function ensureChain() {
    const p = provider();
    const hex = toHex(C.chainId);
    const current = await p.request({ method: 'eth_chainId' });
    if (String(current).toLowerCase() === hex) return;
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    } catch (err) {
      if (err && (err.code === 4902 || /unrecognized|not added/i.test(err.message || ''))) {
        await p.request({ method: 'wallet_addEthereumChain', params: [{ chainId: hex, chainName: C.chainName, rpcUrls: [C.rpc], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: [C.explorer] }] });
      } else throw err;
    }
  }

  let ethersPromise = null;
  function loadEthers() {
    if (window.ethers) return Promise.resolve(window.ethers);
    if (!ethersPromise) {
      ethersPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'assets/vendor/ethers.umd.min.js';
        s.onload = () => resolve(window.ethers);
        s.onerror = () => { ethersPromise = null; reject(new Error('Could not load the wallet library.')); };
        document.head.appendChild(s);
      });
    }
    return ethersPromise;
  }

  async function agentHash(agentId) {
    const e = await loadEthers();
    return e.id(String(agentId));
  }

  // Writes a lineage ring. Returns the transaction hash.
  async function ring(agentId, fingerprintHex, fromIdx, toIdx) {
    if (!isAddr(C.lineage)) throw new Error('The lineage contract is not live yet.');
    if (!state.address) throw new Error('Connect your wallet first.');
    if (!/^[0-9a-f]{64}$/i.test(String(fingerprintHex).replace(/^0x/, ''))) throw new Error('Missing package fingerprint.');
    const hash = await agentHash(agentId);
    await ensureChain();
    const data = SEL.ring + word(hash) + word(fingerprintHex) + word(Number(fromIdx).toString(16)) + word(Number(toIdx).toString(16));
    return provider().request({ method: 'eth_sendTransaction', params: [{ from: state.address, to: C.lineage, data }] });
  }

  async function waitReceipt(txHash, timeoutMs) {
    const end = Date.now() + (timeoutMs || 120000);
    while (Date.now() < end) {
      const [r] = await rpcBatch([{ method: 'eth_getTransactionReceipt', params: [txHash] }]).catch(() => [null]);
      if (r) return r;
      await new Promise(res => setTimeout(res, 2500));
    }
    return null;
  }

  const short = a => a ? a.slice(0, 6) + '…' + a.slice(-4) : '';

  window.BargeWeb3 = {
    get address() { return state.address; },
    hasWallet: () => !!provider(),
    onChange: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    connect, disconnect, sign, ring, waitReceipt, agentHash,
    holders, ringCounts, lineageTotals, recentRings,
    passportLive: () => isAddr(C.passport), passportTotal, readPassports, passportOf, ringsOf, stampPassport,
    tokenLive: () => isAddr(C.ca),
    lineageLive: () => isAddr(C.lineage),
    txUrl: h => C.explorer + '/tx/' + h,
    addressUrl: a => C.explorer + '/address/' + a,
    short
  };
})();
