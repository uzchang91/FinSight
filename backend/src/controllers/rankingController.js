const db = require("../../config/db");

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
    const [rows] = await db.promise().query(`
      SELECT
        member_id,
        provider,
        provider_id,
        nickname,
        points,
        isr_score,
        profile_image,
        created_at
      FROM members
      ORDER BY points DESC, isr_score DESC, member_id ASC
    `);

    return success(res, "리그 순위표 조회 성공", rows);
  } catch (err) {
    console.error("getLeaderboard error =", err);
    return fail(res, "리그 순위표 조회 실패", err.message, 500);
  }
};