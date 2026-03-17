// isrController.js (현재 테이블 기준 안정화)

const db = require('../db')
const { calculateISR } = require('./isrEngine')

exports.calculateUserISR = async (req, res) => {
  const { member_id } = req.params

  try {
    // 1. 로그 조회 (현재 gameLog 구조 그대로)
    const [logs] = await db.query(
      `SELECT 
        log_id,
        member_id,
        prediction,
        bet_amount,
        pnl_amount,
        penalty_amount,
        status
      FROM gameLog
      WHERE member_id = ?`,
      [member_id]
    )

    if (!logs || logs.length === 0) {
      return res.json({ message: 'No logs', isr: 0 })
    }

    // 2. ISR 계산
    const result = calculateISR(logs)

    // 3. isr_chart 저장 (현재 테이블 그대로)
    await db.query(
      `INSERT INTO isr_chart 
      (member_id, isr_accuracy, isr_risk, isr_strategy, isr_stability, isr_discipline, isr_adaptability, isr_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        member_id,
        result.accuracy,
        result.risk,
        result.strategy,
        result.stability,
        result.discipline,
        result.adaptability,
        result.isr,
      ]
    )

    // 4. members 업데이트
    await db.query(
      `UPDATE members SET isr_score = ? WHERE member_id = ?`,
      [result.isr, member_id]
    )

    // 5. 응답
    res.json({
      message: 'ISR calculated',
      data: result,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'ISR calculation failed' })
  }
}