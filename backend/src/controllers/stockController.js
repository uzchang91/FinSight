const db = require("../../config/db");
const axios = require("axios");
const yahooFinance = require('yahoo-finance2').default;

function success(res, message, data = null, status = 200) {
  return res.status(status).json({ success: true, message, data });
}
function fail(res, message, error = null, status = 500) {
  return res.status(status).json({ success: false, message, error });
}

function extractMemberId(req) {
  if (!req.user || typeof req.user !== "object") return null;
  return req.user.member_id || req.user.id || req.user.memberId || req.user.userId || null;
}

// 🌟 1. 실시간 20개 리스트 & 주식 검색 (DB 전체 종목 진짜 데이터 정렬!)
exports.getAllStocks = async (req, res) => {
  try {
    const { type = 'popular', keyword = '' } = req.query;

    // A. SEARCH LOGIC (from File 1)
    if (keyword) {
      const [rows] = await db.promise().query("SELECT * FROM stocks");
      const uniqueRows = [];
      const seenCodes = new Set();

      for (const row of rows) {
        const code = String(row.stock_code || row['단축코드'] || Object.values(row)[0] || '').padStart(6, '0');
        const name = String(row.stock_name || row['한글 종목명'] || Object.values(row)[1] || '');
        if ((name.includes(keyword) || code.includes(keyword)) && !seenCodes.has(code)) {
          seenCodes.add(code);
          uniqueRows.push({ code, name });
        }
      }

      const results = [];
      for (const item of uniqueRows.slice(0, 5)) {
        try {
          let quote = await yahooFinance.quote(`${item.code}.KS`).catch(() => null);
          if (!quote) quote = await yahooFinance.quote(`${item.code}.KQ`).catch(() => null);

          results.push({
            symbol: item.code,
            name: item.name,
            price: quote?.regularMarketPrice || 50000,
            change: quote?.regularMarketChange || 0,
            rate: quote?.regularMarketChangePercent || 0
          });
        } catch (e) {
          results.push({ symbol: item.code, name: item.name, price: 50000, change: 0, rate: 0 });
        }
      }
      return success(res, "검색 성공", results);
    }

    // B. LIST LOGIC (Daum API with Yahoo Fallback)
    let url = "";
    if (type === 'popular') url = "https://finance.daum.net/api/trend/trade_volume?page=1&perPage=20&fieldName=tradeVolume&order=desc&market=KOSPI&pagination=true";
    else if (type === 'rising') url = "https://finance.daum.net/api/trend/fluctuation_rate?page=1&perPage=20&fieldName=fluctuationRate&order=desc&market=KOSPI&pagination=true";
    else if (type === 'falling') url = "https://finance.daum.net/api/trend/fluctuation_rate?page=1&perPage=20&fieldName=fluctuationRate&order=asc&market=KOSPI&pagination=true";

    try {
      const response = await axios.get(url, {
        headers: { "Referer": "https://finance.daum.net/", "User-Agent": "Mozilla/5.0" },
        timeout: 5000 
      });
      const formatted = (response.data.data || []).map(s => ({
        symbol: s.symbolCode.replace('A', ''), name: s.name, price: s.tradePrice,
        change: s.changePrice * (s.change === 'FALL' ? -1 : 1), rate: s.changeRate * 100 * (s.change === 'FALL' ? -1 : 1)
      }));
      return success(res, `${type} 조회 성공`, formatted);
      
    } catch (daumErr) {
      // C. FALLBACK: Database + Yahoo Batch Processing
      const [rows] = await db.promise().query("SELECT * FROM stocks");
      const symbols = rows.map(r => `${String(r.stock_code).padStart(6, '0')}.KS`);
      const stockMap = Object.fromEntries(rows.map(r => [`${String(r.stock_code).padStart(6, '0')}.KS`, r.stock_name]));

      const realResults = [];
      const chunkSize = 50; 
      for (let i = 0; i < symbols.length; i += chunkSize) {
        const chunk = symbols.slice(i, i + chunkSize);
        const quotes = await Promise.all(chunk.map(sym => yahooFinance.quote(sym).catch(() => null)));
        
        quotes.forEach(q => {
          if (q?.regularMarketPrice) {
            realResults.push({
              symbol: q.symbol.split('.')[0], name: stockMap[q.symbol] || q.shortName,
              price: q.regularMarketPrice, change: q.regularMarketChange || 0,
              rate: q.regularMarketChangePercent || 0, volume: q.regularMarketVolume || 0
            });
          }
        });
      }

      if (type === 'popular') realResults.sort((a, b) => b.volume - a.volume);
      else if (type === 'rising') realResults.sort((a, b) => b.rate - a.rate);
      else if (type === 'falling') realResults.sort((a, b) => a.rate - b.rate);

      return success(res, `${type} (DB/Yahoo 기반) 성공`, realResults.slice(0, 20));
    }
  } catch (err) {
    return fail(res, "조회 실패", err.message);
  }
};

// 🌟 2. 1년 치 캔들 차트 (중복 제거 및 방어 로직)
exports.getStockChart = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { range = "1y", interval = "1d" } = req.query;
    const cleanCode = String(symbol).padStart(6, '0');
    
    let result = null;
    try {
      result = await yahooFinance.chart(`${cleanCode}.KS`, { range, interval });
    } catch (e) {
      result = await yahooFinance.chart(`${cleanCode}.KQ`, { range, interval }).catch(() => null);
    }

    if (result?.quotes?.length > 0) {
      const prices = result.quotes
        .filter(q => q.open != null)
        .map(item => ({
          x: new Date(item.date).getTime(), o: item.open, h: item.high, l: item.low, c: item.close, v: item.volume
        }));
      return success(res, "차트 성공", prices);
    }

    // Fallback: Virtual Candles for UX stability
    const fallbackPrices = [];
    let basePrice = 15000;
    const now = Date.now();
    for (let i = 50; i >= 0; i--) {
      const open = basePrice + (Math.random() * 400 - 200);
      const close = open + (Math.random() * 600 - 300);
      fallbackPrices.push({
        x: now - (i * 86400000), o: open, h: Math.max(open, close) + 100, l: Math.min(open, close) - 100, c: close
      });
      basePrice = close;
    }
    return success(res, "임시 차트 성공 (Fallback)", fallbackPrices);
  } catch (err) {
    return fail(res, "차트 에러", err.message);
  }
};

exports.getStockPrice = async (req, res) => {
  try {
    const { symbol } = req.params;
    const cleanCode = String(symbol).padStart(6, '0');
    const quote = await yahooFinance.quote(`${cleanCode}.KS`).catch(() => yahooFinance.quote(`${cleanCode}.KQ`));
    
    if (!quote) return fail(res, "해당 종목을 찾을 수 없습니다.", null, 404);

    return success(res, "현재가 조회 성공", {
      symbol: cleanCode,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      rate: quote.regularMarketChangePercent
    });
  } catch (err) {
    return fail(res, "주식 조회 실패", err.message);
  }
};

exports.getLikedStocks = async (req, res) => {
  try {
    const memberId = extractMemberId(req);
    if (!memberId) return fail(res, "인증이 필요합니다.", null, 401);

    const [rows] = await db.promise().query(
      `SELECT l.*, s.stock_name FROM liked_stocks l 
       INNER JOIN stocks s ON l.stock_code = s.stock_code 
       WHERE l.member_id = ?`, [memberId]
    );

    const result = await Promise.all(rows.map(async (row) => {
      const quote = await yahooFinance.quote(`${row.stock_code}.KS`).catch(() => ({}));
      return {
        ...row,
        price: quote.regularMarketPrice || 0,
        changeRate: quote.regularMarketChangePercent || 0
      };
    }));

    return success(res, "찜한 주식 조회 성공", result);
  } catch (err) {
    return fail(res, "조회 실패", err.message);
  }
};

exports.getOwnedStocks = async (req, res) => {
  try {
    const memberId = extractMemberId(req);
    if (!memberId) return fail(res, "인증이 필요합니다.", null, 401);

    const [rows] = await db.promise().query(
      `SELECT o.*, s.stock_name FROM owned_stocks o 
       INNER JOIN stocks s ON o.stock_code = s.stock_code 
       WHERE o.member_id = ?`, [memberId]
    );

    const result = await Promise.all(rows.map(async (row) => {
      const quote = await yahooFinance.quote(`${row.stock_code}.KS`).catch(() => ({}));
      const currentPrice = quote.regularMarketPrice || 0;
      return {
        ...row,
        currentPrice,
        totalValue: currentPrice * row.quantity,
        profit: (currentPrice - row.avg_price) * row.quantity
      };
    }));

    return success(res, "보유 주식 조회 성공", result);
  } catch (err) {
    return fail(res, "조회 실패", err.message);
  }
};