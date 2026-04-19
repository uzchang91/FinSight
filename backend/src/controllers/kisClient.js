/**
 * kisClient.js — shared KIS API infrastructure
 *
 * Single source of truth for:
 *   - OAuth token (cached 24 h, refreshed 5 min early)
 *   - Rate limiter (250 ms between calls = 4 req/s)
 *   - Daily call counter (resets at midnight KST)
 *   - getQuoteByCode() — current price for one stock code
 *   - normalizeStockCode() — strips suffixes, pads to 6 digits
 *
 * Both stockController and rankingController require this file.
 * Node's module cache guarantees they share the same token, counter, and queue.
 */

const KIS_APP_KEY    = process.env.KIS_APP_KEY    || "";
const KIS_APP_SECRET = process.env.KIS_APP_SECRET || "";
const KIS_IS_REAL    = process.env.KIS_IS_REAL === "true";

const KIS_BASE = KIS_IS_REAL
  ? "https://openapi.koreainvestment.com:9443"
  : "https://openapivts.koreainvestment.com:29443";

// ── Rate limiter ──────────────────────────────────────────────────────────────
const KIS_MIN_INTERVAL_MS = 250;
let _kisLastCallAt = 0;
let _kisQueue = Promise.resolve();

function kisRateLimit() {
  _kisQueue = _kisQueue
    .then(() => {
      const wait = KIS_MIN_INTERVAL_MS - (Date.now() - _kisLastCallAt);
      if (wait > 0) return new Promise((r) => setTimeout(r, wait));
    })
    .then(() => { _kisLastCallAt = Date.now(); });
  return _kisQueue;
}

// ── Daily call counter ────────────────────────────────────────────────────────
const DAILY_CALL_LIMIT = 8000;
let _dailyCallCount = 0;
let _dailyResetDateKST = _todayKST();

function _todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function checkDailyLimit() {
  const today = _todayKST();
  if (_dailyResetDateKST !== today) {
    console.log(`[KIS] Daily counter reset (${_dailyCallCount} calls yesterday)`);
    _dailyCallCount = 0;
    _dailyResetDateKST = today;
  }
  if (_dailyCallCount >= DAILY_CALL_LIMIT) {
    throw new Error(`[KIS] Daily call limit of ${DAILY_CALL_LIMIT} reached. Resets at midnight KST.`);
  }
  _dailyCallCount++;
}

// ── OAuth token ───────────────────────────────────────────────────────────────
let _kisToken = null;
let _kisTokenExpiry = 0;
let _kisTokenInFlight = null;

async function getKisToken() {
  const now = Date.now();
  if (_kisToken && now < _kisTokenExpiry) return _kisToken;
  if (_kisTokenInFlight) return _kisTokenInFlight;

  _kisTokenInFlight = (async () => {
    try {
      const res = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          appkey: KIS_APP_KEY,
          appsecret: KIS_APP_SECRET,
        }),
      });
      if (!res.ok) throw new Error(`KIS token error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      _kisToken = data.access_token;
      _kisTokenExpiry = now + (Number(data.expires_in || 86400) - 300) * 1000;
      return _kisToken;
    } finally {
      _kisTokenInFlight = null;
    }
  })();

  return _kisTokenInFlight;
}

// ── Generic GET ───────────────────────────────────────────────────────────────
async function kisGet(path, query = {}, trId) {
  checkDailyLimit();
  await kisRateLimit();

  const token = await getKisToken();
  const url = new URL(`${KIS_BASE}${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      appkey: KIS_APP_KEY,
      appsecret: KIS_APP_SECRET,
      tr_id: trId,
      custtype: "P",
    },
  });

  if (res.status === 500) {
    const body = await res.json().catch(() => ({}));
    if (body?.msg_cd === "EGW00201") {
      console.warn(`[KIS] Rate limit hit on ${path} — retrying in 1 s`);
      await new Promise((r) => setTimeout(r, 1000));
      return kisGet(path, query, trId);
    }
    throw new Error(`KIS ${path} failed 500: ${JSON.stringify(body)}`);
  }

  if (!res.ok) throw new Error(`KIS ${path} failed ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Public helpers ────────────────────────────────────────────────────────────

function normalizeStockCode(value) {
  if (!value) return "000000";
  const clean = String(value).split(".")[0].trim().replace(/^[^0-9]+/, "");
  return clean.padStart(6, "0");
}

async function getQuoteByCode(stockCode) {
  const code = normalizeStockCode(stockCode);
  const trId = KIS_IS_REAL ? "FHKST01010100" : "VHKST01010100";

  try {
    const data = await kisGet(
      "/uapi/domestic-stock/v1/quotations/inquire-price",
      { FID_COND_MRKT_DIV_CODE: "J", FID_INPUT_ISCD: code },
      trId
    );

    if (data?.rt_cd !== "0") {
      console.warn(`[KIS] Non-zero rt_cd for ${code}: ${data?.msg1}`);
      return null;
    }

    const o = data?.output ?? {};
    const price = Number(o.stck_prpr || 0);
    if (price <= 0) return null;

    return {
      regularMarketPrice: price,
      regularMarketChange: Number(o.prdy_vrss || 0),
      regularMarketChangePercent: Number(o.prdy_ctrt || 0),
      volume: Number(o.acml_vol || 0),
    };
  } catch (err) {
    console.error(`[KIS] getQuoteByCode(${code}) failed: ${err.message}`);
    return null;
  }
}

module.exports = { kisGet, getQuoteByCode, normalizeStockCode, KIS_IS_REAL };