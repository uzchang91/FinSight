const db = require("../../config/db");

function success(res, message, data = null, status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function fail(res, message, error = null, status = 500) {
  return res.status(status).json({ success: false, message, error });
}

exports.getPointNotifications = async (req, res) => {
  try {
    const memberId = req.user.member_id || req.user.id || req.user.memberId;

    // 💡 옛날 조건(lesson_complete만 가져오기)을 없애고 최근 10개를 다 가져옵니다.
    const sql = `
      SELECT
        history_id,
        change_amount,
        reason,
        created_at
      FROM point_history
      WHERE member_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const [rows] = await db.promise().query(sql, [memberId]);

    const notifications = rows.map((row) => {
      const reasonStr = (row.reason || "").toLowerCase();
      let displayType = "포인트 변동"; 

      // 💡 영어로 된 DB 기록을 예쁜 한글로 바꿔줍니다.
      if (reasonStr.includes("lesson") || reasonStr.includes("교육")) {
        displayType = "교육실 학습완료";
      } else if (reasonStr.includes("quiz") || reasonStr.includes("퀴즈") || reasonStr.includes("correct")) {
        displayType = "전략실 퀴즈";
      } else if (reasonStr.includes("stock") || reasonStr.includes("buy") || reasonStr.includes("sell") || reasonStr.includes("주식")) {
        displayType = "전략실 주식 매매";
      } else {
        displayType = row.reason; 
      }

      return {
        history_id: row.history_id,
        type: displayType,
        changeAmount: Number(row.change_amount || 0),
        createdAt: row.created_at,
      };
    });

    return success(res, "포인트 알림 조회 성공", notifications);
  } catch (err) {
    console.error("포인트 알림 오류:", err);
    return fail(res, "포인트 알림 조회 실패", err.message);
  }
};