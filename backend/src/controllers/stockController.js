const db = require("../../config/db");
const achievementService = require("../services/achievementService");

/* ==========================================================================
   KIS (Korea Investment & Securities) Open API
   Required env vars:
     KIS_APP_KEY      – issued from KIS developer portal
     KIS_APP_SECRET   – issued from KIS developer portal
     KIS_IS_REAL      – set to "true" for real market, omit/false for virtual
   ========================================================================== */

const KIS_APP_KEY = process.env.KIS_APP_KEY || "";
const KIS_APP_SECRET = process.env.KIS_APP_SECRET || "";
const KIS_IS_REAL = process.env.KIS_IS_REAL === "true";

// Real vs virtual trading server base URLs
const KIS_BASE = KIS_IS_REAL
  ? "https://openapi.koreainvestment.com:9443"
  : "https://openapivts.koreainvestment.com:29443";

// ── Rate limiter: max 5 calls/second ─────────────────────────────────────────
// KIS personal free-tier hard cap is 20 req/s. We target 5 req/s (200 ms gap)
// using a sequential promise queue so concurrent callers never burst past it.
const KIS_MIN_INTERVAL_MS = 400; // 1000 ms / 5 calls
let _kisLastCallAt = 0;
let _kisQueue = Promise.resolve();

function kisRateLimit() {
  _kisQueue = _kisQueue.then(() => {
    const now = Date.now();
    const wait = KIS_MIN_INTERVAL_MS - (now - _kisLastCallAt);
    if (wait > 0) return new Promise((r) => setTimeout(r, wait));
  }).then(() => {
    _kisLastCallAt = Date.now();
  });
  return _kisQueue;
}

// ── Daily call counter ────────────────────────────────────────────────────────
// KIS personal free-tier: 10,000 calls/day per TR_ID group (resets midnight KST).
// APP_KEY / APP_SECRET never expire — only the OAuth token does (24 h, auto-refreshed).
const DAILY_CALL_LIMIT = 5000; // buffer below the 10,000 hard limit
let _dailyCallCount = 0;
let _dailyResetDateKST = _todayKST();

function _todayKST() {
  // Korea Standard Time = UTC+9
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
    throw new Error(
      `[KIS] Daily call limit of ${DAILY_CALL_LIMIT} reached. Resets at midnight KST.`
    );
  }
  _dailyCallCount++;
}

// ── OAuth token cache ────────────────────────────────────────────────────────
let _kisToken = null;
let _kisTokenExpiry = 0;
let _kisTokenInFlight = null;

/**
 * Fetch (or return cached) OAuth2 access token from KIS.
 * Tokens are valid for ~24 h; we refresh 5 minutes early.
 */
async function getKisToken() {
  const now = Date.now();

  // 1. Return cached token if valid
  if (_kisToken && now < _kisTokenExpiry) return _kisToken;

  // 2. If a request is already in progress, return that same promise
  if (_kisTokenInFlight) return _kisTokenInFlight;

  // 3. Create a new promise for the fetch and store it
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

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`KIS token error ${res.status}: ${text}`);
      }

      const data = await res.json();
      _kisToken = data.access_token;
      _kisTokenExpiry = now + (Number(data.expires_in || 86400) - 300) * 1000;
      return _kisToken;
    } finally {
      // Clear the in-flight tracker so future expires/refreshes can trigger
      _kisTokenInFlight = null;
    }
  })();

  return _kisTokenInFlight;
}

/**
 * Generic KIS REST GET call.
 * @param {string} path   - API path, e.g. "/uapi/domestic-stock/v1/quotations/inquire-price"
 * @param {object} query  - URL query parameters
 * @param {string} trId   - KIS TR_ID header (identifies the endpoint)
 */
async function kisGet(path, query = {}, trId) {
  checkDailyLimit();    // throws if daily quota exhausted
  await kisRateLimit(); // enforces 5 req/s via sequential promise queue

  const token = await getKisToken();
  const url = new URL(`${KIS_BASE}${path}`);
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, String(v));
  }

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

  // EGW00201 = per-second rate limit hit despite our limiter (e.g. server clock skew).
  // Retry once after 1 s before giving up.
  if (res.status === 500) {
    const body = await res.json().catch(() => ({}));
    if (body?.msg_cd === "EGW00201") {
      console.warn(`[KIS] Rate limit hit (EGW00201) on ${path} — retrying in 1 s`);
      await new Promise((r) => setTimeout(r, 1000));
      return kisGet(path, query, trId); // single retry
    }
    throw new Error(`KIS ${path} failed 500: ${JSON.stringify(body)}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KIS ${path} failed ${res.status}: ${text}`);
  }

  return res.json();
}

// ── KIS market data helpers ──────────────────────────────────────────────────

/**
 * Fetch the current price quote for a single 6-digit KRX stock code.
 *
 * KIS endpoint : GET /uapi/domestic-stock/v1/quotations/inquire-price
 * TR_ID (real) : FHKST01010100
 * TR_ID (vts)  : VHKST01010100
 *
 * Key response fields (output object):
 *   stck_prpr – 주식 현재가  (current price)
 *   prdy_vrss – 전일 대비    (change vs previous close)
 *   prdy_ctrt – 전일 대비율  (change %, e.g. "1.23")
 *   acml_vol  – 누적 거래량  (accumulated volume)
 */

function normalizeStockCode(value) {
  if (!value) return "000000";
  // Strip Yahoo suffixes (.KS, .KQ) and take the first 6 digits
  const cleanCode = String(value).split('.')[0].trim().replace(/^[^0-9]+/, '');
  return cleanCode.padStart(6, "0");
}

async function getQuoteByCode(stockCode) {
  const code = normalizeStockCode(stockCode);
  const trId = KIS_IS_REAL ? "FHKST01010100" : "VHKST01010100";

  try {
    const data = await kisGet(
      "/uapi/domestic-stock/v1/quotations/inquire-price",
      {
        FID_COND_MRKT_DIV_CODE: "J", // J = domestic stock (KOSPI + KOSDAQ)
        FID_INPUT_ISCD: code,
      },
      trId
    );

    if (data?.rt_cd !== "0") {
      console.warn(`KIS quote non-zero rt_cd for ${code}:`, data?.msg1);
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
    console.error(`getQuoteByCode(${code}) error:`, err.message);
    return null;
  }
}

/**
 * Fetch OHLCV candle history for a stock from KIS.
 *
 * KIS endpoint : GET /uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice
 * TR_ID (real) : FHKST03010100
 * TR_ID (vts)  : VHKST03010100
 *
 * Key request params:
 *   FID_INPUT_DATE_1    – start date "YYYYMMDD"
 *   FID_INPUT_DATE_2    – end date   "YYYYMMDD"
 *   FID_PERIOD_DIV_CODE – D (daily) | W (weekly) | M (monthly)
 *   FID_ORG_ADJ_PRC     – 1 = adjusted price (권리 수정 주가)
 *
 * Key response fields per row (output2 array):
 *   stck_bsop_date – 영업일자 "YYYYMMDD"
 *   stck_oprc      – 시가
 *   stck_hgpr      – 고가
 *   stck_lwpr      – 저가
 *   stck_clpr      – 종가
 *   acml_vol       – 누적 거래량
 */
async function fetchKisCandles(code, startDate, endDate, periodCode) {
  const trId = KIS_IS_REAL ? "FHKST03010100" : "VHKST03010100";

  const data = await kisGet(
    "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice",
    {
      FID_COND_MRKT_DIV_CODE: "J",
      FID_INPUT_ISCD: code,
      FID_INPUT_DATE_1: startDate,
      FID_INPUT_DATE_2: endDate,
      FID_PERIOD_DIV_CODE: periodCode,
      FID_ORG_ADJ_PRC: "1",
    },
    trId
  );

  if (data?.rt_cd !== "0") {
    throw new Error(`KIS candle error for ${code}: ${data?.msg1}`);
  }

  const rows = data?.output2;
  if (!Array.isArray(rows) || rows.length === 0) return [];

  return rows
    .filter((r) => r.stck_bsop_date && Number(r.stck_clpr) > 0)
    .map((r) => {
      // Parse "YYYYMMDD" → Date object
      const ds = String(r.stck_bsop_date);
      const dateObj = new Date(
        Number(ds.slice(0, 4)),
        Number(ds.slice(4, 6)) - 1,
        Number(ds.slice(6, 8))
      );
      return {
        x: dateObj,
        o: Number(r.stck_oprc || 0), // 시가
        h: Number(r.stck_hgpr || 0), // 고가
        l: Number(r.stck_lwpr || 0), // 저가
        c: Number(r.stck_clpr || 0), // 종가
        v: Number(r.acml_vol || 0), // 거래량
      };
    })
    .sort((a, b) => a.x - b.x); // oldest → newest
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Convert a Date object to KIS "YYYYMMDD" string */
function toKisDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** Return a new Date that is `days` before today */
function dateMinusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// ── Response helpers ──────────────────────────────────────────────────────────

function success(res, message, data = null, status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function fail(res, message, error = null, status = 500) {
  return res.status(status).json({ success: false, message, error });
}

function extractMemberId(req) {
  if (!req.user || typeof req.user !== "object") return null;
  const rawId =
    req.user.member_id ??
    req.user.id ??
    req.user.memberId ??
    req.user.userId ??
    null;
  const memberId = Number(rawId);
  return Number.isInteger(memberId) && memberId > 0 ? memberId : null;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function insertPointHistory(executor, memberId, changeAmount, reason) {
  await executor.query(
    `INSERT INTO point_history (member_id, change_amount, reason, created_at)
     VALUES (?, ?, ?, NOW())`,
    [memberId, Number(changeAmount || 0), String(reason || "포인트 변동")]
  );
}

async function insertTradeHistory(
  executor, memberId, stockCode, stockName, tradeType, quantity, price
) {
  await executor.query(
    `INSERT INTO trade_history
     (member_id, stock_code, stock_name, trade_type, quantity, price, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [
      memberId, normalizeStockCode(stockCode), stockName,
      tradeType, Number(quantity || 0), Number(price || 0),
    ]
  );
}

async function insertGameLogOnBuy(executor, memberId, stockCode, quantity, unitPrice) {
  const normalizedStockCode = normalizeStockCode(stockCode);
  const betAmount = Math.round(Number(quantity || 0) * Number(unitPrice || 0));

  await executor.query(
    `INSERT INTO gameLog
     (member_id, stock_code, prediction, bet_amount, pnl_amount, penalty_amount,
      status, created_at, strategy_type_user, strategy_type_actual, holding_time, market_trend)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
    [
      memberId, normalizedStockCode, "UP", betAmount, 0, 0,
      "PENDING", "SWING", "SWING", null, "UNKNOWN",
    ]
  );
}

async function settleGameLogOnSell(
  executor, memberId, stockCode, sellQuantity, sellUnitPrice, avgBuyPrice
) {
  const normalizedStockCode = normalizeStockCode(stockCode);
  const quantity = Number(sellQuantity || 0);
  const unitPrice = Number(sellUnitPrice || 0);
  const avgPrice = Number(avgBuyPrice || 0);

  const pnlAmount = Math.round((unitPrice - avgPrice) * quantity);
  const penaltyAmount = pnlAmount < 0 ? Math.abs(pnlAmount) : 0;
  const status = pnlAmount >= 0 ? "SUCCESS" : "FAIL";

  const [[pendingRow]] = await executor.query(
    `SELECT log_id FROM gameLog
     WHERE member_id = ? AND stock_code = ? AND status = 'PENDING'
     ORDER BY created_at DESC, log_id DESC LIMIT 1`,
    [memberId, normalizedStockCode]
  );

  if (pendingRow?.log_id) {
    await executor.query(
      `UPDATE gameLog
       SET pnl_amount = ?, penalty_amount = ?, status = ?,
           strategy_type_actual = ?, market_trend = ?
       WHERE log_id = ?`,
      [
        pnlAmount, penaltyAmount, status,
        "SWING", pnlAmount >= 0 ? "BULL" : "BEAR",
        pendingRow.log_id,
      ]
    );
    return;
  }

  await executor.query(
    `INSERT INTO gameLog
     (member_id, stock_code, prediction, bet_amount, pnl_amount, penalty_amount,
      status, created_at, strategy_type_user, strategy_type_actual, holding_time, market_trend)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
    [
      memberId, normalizedStockCode,
      unitPrice >= avgPrice ? "UP" : "DOWN",
      Math.round(quantity * avgPrice),
      pnlAmount, penaltyAmount, status,
      "SWING", "SWING", null,
      pnlAmount >= 0 ? "BULL" : "BEAR",
    ]
  );
}

// ── Achievement helpers ───────────────────────────────────────────────────────

function toDateOnlyString(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function hasConsecutiveDays(dateStrings, requiredDays) {
  const uniqueSortedDesc = [...new Set(dateStrings)].sort(
    (a, b) => parseDateOnly(b) - parseDateOnly(a)
  );
  if (uniqueSortedDesc.length < requiredDays) return false;

  for (let start = 0; start <= uniqueSortedDesc.length - requiredDays; start++) {
    let ok = true;
    for (let i = 0; i < requiredDays - 1; i++) {
      const curr = parseDateOnly(uniqueSortedDesc[start + i]);
      const next = parseDateOnly(uniqueSortedDesc[start + i + 1]);
      if (Math.round((curr - next) / 86400000) !== 1) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

function analyzeTradeHistory(tradeRows) {
  const holdings = new Map();
  const sellEvents = [];

  for (const row of tradeRows) {
    const stockCode = normalizeStockCode(row.stock_code);
    const tradeType = String(row.trade_type || "").toLowerCase();
    const quantity = Number(row.quantity || 0);
    const price = Number(row.price || 0);

    const holding = holdings.get(stockCode) || { quantity: 0, avgPrice: 0 };

    if (tradeType === "buy") {
      const nextQty = holding.quantity + quantity;
      const nextAvg = nextQty > 0
        ? (holding.quantity * holding.avgPrice + quantity * price) / nextQty
        : 0;
      holdings.set(stockCode, { quantity: nextQty, avgPrice: nextAvg });
      continue;
    }

    if (tradeType === "sell") {
      const qtyToSell = Math.min(quantity, holding.quantity);
      const avgPrice = Number(holding.avgPrice || 0);
      const profitAmount = (price - avgPrice) * qtyToSell;
      const profitRate = avgPrice > 0 ? ((price - avgPrice) / avgPrice) * 100 : 0;
      const isProfit = profitAmount > 0;

      sellEvents.push({
        stockCode, quantity: qtyToSell, sellPrice: price,
        avgPrice, createdAt: row.created_at,
        profitAmount, profitRate, isProfit,
      });

      const remainQty = Math.max(holding.quantity - qtyToSell, 0);
      holdings.set(stockCode, { quantity: remainQty, avgPrice: remainQty > 0 ? avgPrice : 0 });
    }
  }

  return { sellEvents };
}

function getMaxProfitStreak(sellEvents) {
  let streak = 0, max = 0;
  for (const item of sellEvents) {
    if (item.isProfit) { streak++; if (streak > max) max = streak; }
    else streak = 0;
  }
  return max;
}

async function checkAndGrantStockAchievements(memberId, context = {}) {
  const grantedIds = [];

  const [tradeRows] = await db.promise().query(
    `SELECT history_id, stock_code, trade_type, quantity, price, created_at
     FROM trade_history WHERE member_id = ?
     ORDER BY created_at ASC, history_id ASC`,
    [memberId]
  );

  const tradeDates = tradeRows.map((r) => toDateOnlyString(r.created_at));
  const buyDates = tradeRows
    .filter((r) => String(r.trade_type).toLowerCase() === "buy")
    .map((r) => toDateOnlyString(r.created_at));

  const distinctStockCount = new Set(
    tradeRows.map((r) => normalizeStockCode(r.stock_code))
  ).size;

  const { sellEvents } = analyzeTradeHistory(tradeRows);
  const totalProfitTrades = sellEvents.filter((e) => e.isProfit).length;
  const last3 = sellEvents.slice(-3);
  const last10 = sellEvents.slice(-10);
  const maxStreak = getMaxProfitStreak(sellEvents);

  const grant = async (id) => {
    const granted = await achievementService.grantAchievementIfNotExists(memberId, id);
    if (granted) grantedIds.push(id);
  };

  if (
    context.tradeType === "buy" &&
    Number(context.preTradePoints || 0) > 0 &&
    Number(context.totalCost || 0) >= Number(context.preTradePoints || 0) * 0.5
  ) await grant(3);

  if (hasConsecutiveDays(buyDates, 3)) await grant(4);

  if (last3.length === 3 && last3.every((e) => Number(e.profitRate) >= -5)) await grant(5);

  if (last10.length === 10) {
    const winRate = last10.filter((e) => e.isProfit).length / 10;
    if (winRate >= 0.7) await grant(6);
  }

  if (maxStreak >= 3) await grant(7);

  for (let i = 1; i < sellEvents.length; i++) {
    if (!sellEvents[i - 1].isProfit && sellEvents[i].isProfit) { await grant(8); break; }
  }

  if (distinctStockCount >= 30) await grant(9);
  if (totalProfitTrades >= 1) await grant(14);
  if (maxStreak >= 5) await grant(15);
  if (maxStreak >= 7) await grant(16);
  if (totalProfitTrades >= 50) await grant(17);

  {
    let pendingLoss = 0, recovered = false;
    for (const item of sellEvents) {
      if (item.profitAmount < 0) pendingLoss += Math.abs(item.profitAmount);
      else if (pendingLoss > 0) {
        pendingLoss -= item.profitAmount;
        if (pendingLoss <= 0) { recovered = true; break; }
      }
    }
    if (recovered) await grant(18);
  }

  if (hasConsecutiveDays(tradeDates, 3)) await grant(24);
  if (hasConsecutiveDays(tradeDates, 30)) await grant(25);
  if (distinctStockCount >= 5) await grant(27);
  if (distinctStockCount >= 15) await grant(28);

  return { grantedCount: grantedIds.length, grantedIds };
}

// ── Stock metadata ────────────────────────────────────────────────────────────
// Exchange legend:
//   KOSPI  – Korea Stock Exchange main board  (FID_COND_MRKT_DIV_CODE: "J")
//   KOSDAQ – Korea tech/growth board          (FID_COND_MRKT_DIV_CODE: "Q")
//
// ⚠️  VTS (virtual trading server, KIS_IS_REAL=false) only supports KOSPI.
//     KOSDAQ codes will return "없는 서비스 코드" on VTS — they are filtered
//     out of TOP_100_STOCKS automatically when running in virtual mode.

const KOR_NAME_MAP = {
  // ── KOSPI ──────────────────────────────────────────────────────────────────
  "005930": "삼성전자", "000660": "SK하이닉스", "373220": "LG에너지솔루션",
  "207940": "삼성바이오로직스", "005380": "현대차", "000270": "기아",
  "068270": "셀트리온", "005490": "POSCO홀딩스", "051910": "LG화학",
  "012330": "현대모비스", "028260": "삼성물산", "105560": "KB금융",
  "055550": "신한지주", "066570": "LG전자", "032830": "삼성생명",
  "096770": "SK이노베이션", "034730": "SK", "015760": "한국전력",
  "033780": "KT&G", "009150": "삼성전기", "017670": "SK텔레콤",
  "011200": "HMM", "018260": "삼성SDS", "316140": "우리금융지주",
  "010130": "고려아연", "003550": "LG", "000810": "삼성화재",
  "010950": "S-Oil", "051900": "LG생활건강", "329180": "HD현대중공업",
  "011170": "롯데케미칼", "161390": "한국타이어앤테크놀로지", "004020": "현대제철",
  "047050": "포스코인터내셔널", "005830": "DB손해보험", "090430": "아모레퍼시픽",
  "241560": "두산밥캣", "024110": "기업은행", "008770": "호텔신라",
  "001450": "현대해상", "029780": "삼성카드", "000100": "유한양행",
  "001440": "대한전선", "006400": "삼성SDI", "012450": "한화에어로스페이스",
  "042660": "한화오션", "010140": "삼성중공업", "009830": "한화솔루션",
  "000880": "한화", "028050": "팬오션", "078930": "GS",
  "047810": "한국항공우주", "272210": "한화시스템", "003490": "대한항공",
  "000120": "CJ대한통운", "097950": "CJ제일제당", "001040": "CJ",
  "004990": "롯데지주", "023530": "롯데쇼핑", "007070": "GS리테일",
  "139480": "이마트", "006800": "미래에셋증권", "016360": "삼성증권",
  "005940": "NH투자증권", "031430": "신세계", "128940": "한미약품",
  "002380": "KCC", "000080": "하이트진로", "030200": "KT",
  "032640": "LG유플러스", "008930": "한미사이언스",

  // ── KOSDAQ ─────────────────────────────────────────────────────────────────
  // ⚠️  These fail on VTS (virtual server) — only work with KIS_IS_REAL=true
  "035420": "NAVER", "035720": "카카오", "003670": "포스코퓨처엠",
  "086520": "에코프로", "323410": "카카오뱅크", "011070": "LG이노텍",
  "042700": "한미반도체", "247540": "에코프로비엠", "028300": "HLB",
  "066970": "엘앤에프", "352820": "하이브", "036570": "엔씨소프트",
  "259960": "크래프톤", "377300": "카카오페이", "322310": "현대오토에버",
  "145020": "휴젤", "214150": "클래시스", "196170": "알테오젠",
  "035900": "JYP Ent.", "041510": "에스엠", "122870": "와이지엔터테인먼트",
  "293490": "카카오게임즈", "263750": "펄어비스", "112040": "위메이드",
  "011790": "SKC", "014680": "한솔케미칼", "298380": "에코프로머티",
  "020150": "일진머티리얼즈", "039490": "키움증권",
};

// Stocks confirmed on KOSDAQ — filtered out automatically in VTS mode
const KOSDAQ_CODES = new Set([
  "035420", "035720", "003670", "086520", "323410", "011070", "042700",
  "247540", "028300", "066970", "352820", "036570", "259960", "377300",
  "322310", "145020", "214150", "196170", "035900", "041510", "122870",
  "293490", "263750", "112040", "011790", "014680", "298380", "020150", "039490",
]);

// In VTS mode only KOSPI is supported, so exclude KOSDAQ codes entirely
const TOP_100_STOCKS = KIS_IS_REAL
  ? Object.keys(KOR_NAME_MAP)
  : Object.keys(KOR_NAME_MAP).filter((code) => !KOSDAQ_CODES.has(code));

// ── Stock list cache (5 min TTL) ──────────────────────────────────────────────
let cachedStocks = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

/* ==========================================================================
   1) 전체 종목 / 검색 / 인기 / 상승 / 하락
   ========================================================================== */
exports.getAllStocks = async (req, res) => {
  // Rate limiting (5 req/s) and daily quota are enforced inside kisGet()
  // via the module-level kisRateLimit() and checkDailyLimit() functions.
  try {
    const { type = "popular", keyword = "" } = req.query;

    // ── Keyword search: query DB then enrich with live KIS prices ────────────
    if (keyword) {
      const [rows] = await db.promise().query("SELECT * FROM stocks");
      const uniqueRows = [];
      const seenCodes = new Set();

      for (const row of rows) {
        const code = normalizeStockCode(
          row.stock_code || row["단축코드"] || Object.values(row)[0] || ""
        );
        const name = String(
          row.stock_name || row["한글 종목명"] || Object.values(row)[1] || ""
        );

        if ((name.includes(keyword) || code.includes(keyword)) && !seenCodes.has(code)) {
          seenCodes.add(code);
          uniqueRows.push({ code, name });
        }
      }

      const results = [];
      for (const item of uniqueRows.slice(0, 20)) {
        const quote = await getQuoteByCode(item.code).catch(() => null);
        results.push({
          symbol: item.code,
          name: item.name,
          price: Number(quote?.regularMarketPrice || 0),
          change: Number(quote?.regularMarketChange || 0),
          rate: Number(quote?.regularMarketChangePercent || 0),
        });
      }

      return success(res, "검색 성공", results);
    }

    // ── Tabbed list: use cache or fetch all via KIS ───────────────────────────
    let realResults = [];

    if (cachedStocks && Date.now() - lastFetchTime < CACHE_TTL) {
      realResults = [...cachedStocks];
    } else {
      // kisGet() enforces ≤5 req/s automatically — no manual delay needed.
      for (const code of TOP_100_STOCKS) {
        const quote = await getQuoteByCode(code).catch(() => null);
        if (!quote) continue;

        realResults.push({
          symbol: code,
          name: KOR_NAME_MAP[code] || code,
          price: Number(quote.regularMarketPrice || 0),
          change: Number(quote.regularMarketChange || 0),
          rate: Number(quote.regularMarketChangePercent || 0),
          volume: Number(quote.volume || 0),
        });
        console.log(code)
      }
      if (cachedStocks && Date.now() - lastFetchTime < CACHE_TTL) {
        realResults = [...cachedStocks];
      } else {
        // 100개를 모두 돌면 40초(400ms * 100)가 걸리므로 
        // 상위 50개 정도로 제한하거나, 배경에서 따로 업데이트하는 것을 권장합니다.
        const targetStocks = TOP_100_STOCKS.slice(0, 50);

        for (const code of targetStocks) {
          const quote = await getQuoteByCode(code);
          if (!quote) continue; // 없는 종목은 무시

          realResults.push({
            symbol: code,
            name: KOR_NAME_MAP[code] || code,
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            rate: quote.regularMarketChangePercent,
            volume: quote.volume,
          });
        }
        cachedStocks = [...realResults];
        lastFetchTime = Date.now();
      }

      cachedStocks = [...realResults];
      lastFetchTime = Date.now();
    }

    let filteredResults = [...realResults];

    if (type === "popular") {
      // Sort by volume desc; fall back to predefined market-cap order when equal
      filteredResults.sort((a, b) => {
        if (b.volume !== a.volume) return b.volume - a.volume;
        return TOP_100_STOCKS.indexOf(a.symbol) - TOP_100_STOCKS.indexOf(b.symbol);
      });
    } else if (type === "rising") {
      filteredResults = filteredResults.filter((i) => i.rate > 0);
      filteredResults.sort((a, b) => b.rate - a.rate);
    } else if (type === "falling") {
      filteredResults = filteredResults.filter((i) => i.rate < 0);
      filteredResults.sort((a, b) => a.rate - b.rate);
    }

    return success(res, `${type} 실시간 조회 성공`, filteredResults.slice(0, 20));
  } catch (err) {
    console.error("getAllStocks error =", err);
    return fail(res, "조회 실패", err.message, 500);
  }
};

/* ==========================================================================
   2) 캔들 차트 조회
   ========================================================================== */
exports.getStockChart = async (req, res) => {
  try {
    const symbol = req.params.stockCode;
    if (!symbol) return fail(res, "종목 코드가 필요합니다.", null, 400);

    const { range = "6mo" } = req.query;

    // Map frontend range label → { lookback days, KIS period code }
    const rangeMap = {
      "30d": { days: 30, period: "D" },
      "6mo": { days: 180, period: "D" },
      "2y": { days: 730, period: "W" },
      "5y": { days: 1825, period: "M" },
      "10y": { days: 3650, period: "M" },
    };

    const { days, period } = rangeMap[range] ?? rangeMap["6mo"];
    const endDate = toKisDate(new Date());
    const startDate = toKisDate(dateMinusDays(days));
    const code = normalizeStockCode(symbol);

    const candles = await fetchKisCandles(code, startDate, endDate, period);

    if (!candles || candles.length === 0) {
      return fail(res, "차트 데이터를 찾을 수 없습니다.", null, 404);
    }

    return success(res, "Chart data fetched", candles);
  } catch (err) {
    console.error("getStockChart error =", err);
    return fail(res, err.message, null, 500);
  }
};

/* ==========================================================================
   3) 현재가 조회
   ========================================================================== */
exports.getStockPrice = async (req, res) => {
  try {
    const symbol = req.params.stockCode;
    const cleanCode = normalizeStockCode(symbol);
    const quote = await getQuoteByCode(cleanCode);

    if (!quote) {
      return fail(res, "해당 종목을 찾을 수 없습니다.", null, 404);
    }

    return success(res, "현재가 조회 성공", {
      symbol: cleanCode,
      price: Number(quote.regularMarketPrice || 0),
      change: Number(quote.regularMarketChange || 0),
      rate: Number(quote.regularMarketChangePercent || 0),
    });
  } catch (err) {
    console.error("getStockPrice error =", err);
    return fail(res, "주식 조회 실패", err.message, 500);
  }
};

/* ==========================================================================
   4) 찜한 주식 조회
   ========================================================================== */
exports.getLikedStocks = async (req, res) => {
  try {
    const memberId = extractMemberId(req);
    if (!memberId) return fail(res, "인증이 필요합니다.", null, 401);

    const [rows] = await db.promise().query(
      `SELECT l.id, l.member_id, l.stock_code, l.created_at, s.stock_name
       FROM liked_stocks l
       INNER JOIN stocks s ON l.stock_code = s.stock_code
       WHERE l.member_id = ?
       ORDER BY l.created_at DESC, l.id DESC`,
      [memberId]
    );

    const result = await Promise.all(
      rows.map(async (row) => {
        const quote = await getQuoteByCode(row.stock_code).catch(() => null);
        return {
          id: row.id,
          memberId: row.member_id,
          stockCode: normalizeStockCode(row.stock_code),
          stockName: row.stock_name,
          price: Number(quote?.regularMarketPrice || 0),
          change: Number(quote?.regularMarketChange || 0),
          rate: Number(quote?.regularMarketChangePercent || 0),
          createdAt: row.created_at,
        };
      })
    );

    return success(res, "관심 주식 조회 성공", result);
  } catch (err) {
    console.error("getLikedStocks error =", err);
    return fail(res, "관심 주식 조회 실패", err.message, 500);
  }
};

/* ==========================================================================
   5) 보유 주식 조회
   ========================================================================== */
exports.getOwnedStocks = async (req, res) => {
  try {
    const memberId = extractMemberId(req);
    if (!memberId) return fail(res, "인증이 필요합니다.", null, 401);

    const [rows] = await db.promise().query(
      `SELECT o.id, o.member_id, o.stock_code, o.quantity, o.avg_price,
              o.created_at, o.updated_at, s.stock_name
       FROM owned_stocks o
       INNER JOIN stocks s ON o.stock_code = s.stock_code
       WHERE o.member_id = ?
       ORDER BY o.created_at DESC, o.id DESC`,
      [memberId]
    );

    const result = await Promise.all(
      rows.map(async (row) => {
        const quote = await getQuoteByCode(row.stock_code).catch(() => null);
        const price = Number(quote?.regularMarketPrice || 0);
        const changeRate = Number(quote?.regularMarketChangePercent || 0);
        const quantity = Number(row.quantity || 0);
        const avgPrice = Number(row.avg_price || 0);

        return {
          id: row.id,
          memberId: row.member_id,
          stockCode: normalizeStockCode(row.stock_code),
          stockName: row.stock_name,
          quantity,
          avgPrice,
          price,
          principal: avgPrice * quantity,
          totalPrice: price * quantity,
          changeAmount: (price - avgPrice) * quantity,
          myChangeRate: avgPrice > 0
            ? Number((((price - avgPrice) / avgPrice) * 100).toFixed(2))
            : 0,
          changeRate,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      })
    );

    return success(res, "보유 주식 조회 성공", result);
  } catch (err) {
    console.error("getOwnedStocks error =", err);
    return fail(res, "보유 주식 조회 실패", err.message, 500);
  }
};

/* ==========================================================================
   6) 찜하기 / 찜해제 토글
   ========================================================================== */
exports.toggleLikeStock = async (req, res) => {
  try {
    const memberId = extractMemberId(req);
    if (!memberId) return fail(res, "인증이 필요합니다.", null, 401);

    const stockCode = normalizeStockCode(req.params.stockCode);
    if (!stockCode) return fail(res, "종목 코드가 필요합니다.", null, 400);

    const [[stockRow]] = await db.promise().query(
      `SELECT stock_code, stock_name FROM stocks WHERE stock_code = ? LIMIT 1`,
      [stockCode]
    );
    if (!stockRow) return fail(res, "존재하지 않는 종목입니다.", null, 404);

    const [[likedRow]] = await db.promise().query(
      `SELECT id FROM liked_stocks WHERE member_id = ? AND stock_code = ? LIMIT 1`,
      [memberId, stockCode]
    );

    if (likedRow) {
      await db.promise().query(`DELETE FROM liked_stocks WHERE id = ?`, [likedRow.id]);
      return success(res, "관심 해제 성공", {
        liked: false, stockCode, stockName: stockRow.stock_name,
      });
    }

    await db.promise().query(
      `INSERT INTO liked_stocks (member_id, stock_code) VALUES (?, ?)`,
      [memberId, stockCode]
    );
    return success(res, "관심 추가 성공", {
      liked: true, stockCode, stockName: stockRow.stock_name,
    });
  } catch (err) {
    console.error("toggleLikeStock error =", err);
    return fail(res, "관심 처리 실패", err.message, 500);
  }
};

/* ==========================================================================
   7) 매수
   ========================================================================== */
exports.buyStock = async (req, res) => {
  let conn = null;

  try {
    const memberId = extractMemberId(req);
    if (!memberId) return fail(res, "인증이 필요합니다.", null, 401);

    const stockCode = normalizeStockCode(req.params.stockCode);
    const quantity = Number(req.body?.quantity);
    const unitPrice = Number(req.body?.unitPrice);

    if (!stockCode) return fail(res, "종목 코드가 필요합니다.", null, 400);
    if (!Number.isInteger(quantity) || quantity <= 0) return fail(res, "수량은 1 이상의 정수여야 합니다.", null, 400);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return fail(res, "현재가 정보가 올바르지 않습니다.", null, 400);

    conn = await db.promise().getConnection();
    await conn.beginTransaction();

    const [[memberRow]] = await conn.query(
      `SELECT member_id, points FROM members WHERE member_id = ? FOR UPDATE`,
      [memberId]
    );
    if (!memberRow) { await conn.rollback(); return fail(res, "사용자 정보를 찾을 수 없습니다.", null, 404); }

    const currentPoints = Number(memberRow.points || 0);
    const totalCost = Math.round(unitPrice * quantity);
    if (currentPoints < totalCost) { await conn.rollback(); return fail(res, "보유 포인트가 부족합니다.", null, 400); }

    const [[stockRow]] = await conn.query(
      `SELECT stock_code, stock_name FROM stocks WHERE stock_code = ? LIMIT 1`,
      [stockCode]
    );
    if (!stockRow) { await conn.rollback(); return fail(res, "존재하지 않는 종목입니다.", null, 404); }

    const stockName = stockRow.stock_name || stockCode;

    const [[ownedRow]] = await conn.query(
      `SELECT id, quantity, avg_price FROM owned_stocks
       WHERE member_id = ? AND stock_code = ? LIMIT 1 FOR UPDATE`,
      [memberId, stockCode]
    );

    if (ownedRow) {
      const currentQty = Number(ownedRow.quantity || 0);
      const currentAvg = Number(ownedRow.avg_price || 0);
      const nextQty = currentQty + quantity;
      const nextAvg = nextQty > 0
        ? (currentQty * currentAvg + quantity * unitPrice) / nextQty
        : unitPrice;
      await conn.query(
        `UPDATE owned_stocks SET quantity = ?, avg_price = ?, updated_at = NOW() WHERE id = ?`,
        [nextQty, nextAvg, ownedRow.id]
      );
    } else {
      await conn.query(
        `INSERT INTO owned_stocks (member_id, stock_code, quantity, avg_price) VALUES (?, ?, ?, ?)`,
        [memberId, stockCode, quantity, unitPrice]
      );
    }

    await conn.query(
      `UPDATE members SET points = points - ? WHERE member_id = ?`, [totalCost, memberId]
    );
    await insertPointHistory(conn, memberId, -totalCost, `[매수] ${stockName} ${quantity}주`);
    await insertTradeHistory(conn, memberId, stockCode, stockName, "buy", quantity, unitPrice);
    await insertGameLogOnBuy(conn, memberId, stockCode, quantity, unitPrice);

    const [[updatedMember]] = await conn.query(
      `SELECT points FROM members WHERE member_id = ? LIMIT 1`, [memberId]
    );

    await conn.commit();

    let stockAchievementResult = { grantedCount: 0, grantedIds: [] };
    try {
      stockAchievementResult = await checkAndGrantStockAchievements(memberId, {
        tradeType: "buy", preTradePoints: currentPoints, totalCost,
      });
      await achievementService.checkAndGrantAchievements(memberId);
    } catch (err) {
      console.error("buyStock achievement error =", err);
    }

    return success(res, `${stockName} ${quantity}주 매수 완료`, {
      stockCode, stockName, quantity, unitPrice, totalCost,
      remainingPoints: Number(updatedMember?.points || 0),
      achievements: stockAchievementResult,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("buyStock error =", err);
    return fail(res, "매수 실패", err.message, 500);
  } finally {
    if (conn) conn.release();
  }
};

/* ==========================================================================
   8) 매도
   ========================================================================== */
exports.sellStock = async (req, res) => {
  let conn = null;

  try {
    const memberId = extractMemberId(req);
    if (!memberId) return fail(res, "인증이 필요합니다.", null, 401);

    const stockCode = normalizeStockCode(req.params.stockCode);
    const quantity = Number(req.body?.quantity);
    const unitPrice = Number(req.body?.unitPrice);

    if (!stockCode) return fail(res, "종목 코드가 필요합니다.", null, 400);
    if (!Number.isInteger(quantity) || quantity <= 0) return fail(res, "수량은 1 이상의 정수여야 합니다.", null, 400);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return fail(res, "현재가 정보가 올바르지 않습니다.", null, 400);

    conn = await db.promise().getConnection();
    await conn.beginTransaction();

    const [[memberRow]] = await conn.query(
      `SELECT member_id, points FROM members WHERE member_id = ? FOR UPDATE`,
      [memberId]
    );
    if (!memberRow) { await conn.rollback(); return fail(res, "사용자 정보를 찾을 수 없습니다.", null, 404); }

    const [[stockRow]] = await conn.query(
      `SELECT stock_code, stock_name FROM stocks WHERE stock_code = ? LIMIT 1`,
      [stockCode]
    );
    if (!stockRow) { await conn.rollback(); return fail(res, "존재하지 않는 종목입니다.", null, 404); }

    const stockName = stockRow.stock_name || stockCode;

    const [[ownedRow]] = await conn.query(
      `SELECT id, quantity, avg_price FROM owned_stocks
       WHERE member_id = ? AND stock_code = ? LIMIT 1 FOR UPDATE`,
      [memberId, stockCode]
    );
    if (!ownedRow) { await conn.rollback(); return fail(res, "보유 중인 종목이 아닙니다.", null, 400); }

    const currentQty = Number(ownedRow.quantity || 0);
    const avgPrice = Number(ownedRow.avg_price || 0);

    if (currentQty < quantity) {
      await conn.rollback();
      return fail(res, "보유 수량보다 많이 매도할 수 없습니다.", null, 400);
    }

    const totalSale = Math.round(unitPrice * quantity);
    const remainQty = currentQty - quantity;

    if (remainQty === 0) {
      await conn.query(`DELETE FROM owned_stocks WHERE id = ?`, [ownedRow.id]);
    } else {
      await conn.query(
        `UPDATE owned_stocks SET quantity = ?, updated_at = NOW() WHERE id = ?`,
        [remainQty, ownedRow.id]
      );
    }

    await conn.query(
      `UPDATE members SET points = points + ? WHERE member_id = ?`, [totalSale, memberId]
    );
    await insertPointHistory(conn, memberId, totalSale, `[매도] ${stockName} ${quantity}주`);
    await insertTradeHistory(conn, memberId, stockCode, stockName, "sell", quantity, unitPrice);
    await settleGameLogOnSell(conn, memberId, stockCode, quantity, unitPrice, avgPrice);

    const [[updatedMember]] = await conn.query(
      `SELECT points FROM members WHERE member_id = ? LIMIT 1`, [memberId]
    );

    await conn.commit();

    let stockAchievementResult = { grantedCount: 0, grantedIds: [] };
    try {
      stockAchievementResult = await checkAndGrantStockAchievements(memberId, { tradeType: "sell" });
      await achievementService.checkAndGrantAchievements(memberId);
    } catch (err) {
      console.error("sellStock achievement error =", err);
    }

    return success(res, `${stockName} ${quantity}주 매도 완료`, {
      stockCode, stockName, quantity, unitPrice, totalSale, remainQty,
      remainingPoints: Number(updatedMember?.points || 0),
      achievements: stockAchievementResult,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("sellStock error =", err);
    return fail(res, "매도 실패", err.message, 500);
  } finally {
    if (conn) conn.release();
  }
};