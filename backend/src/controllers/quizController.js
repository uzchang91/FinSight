const db = require("../../config/db");

// 공통 응답 함수
function success(res, message, data = null, status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function fail(res, message, error = null, status = 500) {
  return res.status(status).json({ success: false, message, error });
}

function getTodayRange() {
  const now = new Date();

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

exports.getAllQuizzes = async (req, res) => {
  try {
    const { difficulty } = req.query;

    let sql = "SELECT * FROM quizzes";
    const params = [];

    if (difficulty) {
      sql += " WHERE difficulty = ?";
      params.push(difficulty);
    }

    sql += " ORDER BY quiz_id ASC";

    const [rows] = await db.promise().query(sql, params);
    return success(res, "퀴즈 조회 성공", rows);
  } catch (err) {
    return fail(res, "퀴즈 조회 실패", err.message);
  }
};

exports.getRandomQuiz = async (req, res) => {
  try {
    const { difficulty } = req.query;

    let sql = "SELECT * FROM quizzes";
    const params = [];

    if (difficulty) {
      sql += " WHERE difficulty = ?";
      params.push(difficulty);
    }

    sql += " ORDER BY RAND() LIMIT 1";

    const [rows] = await db.promise().query(sql, params);

    if (rows.length === 0) {
      return fail(res, "해당 조건의 퀴즈가 없습니다.", null, 404);
    }

    return success(res, "랜덤 퀴즈 조회 성공", rows[0]);
  } catch (err) {
    return fail(res, "랜덤 퀴즈 조회 실패", err.message);
  }
};

exports.getQuizById = async (req, res) => {
  try {
    const { quiz_id } = req.params;

    const [rows] = await db.promise().query(
      "SELECT * FROM quizzes WHERE quiz_id = ?",
      [quiz_id]
    );

    if (rows.length === 0) {
      return fail(res, "해당 퀴즈가 없습니다.", null, 404);
    }

    return success(res, "퀴즈 1개 조회 성공", rows[0]);
  } catch (err) {
    return fail(res, "퀴즈 1개 조회 실패", err.message);
  }
};

exports.checkAnswer = async (req, res) => {
  try {
    const memberId = req.user?.member_id;
    const { quiz_id, answer } = req.body;

    console.log("===== QUIZ CHECK START =====");
    console.log("req.user =", req.user);
    console.log("memberId =", memberId);
    console.log("quiz_id =", quiz_id);
    console.log("answer =", answer);

    if (!memberId) {
      return fail(res, "사용자 정보가 없습니다.", null, 401);
    }

    if (!quiz_id || answer === undefined || answer === null) {
      return fail(res, "quiz_id와 answer를 모두 보내야 합니다.", null, 400);
    }

    const [rows] = await db.promise().query(
      "SELECT quiz_id, answer, explanation FROM quizzes WHERE quiz_id = ?",
      [quiz_id]
    );

    if (rows.length === 0) {
      return fail(res, "해당 퀴즈가 없습니다.", null, 404);
    }

    const correctAnswer = Number(rows[0].answer);
    const selectedAnswer = Number(answer);
    const isCorrect = selectedAnswer === correctAnswer;

    const [insertResult] = await db.promise().query(
      `
      INSERT INTO member_quiz_history
      (member_id, quiz_id, selected_answer, is_correct)
      VALUES (?, ?, ?, ?)
      `,
      [memberId, Number(quiz_id), selectedAnswer, isCorrect ? 1 : 0]
    );

    console.log("member_quiz_history insertResult =", insertResult);

    if (isCorrect) {
      const [pointResult] = await db.promise().query(
        `UPDATE members SET points = points + 100 WHERE member_id = ?`,
        [memberId]
      );
      console.log("points updateResult =", pointResult);
    }

    const [memberRows] = await db.promise().query(
      `SELECT member_id, nickname, points FROM members WHERE member_id = ?`,
      [memberId]
    );

    console.log("updated member =", memberRows[0]);
    console.log("===== QUIZ CHECK END =====");

    return success(res, "정답 확인 완료", {
      isCorrect,
      correctAnswer,
      explanation: rows[0].explanation,
      rewardPoints: isCorrect ? 100 : 0,
      member: memberRows[0] || null,
    });
  } catch (err) {
    console.error("checkAnswer error =", err);
    return fail(res, "정답 확인 실패", err.message, 500);
  }
};

exports.getMyQuestStatus = async (req, res) => {
  try {
    const memberId = req.user?.member_id;

    if (!memberId) {
      return fail(res, "사용자 정보가 없습니다.", null, 401);
    }

    const { start, end } = getTodayRange();

    const [totalQuizRows] = await db.promise().query(
      "SELECT COUNT(*) AS totalCount FROM quizzes"
    );

    const [todaySolvedRows] = await db.promise().query(
      `
      SELECT COUNT(*) AS todaySolved
      FROM member_quiz_history
      WHERE member_id = ?
        AND solved_at BETWEEN ? AND ?
      `,
      [memberId, start, end]
    );

    const [todayCorrectRows] = await db.promise().query(
      `
      SELECT COUNT(*) AS todayCorrect
      FROM member_quiz_history
      WHERE member_id = ?
        AND is_correct = 1
        AND solved_at BETWEEN ? AND ?
      `,
      [memberId, start, end]
    );

    const [totalSolvedRows] = await db.promise().query(
      `
      SELECT COUNT(*) AS totalSolved
      FROM member_quiz_history
      WHERE member_id = ?
      `,
      [memberId]
    );

    const [accuracyRows] = await db.promise().query(
      `
      SELECT
        ROUND(
          (SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100,
          2
        ) AS accuracy
      FROM member_quiz_history
      WHERE member_id = ?
      `,
      [memberId]
    );

    const dailyGoal = 3;
    const todaySolved = Number(todaySolvedRows[0]?.todaySolved || 0);
    const todayCorrect = Number(todayCorrectRows[0]?.todayCorrect || 0);
    const totalSolved = Number(totalSolvedRows[0]?.totalSolved || 0);
    const totalCount = Number(totalQuizRows[0]?.totalCount || 0);
    const accuracy = Number(accuracyRows[0]?.accuracy || 0);
    const dailyPercent = Math.min(
      100,
      Number(((todaySolved / dailyGoal) * 100).toFixed(2))
    );

    return success(res, "퀘스트 현황 조회 성공", {
      todaySolved,
      todayCorrect,
      totalSolved,
      totalCount,
      accuracy,
      dailyGoal,
      dailyPercent,
    });
  } catch (err) {
    return fail(res, "퀘스트 현황 조회 실패", err.message);
  }
};