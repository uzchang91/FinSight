const db = require("../../config/db");
const { calculateISR } = require("../engines/isrEngine");

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

async function saveISR(memberId, result) {
  await db.promise().query(
    `
    INSERT INTO isr_chart
    (
      member_id,
      isr_accuracy,
      isr_risk,
      isr_strategy,
      isr_stability,
      isr_discipline,
      isr_adaptability,
      isr_score
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      memberId,
      result.accuracy,
      result.risk,
      result.strategy,
      result.stability,
      result.discipline,
      result.adaptability,
      result.isr,
    ]
  );

  await db.promise().query(
    `UPDATE members SET isr_score = ? WHERE member_id = ?`,
    [result.isr, memberId]
  );
}

/* =========================
   특정 회원 ISR 계산
========================= */
exports.calculateUserISR = async (req, res) => {
  try {
    const memberId = Number(req.params.member_id);

    if (!memberId) {
      return fail(res, "member_id가 올바르지 않습니다.", null, 400);
    }

    const [logRows] = await db.promise().query(
      `SELECT COUNT(*) AS cnt FROM gameLog WHERE member_id = ?`,
      [memberId]
    );

    if (!logRows[0]?.cnt) {
      const emptyResult = {
        accuracy: 0,
        risk: 0,
        stability: 0,
        discipline: 0,
        strategy: 0,
        adaptability: 0,
        isr: 0,
      };

      await db.promise().query(
        `UPDATE members SET isr_score = 0 WHERE member_id = ?`,
        [memberId]
      );

      return success(res, "로그가 없어 ISR 0으로 처리되었습니다.", emptyResult);
    }

    const [logs] = await db.promise().query(
      `SELECT * FROM gameLog WHERE member_id = ?`,
      [memberId]
    );

    const result = calculateISR(logs);
    await saveISR(memberId, result);

    return success(res, "ISR 계산 완료", result);
  } catch (err) {
    console.error("calculateUserISR error =", err);
    return fail(res, "ISR 계산 실패", err.message, 500);
  }
};

/* =========================
   전체 회원 ISR 재계산
========================= */
exports.calculateAllISR = async (req, res) => {
  try {
    const [members] = await db.promise().query(
      `SELECT member_id FROM members ORDER BY member_id ASC`
    );

    const results = [];

    for (const member of members) {
      const memberId = Number(member.member_id);

      const [logRows] = await db.promise().query(
        `SELECT COUNT(*) AS cnt FROM gameLog WHERE member_id = ?`,
        [memberId]
      );

      if (!logRows[0]?.cnt) {
        await db.promise().query(
          `UPDATE members SET isr_score = 0 WHERE member_id = ?`,
          [memberId]
        );

        results.push({
          memberId,
          accuracy: 0,
          risk: 0,
          stability: 0,
          discipline: 0,
          strategy: 0,
          adaptability: 0,
          isr: 0,
        });

        continue;
      }

      const [logs] = await db.promise().query(
        `SELECT * FROM gameLog WHERE member_id = ?`,
        [memberId]
      );

      const result = calculateISR(logs);
      await saveISR(memberId, result);

      results.push({
        memberId,
        ...result,
      });
    }

    return success(res, "전체 회원 ISR 재계산 완료", results);
  } catch (err) {
    console.error("calculateAllISR error =", err);
    return fail(res, "전체 회원 ISR 재계산 실패", err.message, 500);
  }
};

/* =========================
   특정 회원 최신 ISR 조회
========================= */
exports.getLatestISR = async (req, res) => {
  try {
    const memberId = Number(req.params.member_id);

    if (!memberId) {
      return fail(res, "member_id가 올바르지 않습니다.", null, 400);
    }

    const [rows] = await db.promise().query(
      `
      SELECT
        member_id,
        isr_accuracy AS accuracy,
        isr_risk AS risk,
        isr_strategy AS strategy,
        isr_stability AS stability,
        isr_discipline AS discipline,
        isr_adaptability AS adaptability,
        isr_score AS isr,
        created_at
      FROM isr_chart
      WHERE member_id = ?
      ORDER BY created_at DESC, chart_id DESC
      LIMIT 1
      `,
      [memberId]
    );

    if (!rows.length) {
      return success(res, "저장된 ISR 데이터가 없습니다.", {
        accuracy: 0,
        risk: 0,
        stability: 0,
        discipline: 0,
        strategy: 0,
        adaptability: 0,
        isr: 0,
      });
    }

    return success(res, "최신 ISR 조회 성공", rows[0]);
  } catch (err) {
    console.error("getLatestISR error =", err);
    return fail(res, "최신 ISR 조회 실패", err.message, 500);
  }
};