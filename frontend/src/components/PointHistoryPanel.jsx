import React, { useState, useMemo } from 'react'
import { formatCompactDateTime } from './profileUtils'

const RANGE_LABELS = { '1d': '최근 1일', '7d': '최근 1주일', '1m': '최근 1개월', '1y': '최근 1년' }
const RANGES = Object.keys(RANGE_LABELS)

const filterByRange = (notifications, range) => {
  const now = new Date()
  const start = new Date(now)
  if (range === '1d') start.setDate(now.getDate() - 1)
  else if (range === '7d') start.setDate(now.getDate() - 7)
  else if (range === '1m') start.setMonth(now.getMonth() - 1)
  else if (range === '1y') start.setFullYear(now.getFullYear() - 1)
  return notifications.filter((item) => {
    const d = new Date(item.createdAt)
    return !Number.isNaN(d.getTime()) && d >= start
  })
}

const PointHistoryPanel = ({ notifications, onBack, onHide }) => {
  const [range, setRange] = useState('7d')
  const [visible, setVisible] = useState(10)

  const filtered = useMemo(() => filterByRange(notifications, range), [notifications, range])
  const shown = filtered.slice(0, visible)
  const hasMore = filtered.length > visible

  const handleRangeChange = (r) => { setRange(r); setVisible(10) }

  return (
    <div className='profile'>
      <div className='profile-content-pop'>
        <div className='achievement-page-top'>
          <button className='achievement-back-btn' onClick={onBack}>← 뒤로가기</button>
        </div>

        <div className='profile-stock title-summary-card'>
          <div className='achievement-title-row point-history-top-row'>
            <h2>포인트 변동 내역</h2>
            <span className='achievement-count'>{filtered.length}건</span>
          </div>

          <div className='point-history-filter-wrap'>
            {RANGES.map((r) => (
              <button
                key={r}
                type='button'
                className={`point-history-filter-btn ${range === r ? 'active' : ''}`}
                onClick={() => handleRangeChange(r)}
              >
                {r === '1d' ? '1일' : r === '7d' ? '1주일' : r === '1m' ? '1개월' : '1년'}
              </button>
            ))}
          </div>

          <div className='point-history-range-label'>{RANGE_LABELS[range]} 내역</div>

          <div className='point-history-list'>
            {shown.length > 0 ? shown.map((item) => (
              <div className='point-history-item' key={item.history_id}>
                <div className='notification-item-left'>
                  <div className='notification-name'>{item.type}</div>
                  <div className={`notification-amount ${Number(item.changeAmount) >= 0 ? 'positive' : 'negative'}`}>
                    {Number(item.changeAmount) >= 0 ? '+' : ''}
                    {Number(item.changeAmount).toLocaleString('ko-KR')}pt
                  </div>
                </div>
                <div className='point-history-right'>
                  <div className='notification-date'>{formatCompactDateTime(item.createdAt)}</div>
                  <button
                    type='button'
                    className='point-history-hide-btn'
                    onClick={() => onHide(item.history_id)}
                    title='이 내역 숨기기'
                  >
                    삭제
                  </button>
                </div>
              </div>
            )) : (
              <div className='achievement-empty-block'>{RANGE_LABELS[range]} 내역이 없습니다.</div>
            )}
          </div>

          {filtered.length > 10 && (
            <div className={`point-history-more-row ${visible <= 10 ? 'single' : 'double'}`}>
              {visible <= 10 ? (
                <button type='button' className='title-equip-btn' onClick={() => setVisible((v) => Math.min(v + 10, filtered.length))}>더보기</button>
              ) : (
                <>
                  {visible < filtered.length
                    ? <button type='button' className='title-equip-btn' onClick={() => setVisible((v) => Math.min(v + 10, filtered.length))}>더보기</button>
                    : <div className='point-history-more-placeholder' />
                  }
                  <span className='point-history-visible-count'>{shown.length} / {filtered.length}</span>
                  <button type='button' className='title-equip-btn' onClick={() => setVisible((v) => Math.max(v - 10, 10))}>접기</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PointHistoryPanel
