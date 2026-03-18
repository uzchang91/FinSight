const db = require("../../config/db");
const { getTierKeyByIsr } = require("../utils/tier");

function success(res, message, data = null, status = 200) {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
}

function fail(res, message, error = null, status = 500) {
  return res.status(status).json({
    success: false,
    message,
    error,
  });
}

exports.getLeaderboard = async (req, res) => {
  try {
    const memberId = Number(req.user?.member_id || 0);

    const [rows] = await db.promise().query(
      `
      SELECT
        member_id,
        nickname,
        profile_image,
        isr_score,
        points
      FROM members
      ORDER BY isr_score DESC, points DESC, member_id ASC
      `
    );

    const leagues = {
      bronze: [],
      silver: [],
      gold: [],
      diamond: [],
    };

    rows.forEach((row) => {
      const tier = getTierKeyByIsr(row.isr_score);

      leagues[tier].push({
        memberId: row.member_id,
        nickname: row.nickname,
        profileImage: row.profile_image || null,
        isrScore: Number(row.isr_score || 0),
        tier,
      });
    });

    Object.keys(leagues).forEach((tierKey) => {
      leagues[tierKey] = leagues[tierKey].map((row, index) => ({
        ...row,
        leagueRank: index + 1,
      }));
    });

    return success(res, "랭킹 조회 성공", {
      seasonName: "기본 랭킹",
      currentUserId: memberId || null,
      leagues,
    });
  } catch (err) {
    console.error("getLeaderboard error =", err);
    return fail(res, "랭킹 조회 실패", err.message, 500);
  }
};