import React from 'react'
import { getAchievementIcon } from '../utils/achievementIconMap'
import { getTooltipText, formatDateTime } from './profileUtils'

const AchievementsPanel = ({
  titles,
  equippedTitle,
  titleLoading,
  titleEquipLoading,
  onEquipTitle,
  achievementSummary,
  achievementLoading,
  obtainedAchievements,
  inProgressAchievements,
  onBack,
}) => (
  <div className='profile'>
    <div className='profile-content-pop'>
      <div className='achievement-page-top'>
        <button className='achievement-back-btn' onClick={onBack}>← 뒤로가기</button>
      </div>

      {/* ── Title selector ── */}
      <div className='profile-stock'>
        <div className='achievement-title-row'>
          <h2>칭호 선택</h2>
          <span className='achievement-count'>{titles.length}개</span>
        </div>
        <div className='title-list'>
          {titleLoading ? (
            <div className='achievement-empty-block'>불러오는 중...</div>
          ) : titles.length > 0 ? (
            titles.map((item) => {
              const isEquipped =
                Number(item?.is_equipped) === 1 ||
                Number(item?.ach_id) === Number(equippedTitle?.ach_id)
              return (
                <div className='title-item' key={item.ach_id}>
                  <div className='title-item-tooltip'>{getTooltipText(item, '칭호 설명이 없습니다.')}</div>
                  <div className='title-item-left'>
                    <span className='title-item-name'>{item.name}</span>
                  </div>
                  <button
                    className={`title-equip-btn ${isEquipped ? 'title-equip-btn--active' : ''}`}
                    disabled={titleEquipLoading || isEquipped}
                    onClick={() => onEquipTitle(item.ach_id)}
                  >
                    {isEquipped ? '장착 중' : titleEquipLoading ? '변경 중...' : '장착하기'}
                  </button>
                </div>
              )
            })
          ) : (
            <div className='achievement-empty-block'>보유한 칭호가 없습니다.</div>
          )}
        </div>
      </div>

      {/* ── Progress summary ── */}
      <div className='profile-stock achievement-summary-card'>
        <div className='achievement-title-row'><h2>전체 업적</h2></div>
        <div className='achievement-progress-top'>
          <div className='achievement-progress-text achievement-progress-text--single'>
            <span>달성 진행도</span>
            <strong>{achievementSummary.obtainedCount} / {achievementSummary.totalCount}</strong>
          </div>
        </div>
      </div>

      {/* ── Obtained ── */}
      <div className='profile-stock'>
        <div className='achievement-title-row'>
          <h2>달성한 업적</h2>
          <span className='achievement-count'>{obtainedAchievements.length}개</span>
        </div>
        <div className='achievement-grid-full'>
          {achievementLoading ? (
            <div className='achievement-empty-block'>불러오는 중...</div>
          ) : obtainedAchievements.length > 0 ? (
            obtainedAchievements.map((item) => (
              <div className='achievement-grid-card' key={item.ach_id}>
                <img src={getAchievementIcon(item.ach_id)} alt={item.name} className='achievement-grid-img' />
                <div className='achievement-grid-name'>{item.name}</div>
                <div className='achievement-grid-date'>획득일: {formatDateTime(item.obtained_at)}</div>
                <div className='achievement-grid-card-tooltip'>
                  <div className='achievement-grid-tooltip-arrow' />
                  {getTooltipText(item, '업적 설명이 없습니다.')}
                </div>
              </div>
            ))
          ) : (
            <div className='achievement-empty-block'>달성한 업적이 없습니다.</div>
          )}
        </div>
      </div>

      {/* ── In progress ── */}
      <div className='profile-stock'>
        <div className='achievement-title-row'>
          <h2>진행 중인 업적</h2>
          <span className='achievement-count'>{inProgressAchievements.length}개</span>
        </div>
        <div className='achievement-progress-tooltip-grid'>
          {achievementLoading ? (
            <div className='achievement-empty-block'>불러오는 중...</div>
          ) : inProgressAchievements.length > 0 ? (
            inProgressAchievements.map((item) => (
              <React.Fragment key={item.ach_id}>
                <div className='achievement-trigger-item'>
                  <div className='achievement-mini-icon'>
                    <img src={getAchievementIcon(item.ach_id)} alt={item.name} className='achievement-mini-icon-img' />
                  </div>
                </div>
                <div className='achievement-speech-bubble2'>
                  <div className='bubble-arrow2' />
                  <div className='bubble-content'>
                    <strong className='bubble-name'>{item.name}</strong>
                    <p className='bubble-desc'>{getTooltipText(item, '업적 설명이 없습니다.')}</p>
                  </div>
                </div>
              </React.Fragment>
            ))
          ) : (
            <div className='achievement-empty-block'>진행 중인 업적이 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  </div>
)

export default AchievementsPanel
