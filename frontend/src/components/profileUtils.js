// ─── Data helpers ────────────────────────────────────────────────────────────

export const extractArrayData = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

export const extractObjectData = (payload) => {
  if (!payload) return null
  if (payload?.data && !Array.isArray(payload.data)) return payload.data
  if (!Array.isArray(payload) && typeof payload === 'object') return payload
  return null
}

export const normalizeOwnedStocks = (payload) => {
  if (Array.isArray(payload?.stocks)) return payload.stocks
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload)) return payload
  return []
}

export const normalizeLikedStocks = (payload) => {
  if (Array.isArray(payload?.stocks)) return payload.stocks
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload)) return payload
  return []
}

export const normalizeRecentAchievements = (list) => {
  if (!Array.isArray(list)) return []
  return list
    .map((item, index) => {
      if (typeof item === 'string') {
        return { ach_id: `string-${index}`, name: item, ach_img: null, obtained_at: null }
      }
      if (item && typeof item === 'object') {
        return {
          ach_id: item.ach_id ?? item.id ?? `obj-${index}`,
          name: item.name ?? item.title ?? '업적',
          ach_img: item.ach_img ?? null,
          obtained_at: item.obtained_at ?? item.obtainedAt ?? null,
          description: item.description ?? item.desc ?? item.detail ?? null,
        }
      }
      return null
    })
    .filter(Boolean)
}

// ─── Stock value helpers ──────────────────────────────────────────────────────

export const getStockPrincipal = (stock) => {
  const principal = Number(stock?.principal ?? stock?.originPrice ?? stock?.origin_price ?? 0)
  if (principal > 0) return principal
  return Number(stock?.quantity || 0) * Number(stock?.avgPrice ?? stock?.avg_price ?? 0)
}

export const getStockProfit = (stock) =>
  Number(stock?.changeAmount ?? stock?.change_amount ?? stock?.profit ?? stock?.pnl_amount ?? 0)

// ─── Portfolio chart helpers ──────────────────────────────────────────────────

export const PIE_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
]

export const buildPortfolioSegments = (stocks) => {
  const baseList = Array.isArray(stocks)
    ? stocks
        .map((stock, index) => ({
          id: stock?.stockCode ?? stock?.stock_code ?? stock?.code ?? `${stock?.stockName ?? 'stock'}-${index}`,
          name: stock?.stockName ?? stock?.name ?? '이름 없음',
          amount: getStockPrincipal(stock),
        }))
        .filter((item) => Number(item.amount) > 0)
    : []

  const total = baseList.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  if (total <= 0) return { total: 0, segments: [], gradient: '#e5e7eb' }

  let currentDeg = 0
  const segments = baseList.map((item, index) => {
    const ratio = (Number(item.amount) / total) * 100
    const degree = (ratio / 100) * 360
    const color = PIE_COLORS[index % PIE_COLORS.length]
    const segment = { ...item, ratio, color, startDeg: currentDeg, endDeg: currentDeg + degree }
    currentDeg += degree
    return segment
  })

  return {
    total,
    segments,
    gradient: `conic-gradient(${segments.map((s) => `${s.color} ${s.startDeg}deg ${s.endDeg}deg`).join(', ')})`,
  }
}

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

export const buildAnimatedPortfolioSegments = (chartData, progress = 1) => {
  if (!chartData?.segments?.length) return { ...chartData, total: 0, gradient: '#e5e7eb', segments: [] }

  const p = Math.max(0, Math.min(1, progress))
  let currentDeg = 0
  const animatedSegments = chartData.segments.map((item) => {
    const degree = (Number(item.endDeg || 0) - Number(item.startDeg || 0)) * p
    const next = { ...item, animatedStartDeg: currentDeg, animatedEndDeg: currentDeg + degree }
    currentDeg += degree
    return next
  })

  return {
    ...chartData,
    total: chartData.total * p,
    segments: animatedSegments,
    gradient: `conic-gradient(${animatedSegments.map((s) => `${s.color} ${s.animatedStartDeg}deg ${s.animatedEndDeg}deg`).join(', ')})`,
  }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export const formatNumber = (value) => Number(value || 0).toLocaleString('ko-KR')

export const formatSignedNumber = (value) => {
  const num = Number(value || 0)
  return `${num > 0 ? '+' : ''}${num.toLocaleString('ko-KR')}`
}

export const formatSignedPercent = (value) => {
  const num = Number(value || 0)
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}`
}

export const formatNoticeDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' })
}

export const formatCompactDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${d} ${hh}:${mm}`
}

export const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export const getTooltipText = (item, fallback = '설명이 없습니다.') =>
  item?.description || item?.desc || item?.detail || fallback
