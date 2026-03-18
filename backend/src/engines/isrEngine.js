// isrEngine.js (현재 테이블 완전 호환 버전)

function calculateAccuracy(logs) {
  const data = Array.isArray(logs) ? logs : []
  const valid = data.filter(l => l.status === 'SUCCESS' || l.status === 'FAIL')
  if (valid.length === 0) return 0
  const success = valid.filter(l => l.status === 'SUCCESS').length
  return (success / valid.length) * 100
}

function calculateRisk(logs) {
  const data = Array.isArray(logs) ? logs : []
  if (data.length === 0) return 0
  const losses = data.filter(l => l.pnl_amount < 0)
  const avgLoss =
    losses.reduce((sum, l) => sum + Math.abs(l.pnl_amount || 0), 0) /
    (losses.length || 1)
  const avgBet =
    data.reduce((sum, l) => sum + (l.bet_amount || 0), 0) / data.length
  if (avgBet === 0) return 0
  return Math.max(0, 100 - (avgLoss / avgBet) * 100)
}

function calculateStability(logs) {
  if (logs.length === 0) return 0

  const pnls = logs.map(l => l.pnl_amount || 0)
  const avg = pnls.reduce((a, b) => a + b, 0) / pnls.length

  const variance =
    pnls.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / pnls.length

  const stddev = Math.sqrt(variance)

  if (avg === 0) return 50

  return Math.max(0, 100 - (stddev / Math.abs(avg)) * 100)
}

function calculateDiscipline(logs) {
  if (logs.length === 0) return 0

  const pending = logs.filter(l => l.status === 'PENDING').length
  return 100 - (pending / logs.length) * 100
}

//
// ⚠️ 현재 테이블 기준 임시 Strategy
//
function calculateStrategy(logs) {
  const counts = {}
  if (logs.length === 0) return 0

  logs.forEach(l => {
    const key = l.strategy_type_actual || 'UNKNOWN'
    counts[key] = (counts[key] || 0) + 1
  })

  const total = logs.length
  const max = Math.max(...Object.values(counts), 0)

  if (total === 0) return 0

  return (max / total) * 100
}

//
// ⚠️ 현재 테이블 기준 임시 Adaptability
//
function calculateAdaptability(logs) {
  const grouped = {}

  logs.forEach(l => {
    const trend = l.market_trend || 'UNKNOWN'
    if (!grouped[trend]) grouped[trend] = []
    grouped[trend].push(l)
  })

  const rates = Object.values(grouped).map(group => {
    const success = group.filter(l => l.status === 'SUCCESS').length
    return group.length ? success / group.length : 0
  })

  if (rates.length === 0) return 0

  const avg = rates.reduce((a, b) => a + b, 0) / rates.length
  return avg * 100
}

function calculateISR(logs) {
  const accuracy = calculateAccuracy(logs)
  const risk = calculateRisk(logs)
  const stability = calculateStability(logs)
  const discipline = calculateDiscipline(logs)
  const strategy = calculateStrategy(logs)
  const adaptability = calculateAdaptability(logs)

  const isr =
    (accuracy * 0.30 +
  risk * 0.25 +
  stability * 0.20 +
  discipline * 0.10 +
  strategy * 0.10 +
  adaptability * 0.05)

  return {
    accuracy,
    risk,
    stability,
    discipline,
    strategy,
    adaptability,
    isr,
  }
}

module.exports = {
  calculateISR,
}