const db = require("../../config/db");
const { getTierKeyByRankingPoint } = require("../utils/tier");
const { getQuoteByCode, normalizeStockCode } = require("./kisClient");

function success(res, message, data = null, status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function fail(res, message, error = null, status = 500) {
  return res.status(status).json({ success: false, message, error });
}

// ── Price cache ───────────────────────────────────────────────────────────────
// Each unique stock code is fetched once from KIS and cached for 5 minutes.
// All members holding the same stock reuse the cached price — no duplicate calls.
const PRICE_CACHE_TTL_MS = 5 * 60 * 1000;
const _priceCache = new Map(); // code → { price, expiresAt }

async function getCachedPrice(rawCode) {
  const code = normalizeStockCode(rawCode);
  const cached = _priceCache.get(code);
  if (cached && Date.now() < cached.expiresAt) return cached.price;

  const quote = await getQuoteByCode(code);
  const price = Number(quote?.regularMarketPrice || 0);

  console.log(`[ranking] price fetch: ${code} → ${price}`);
  _priceCache.set(code, { price, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
  return price;
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

exports.getLeaderboard = async (req, res) => {
  try {
    const memberId = Number(req.user?.member_id || 0);

    // 1. Single query for all members
    const [members] = await db.promise().query(`
      SELECT member_id, nickname, profile_image, profile_image2, points
      FROM members
    `);

    // 2. Single query for all owned stocks (not N queries)
    const [allStocks] = await db.promise().query(`
      SELECT member_id, stock_code, quantity
      FROM owned_stocks
      WHERE quantity > 0
    `);

    // 3. Group stocks by member_id
    const stocksByMember = new Map();
    for (const row of allStocks) {
      if (!stocksByMember.has(row.member_id)) stocksByMember.set(row.member_id, []);
      stocksByMember.get(row.member_id).push(row);
    }

    // 4. Fetch each unique stock price once via KIS (sequential through shared rate limiter)
    const uniqueCodes = [...new Set(allStocks.map((s) => normalizeStockCode(s.stock_code)))];
    console.log(`[ranking] fetching ${uniqueCodes.length} unique stock prices via KIS`);

    for (const code of uniqueCodes) {
      await getCachedPrice(code); // sequential — respects KIS rate limit
    }

    // 5. Build leaguePoint = points + current market value of all held stocks
    const rankedRows = members.map((member) => {
      const stocks = stocksByMember.get(member.member_id) || [];

      let totalStockValue = 0;
      for (const stock of stocks) {
        const code = normalizeStockCode(stock.stock_code);
        const cached = _priceCache.get(code);
        const price = cached ? cached.price : 0; // all prices fetched above, hits cache only
        totalStockValue += price * Number(stock.quantity || 0);
      }

      return {
        memberId: member.member_id,
        nickname: member.nickname,
        profileImage: member.profile_image || null,
        profileImage2: member.profile_image2 || null,
        points: Number(member.points || 0),
        leaguePoint: Number(member.points || 0) + totalStockValue,
      };
    });

    // 6. Sort descending
    rankedRows.sort((a, b) => b.leaguePoint - a.leaguePoint);

    // 7. Assign percentile rankingPoint and tier
    const totalCount = rankedRows.length;
    const maxPoints = totalCount > 0 ? rankedRows[0].leaguePoint : 0;

    const finalRows = rankedRows.map((row, index) => {
      const rankingPoint =
        totalCount > 1 ? ((totalCount - 1 - index) / (totalCount - 1)) * 100 : 100;
      return {
        ...row,
        rankingPoint: Number(rankingPoint.toFixed(2)),
        tier: getTierKeyByRankingPoint(rankingPoint),
        overallRank: index + 1,
      };
    });

    // 8. Split into leagues and assign leagueRank within each tier
    const leagues = { bronze: [], silver: [], gold: [], diamond: [] };
    finalRows.forEach((row) => leagues[row.tier].push(row));
    Object.keys(leagues).forEach((key) => {
      leagues[key] = leagues[key].map((row, i) => ({ ...row, leagueRank: i + 1 }));
    });

    return success(res, "랭킹 조회 성공", {
      seasonName: "자산 랭킹",
      currentUserId: memberId || null,
      maxPoints,
      leagues,
    });

  } catch (err) {
    console.error("getLeaderboard error =", err);
    return fail(res, "랭킹 조회 실패", err.message, 500);
  }
};