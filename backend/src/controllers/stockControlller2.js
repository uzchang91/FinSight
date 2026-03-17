const db = require("../../config/db");
const yahooService = require("../services/yahooService");

function success(res, message, data = null, status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function fail(res, message, error = null, status = 500) {
  return res.status(status).json({ success: false, message, error });
}

function extractMemberId(req) {
  if (!req.user || typeof req.user !== "object") return null;

  return (
    req.user.member_id ||
    req.user.id ||
    req.user.memberId ||
    req.user.userId ||
    null
  );
}

/* =========================
   기존 종목 목록 조회
========================= */
exports.getAllStocks = async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM stocks ORDER BY stock_name ASC"
    );
    return success(res, "종목 목록 조회 성공", rows);
  } catch (err) {
    console.error("getAllStocks error =", err);
    return fail(res, "종목 목록 조회 실패", err.message);
  }
};

/* =========================
   기존 종목 차트 조회
========================= */
exports.getStockChart = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { range = "1mo", interval = "1d" } = req.query;

    const [rows] = await db.promise().query(
      "SELECT * FROM stocks WHERE stock_code = ?",
      [symbol]
    );

    if (rows.length === 0) {
      return fail(res, "해당 종목을 찾을 수 없습니다.", null, 404);
    }

    const stock = rows[0];
    const yahooSymbol = `${stock.stock_code}.KS`;
    const result = await yahooService.getChart(yahooSymbol, range, interval);

    const prices = (result.quotes || []).map((item) => ({
      date: item.date,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));

    return success(res, "종목 차트 조회 성공", {
      symbol: stock.stock_code,
      name: stock.stock_name,
      market: stock.market_type,
      range,
      interval,
      prices,
    });
  } catch (err) {
    console.error("getStockChart error =", err);
    return fail(res, "차트 조회 실패", err.message);
  }
};

/* =========================
   기존 종목 현재가 조회
========================= */
exports.getStockPrice = async (req, res) => {
  try {
    const { symbol } = req.params;

    const [rows] = await db.promise().query(
      "SELECT * FROM stocks WHERE stock_code = ?",
      [symbol]
    );

    if (rows.length === 0) {
      return fail(res, "해당 종목을 찾을 수 없습니다.", null, 404);
    }

    const stock = rows[0];
    const yahooSymbol = `${stock.stock_code}.KS`;
    const quote = await yahooService.getQuote(yahooSymbol);

    return success(res, "종목 현재가 조회 성공", {
      symbol: stock.stock_code,
      name: stock.stock_name,
      market: stock.market_type,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changeRate: quote.regularMarketChangePercent,
      currency: quote.currency,
      marketState: quote.marketState,
    });
  } catch (err) {
    console.error("getStockPrice error =", err);
    return fail(res, "주식 조회 실패", err.message);
  }
};

/* =========================
   찜한 주식 조회
========================= */
exports.getLikedStocks = async (req, res) => {
  try {
    const memberId = extractMemberId(req);

    console.log("===== GET LIKED STOCKS =====");
    console.log("liked req.user =", req.user);
    console.log("liked memberId =", memberId);

    if (!memberId) {
      return fail(res, "사용자 정보가 없습니다.", null, 401);
    }

    const [rows] = await db.promise().query(
      `
      SELECT
        l.id,
        l.member_id,
        l.stock_code,
        l.created_at,
        s.stock_name,
        s.market_type
      FROM liked_stocks l
      INNER JOIN stocks s
        ON l.stock_code = s.stock_code
      WHERE l.member_id = ?
      ORDER BY l.created_at DESC, l.id DESC
      `,
      [memberId]
    );

    console.log("liked rows =", rows);

    const result = [];

    for (const row of rows) {
      try {
        const yahooSymbol = `${row.stock_code}.KS`;
        const quote = await yahooService.getQuote(yahooSymbol);

        result.push({
          id: row.id,
          memberId: row.member_id,
          stockCode: row.stock_code,
          stockName: row.stock_name,
          market: row.market_type,
          price: Number(quote.regularMarketPrice || 0),
          change: Number(quote.regularMarketChange || 0),
          changeRate: Number(quote.regularMarketChangePercent || 0),
          createdAt: row.created_at,
        });
      } catch (quoteErr) {
        result.push({
          id: row.id,
          memberId: row.member_id,
          stockCode: row.stock_code,
          stockName: row.stock_name,
          market: row.market_type,
          price: 0,
          change: 0,
          changeRate: 0,
          createdAt: row.created_at,
          quoteError: quoteErr.message,
        });
      }
    }

    console.log("liked result =", result);

    return success(res, "찜한 주식 조회 성공", result);
  } catch (err) {
    console.error("getLikedStocks error =", err);
    return fail(res, "찜한 주식 조회 실패", err.message);
  }
};

/* =========================
   보유 주식 조회
========================= */
exports.getOwnedStocks = async (req, res) => {
  try {
    const memberId = extractMemberId(req);

    console.log("===== GET OWNED STOCKS =====");
    console.log("owned req.user =", req.user);
    console.log("owned memberId =", memberId);

    if (!memberId) {
      return fail(res, "사용자 정보가 없습니다.", null, 401);
    }

    const [rows] = await db.promise().query(
      `
      SELECT
        o.id,
        o.member_id,
        o.stock_code,
        o.quantity,
        o.avg_price,
        o.created_at,
        o.updated_at,
        s.stock_name,
        s.market_type
      FROM owned_stocks o
      INNER JOIN stocks s
        ON o.stock_code = s.stock_code
      WHERE o.member_id = ?
      ORDER BY o.created_at DESC, o.id DESC
      `,
      [memberId]
    );

    console.log("owned rows =", rows);

    const result = [];

    for (const row of rows) {
      try {
        const yahooSymbol = `${row.stock_code}.KS`;
        const quote = await yahooService.getQuote(yahooSymbol);

        const quantity = Number(row.quantity || 0);
        const avgPrice = Number(row.avg_price || 0);
        const currentPrice = Number(quote.regularMarketPrice || 0);

        const totalPrice = currentPrice * quantity;
        const changeAmount = (currentPrice - avgPrice) * quantity;

        result.push({
          id: row.id,
          memberId: row.member_id,
          stockCode: row.stock_code,
          stockName: row.stock_name,
          market: row.market_type,
          quantity,
          avgPrice,
          price: currentPrice,
          totalPrice,
          changeAmount,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      } catch (quoteErr) {
        result.push({
          id: row.id,
          memberId: row.member_id,
          stockCode: row.stock_code,
          stockName: row.stock_name,
          market: row.market_type,
          quantity: Number(row.quantity || 0),
          avgPrice: Number(row.avg_price || 0),
          price: 0,
          totalPrice: 0,
          changeAmount: 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          quoteError: quoteErr.message,
        });
      }
    }

    console.log("owned result =", result);

    return success(res, "보유 주식 조회 성공", result);
  } catch (err) {
    console.error("getOwnedStocks error =", err);
    return fail(res, "보유 주식 조회 실패", err.message);
  }
};