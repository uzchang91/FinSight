import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useThemeStore } from '../store/useThemeStore'
import ReactDOM from 'react-dom'
import './Profile.css'

import Notification from '../assets/icons/notification.svg?react'
import Edit from '../assets/icons/edit.svg?react'
import Mode from '../assets/icons/mode.svg?react'
import Account from '../assets/icons/account.svg?react'
import Logout from '../assets/icons/logout.svg?react'
import Spread from '../assets/icons/spread.svg?react'
import Premium from '../assets/icons/premium.svg?react'
import defaultProfile from '../assets/chicken running machine.png'
import { getAchievementIcon } from '../utils/achievementIconMap'
import { api, API_BASE_URL } from '../config/api'

import PointHistoryPanel from './PointHistoryPanel'
import AchievementsPanel from './AchievementsPanel'
import {
  extractArrayData, extractObjectData,
  normalizeOwnedStocks, normalizeLikedStocks, normalizeRecentAchievements,
  getStockPrincipal, getStockProfit,
  buildPortfolioSegments, buildAnimatedPortfolioSegments, easeOutCubic,
  formatNumber, formatSignedPercent, formatNoticeDate,
  getTooltipText,
} from './profileUtils'

// ─── Profile ─────────────────────────────────────────────────────────────────

const Profile = ({ collapsed, setCollapsed }) => {
  // ── Core data ──
  const [member, setMember] = useState(null)
  const [ownedStocks, setOwnedStocks] = useState([])
  const [likedStocks, setLikedStocks] = useState([])
  const [recentAchievements, setRecentAchievements] = useState([])
  const [notifications, setNotifications] = useState([])
  const [gameLog, setGameLog] = useState([])

  // ── Achievements / titles ──
  const [allAchievements, setAllAchievements] = useState([])
  const [achievementSummary, setAchievementSummary] = useState({ obtainedCount: 0, totalCount: 28 })
  const [achievementLoading, setAchievementLoading] = useState(false)
  const [titles, setTitles] = useState([])
  const [equippedTitle, setEquippedTitle] = useState(null)
  const [titleLoading, setTitleLoading] = useState(false)
  const [titleEquipLoading, setTitleEquipLoading] = useState(false)

  // ── UI state ──
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInvestmentModal, setShowInvestmentModal] = useState(false)
  const [portfolioChartProgress, setPortfolioChartProgress] = useState(0)
  const [showAllAchievements, setShowAllAchievements] = useState(false)
  const [showPointHistory, setShowPointHistory] = useState(false)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [notificationPosition, setNotificationPosition] = useState({ top: 0, left: 0 })
  const [hasUnreadNotification, setHasUnreadNotification] = useState(false)
  const [isTitleDropdownOpen, setIsTitleDropdownOpen] = useState(false)
  const [displayTier, setDisplayTier] = useState('브론즈')
  const [tierRank, setTierRank] = useState(null)

  // ── Edit state ──
  const [editMode, setEditMode] = useState(false)
  const [editNickname, setEditNickname] = useState('')
  const [editPreviewUrl, setEditPreviewUrl] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const titleDropdownRef = useRef(null)
  const fileInputRef = useRef(null)
  const nicknameInputRef = useRef(null)
  const notificationRef = useRef(null)

  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  // ── Effects ───────────────────────────────────────────────────────────────

  // Theme init
  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'light'
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  // Responsive collapse
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)')
    const handleMq = (e) => {
      if (e.matches) {
        setCollapsed(true)
        setShowAllAchievements(false)
        setShowPointHistory(false)
      } else {
        setCollapsed(localStorage.getItem('profile_collapsed') === 'true')
      }
    }
    handleMq(mq)
    mq.addEventListener('change', handleMq)
    return () => mq.removeEventListener('change', handleMq)
  }, [])

  // Click-outside for dropdowns
  useEffect(() => {
    const handle = (e) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target) && !e.target.closest('.notification-dropdown--fixed')) {
        setIsNotificationOpen(false)
      }
      if (titleDropdownRef.current && !titleDropdownRef.current.contains(e.target)) {
        setIsTitleDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Investment modal — scroll lock + Escape key
  useEffect(() => {
    if (!showInvestmentModal) return
    const handleKey = (e) => { if (e.key === 'Escape') setShowInvestmentModal(false) }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', handleKey) }
  }, [showInvestmentModal])

  // Portfolio chart animation
  useEffect(() => {
    if (!showInvestmentModal) { setPortfolioChartProgress(0); return }
    let frameId, startTime
    const duration = 1200
    const animate = (ts) => {
      if (!startTime) startTime = ts
      const raw = Math.min((ts - startTime) / duration, 1)
      setPortfolioChartProgress(easeOutCubic(raw))
      if (raw < 1) frameId = requestAnimationFrame(animate)
    }
    setPortfolioChartProgress(0)
    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [showInvestmentModal])

  // Revoke preview URL on change
  useEffect(() => {
    return () => { if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl) }
  }, [editPreviewUrl])

  // Initial data load + pointsUpdated listener
  useEffect(() => {
    loadProfile()
    loadNotifications()
    loadTradeHistory()

    const handleRefresh = () => {
      if (!localStorage.getItem('token')) return
      loadProfile()
      loadNotifications()
      loadTradeHistory()
    }
    window.addEventListener('pointsUpdated', handleRefresh)
    return () => window.removeEventListener('pointsUpdated', handleRefresh)
  }, [])

  // ── Data fetchers ─────────────────────────────────────────────────────────

  const loadProfile = async () => {
    if (!localStorage.getItem('token')) { setLoading(false); return }

    try {
      const [memberRes, ownedRes, likedRes, recentAchRes, equippedTitleRes] =
        await Promise.allSettled([
          api.get('/api/auth/me'),
          api.get('/api/stocks/owned'),
          api.get('/api/stocks/liked'),
          api.get('/api/recent-achievements?limit=3'),
          api.get('/api/titles/equipped'),
        ])

      // ── Member ──
      if (memberRes.status === 'rejected') {
        const msg = memberRes.reason?.message || ''
        if (!msg.includes('인증이 만료')) setError(msg || '프로필 로딩 실패')
        return
      }

      const raw = memberRes.value?.data ?? memberRes.value
      const memberData = raw?.member ?? raw?.data?.member ?? raw?.data ?? null
      setMember(memberData)
      setDisplayTier(memberData?.tier || '브론즈')

      const fallbackAch = normalizeRecentAchievements(raw?.recentAchievements ?? raw?.data?.recentAchievements ?? [])

      // ── Owned stocks ──
      if (ownedRes.status === 'fulfilled') {
        const data = normalizeOwnedStocks(ownedRes.value?.data ?? ownedRes.value)
        setOwnedStocks(Array.isArray(data) ? data : [])
      } else { setOwnedStocks([]) }

      // ── Liked stocks ──
      if (likedRes.status === 'fulfilled') {
        const data = normalizeLikedStocks(likedRes.value?.data ?? likedRes.value)
        setLikedStocks(Array.isArray(data) ? data : [])
      } else { setLikedStocks([]) }

      // ── Recent achievements ──
      if (recentAchRes.status === 'fulfilled') {
        const list = extractArrayData(recentAchRes.value?.data ?? recentAchRes.value)
        const normalized = normalizeRecentAchievements(list)
        setRecentAchievements(normalized.length > 0 ? normalized : fallbackAch)
      } else { setRecentAchievements(fallbackAch) }

      // ── Equipped title ──
      if (equippedTitleRes.status === 'fulfilled') {
        setEquippedTitle(extractObjectData(equippedTitleRes.value?.data ?? equippedTitleRes.value))
      } else { setEquippedTitle(null) }

      // ── Tier / rank from ranking (best-effort, never blocks) ──
      if (memberData?.member_id) {
        api.get('/api/ranking').then((res) => {
          const data = res?.data?.data ?? res?.data ?? res
          const leagues = data?.leagues || {}
          const uid = data?.currentUserId
          const tierOrder = [
            { key: 'diamond', label: '다이아' },
            { key: 'gold', label: '골드' },
            { key: 'silver', label: '실버' },
            { key: 'bronze', label: '브론즈' },
          ]
          for (const t of tierOrder) {
            const row = (leagues[t.key] || []).find((u) => Number(u.memberId) === Number(uid))
            if (row) { setDisplayTier(t.label); setTierRank(Number(row.leagueRank || 0) || null); break }
          }
        }).catch(() => {/* silent — tier from member.tier is already set */ })
      }

    } catch (err) {
      setError(err.message || '프로필 로딩 실패')
    } finally {
      setLoading(false)
    }
  }

  const loadNotifications = async () => {
    if (!localStorage.getItem('token')) return
    try {
      const res = await api.get('/api/points/notifications')
      const raw = res?.data ?? res
      const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
      setNotifications(list)
      setHasUnreadNotification(list.length > 0)
    } catch {
      setNotifications([])
      setHasUnreadNotification(false)
    }
  }

  const loadTradeHistory = async () => {
    if (!localStorage.getItem('token')) return
    try {
      const res = await api.get('/api/points/notifications')
      const list = extractArrayData(res?.data ?? res)
      setGameLog(Array.isArray(list) ? list : [])
    } catch { setGameLog([]) }
  }

  const loadAllAchievements = async () => {
    setAchievementLoading(true)
    try {
      const res = await api.get('/api/my-achievements')
      const data = extractObjectData(res?.data ?? res) || {}
      const achievements = Array.isArray(data?.achievements) ? data.achievements : []
      setAllAchievements(achievements)
      setAchievementSummary({
        obtainedCount: achievements.filter((a) => Number(a.is_obtained) === 1).length,
        totalCount: Number(data?.totalCount || achievements.length || 28),
      })
    } catch {
      setAllAchievements([])
      setAchievementSummary({ obtainedCount: 0, totalCount: 28 })
    } finally { setAchievementLoading(false) }
  }

  const loadMyTitles = async () => {
    setTitleLoading(true)
    try {
      const [titlesRes, equippedRes] = await Promise.all([
        api.get('/api/titles'),
        api.get('/api/titles/equipped'),
      ])
      setTitles(extractArrayData(titlesRes?.data ?? titlesRes))
      setEquippedTitle(extractObjectData(equippedRes?.data ?? equippedRes))
    } catch { setTitles([]) }
    finally { setTitleLoading(false) }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleEquipTitle = async (achId) => {
    setTitleEquipLoading(true)
    try {
      await api.patch('/api/titles/equip', { ach_id: achId })
      await loadMyTitles()
      setIsTitleDropdownOpen(false)
    } catch (err) {
      alert(err.message || '칭호 장착에 실패했습니다.')
    } finally { setTitleEquipLoading(false) }
  }

  const handleToggleTitleDropdown = async () => {
    const next = !isTitleDropdownOpen
    setIsTitleDropdownOpen(next)
    if (next && titles.length === 0) await loadMyTitles()
  }

  const handleOpenAchievements = async () => {
    setShowPointHistory(false)
    setShowAllAchievements(true)
    await Promise.all([
      allAchievements.length === 0 ? loadAllAchievements() : Promise.resolve(),
      loadMyTitles(),
    ])
  }

  const handleHideNotification = async (historyId) => {
    if (!window.confirm('이 포인트 변동 내역을 숨길까요?')) return
    try {
      await api.patch(`/api/points/notifications/${historyId}/hide`)
      setNotifications((prev) => prev.filter((item) => Number(item.history_id) !== Number(historyId)))
    } catch (err) {
      alert(err.message || '포인트 내역 숨김에 실패했습니다.')
    }
  }

  const handleLogout = () => {
    if (!confirm('로그아웃 하시겠어요?')) return
    localStorage.removeItem('token')
    localStorage.removeItem('member')
    localStorage.removeItem('nickname')
    sessionStorage.clear()
    alert('안전하게 로그아웃 되었습니다!')
    window.location.href = '/'
  }

  const handleDeleteAccount = async () => {
    setDeleteLoading(true)
    try {
      await api.delete('/api/auth/me')
      localStorage.removeItem('token')
      localStorage.removeItem('member')
      localStorage.removeItem('nickname')
      sessionStorage.clear()
      alert('계정이 삭제되었습니다. 이용해 주셔서 감사합니다.')
      window.location.href = '/'
    } catch (err) {
      alert(err?.response?.data?.message || err.message || '계정 삭제에 실패했습니다.')
    } finally { setDeleteLoading(false); setShowDeleteConfirm(false) }
  }

  const handleSave = async () => {
    if (!editNickname.trim()) { setSaveError('닉네임을 입력해주세요.'); nicknameInputRef.current?.focus(); return }
    setSaving(true); setSaveError('')
    try {
      if (fileInputRef.current?.files[0]) {
        const formData = new FormData()
        formData.append('profile_image', fileInputRef.current.files[0])
        const imageRes = await fetch(`${API_BASE_URL}/api/auth/me/image`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: formData,
        })
        const imageData = await imageRes.json().catch(() => null)
        if (!imageRes.ok || imageData?.success === false) {
          throw new Error(imageData?.message || '프로필 이미지 업로드에 실패했습니다.')
        }
      }
      const data = await api.patch('/api/auth/me', { nickname: editNickname.trim() })
      setMember((prev) => ({ ...prev, ...data.data.member, profile_image2: editPreviewUrl || data.data.member.profile_image2 }))
      setEditMode(false); setEditPreviewUrl(null)
    } catch (err) { setSaveError(err.message || '프로필 저장에 실패했습니다.') }
    finally { setSaving(false) }
  }

  const openEdit = () => {
    setEditNickname(member?.nickname || ''); setEditPreviewUrl(null); setSaveError(''); setEditMode(true)
    setTimeout(() => nicknameInputRef.current?.focus(), 50)
  }
  const closeEdit = () => { setEditMode(false); setEditPreviewUrl(null); setSaveError('') }

  // ── Derived values ────────────────────────────────────────────────────────

  const profileImg = member?.profile_image2 || member?.profile_image || defaultProfile
  const displayImg = editPreviewUrl || profileImg

  const membershipType = String(member?.membership_type || '').trim().toLowerCase()
  const isPremium = ['premium', 'premium_member', 'paid'].includes(membershipType)
  const membershipLabel = isPremium ? <><Premium alt='구독중' /> 멤버</> : 'Free'

  const investmentSummary = useMemo(() => ownedStocks.reduce(
    (acc, s) => { acc.totalInvested += getStockPrincipal(s); acc.totalProfit += getStockProfit(s); return acc },
    { totalInvested: 0, totalProfit: 0 }
  ), [ownedStocks])

  const portfolioChartData = useMemo(() => buildPortfolioSegments(ownedStocks), [ownedStocks])
  const animatedPortfolioChartData = useMemo(() => buildAnimatedPortfolioSegments(portfolioChartData, portfolioChartProgress), [portfolioChartData, portfolioChartProgress])

  const obtainedAchievements = useMemo(() => allAchievements.filter((a) => Number(a.is_obtained) === 1), [allAchievements])
  const inProgressAchievements = useMemo(() => allAchievements.filter((a) => Number(a.is_obtained) !== 1), [allAchievements])

  const currentTitleName = equippedTitle?.name || member?.title || '🌱 Vivere 주린이'
  const currentTitleDescription = getTooltipText(equippedTitle, '칭호 설명이 없습니다.')

  const displayTotalInvested = Number(investmentSummary.totalInvested || 0) > 0
    ? investmentSummary.totalInvested : Number(member?.bet_amount || 0)
  const displayTotalProfit = Number(investmentSummary.totalProfit || 0) !== 0
    ? investmentSummary.totalProfit : Number(member?.pnl_amount || 0)
  const totalProfitRate = Number(displayTotalInvested) > 0
    ? (Number(displayTotalProfit) / Number(displayTotalInvested)) * 100 : 0

  // ── Render guards ─────────────────────────────────────────────────────────

  if (loading) return <div className='profile'><div className='profile-content'>불러오는 중...</div></div>
  if (error) return <div className='profile'><div className='profile-content'>오류: {error}</div></div>

  if (showPointHistory) return (
    <PointHistoryPanel
      notifications={notifications}
      onBack={() => setShowPointHistory(false)}
      onHide={handleHideNotification}
    />
  )

  if (showAllAchievements) return (
    <AchievementsPanel
      titles={titles}
      equippedTitle={equippedTitle}
      titleLoading={titleLoading}
      titleEquipLoading={titleEquipLoading}
      onEquipTitle={handleEquipTitle}
      achievementSummary={achievementSummary}
      achievementLoading={achievementLoading}
      obtainedAchievements={obtainedAchievements}
      inProgressAchievements={inProgressAchievements}
      onBack={() => setShowAllAchievements(false)}
    />
  )

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <>
      <div className={`profile ${collapsed ? 'collapsed' : ''}`}>
        <div className='profile-content'>

          {/* ── Toolbar ── */}
          <div className='profile-set'>
            <button
              type='button'
              className='icon-container set-icons'
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? '프로필 펼치기' : '프로필 숨기기'}
            >
              <Spread
                alt={collapsed ? 'expand profile' : 'collapse profile'}
                className={`icons profile-toggle-icon ${collapsed ? 'profile-toggle-icon--collapsed' : ''}`}
              />
              <Account alt='account' className='icons profile-account-icon' />
            </button>

            <div className={`profile-set-extra ${collapsed ? 'profile-set-extra--hidden' : ''}`}>
              {/* Notification bell */}
              <div className='notification-wrap' ref={notificationRef}>
                <button
                  type='button'
                  className={`icon-container set-icons ${isNotificationOpen ? 'set-icons--active' : ''}`}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const dropdownWidth = 320
                    setNotificationPosition({
                      top: rect.bottom + 8,
                      left: Math.max(8, Math.min(rect.left, window.innerWidth - dropdownWidth - 8)),
                    })
                    setIsNotificationOpen((prev) => { if (!prev) setHasUnreadNotification(false); return !prev })
                  }}
                  title='최근 포인트 변동 알림'
                >
                  <Notification alt='notification' className='icons' />
                  {hasUnreadNotification && <span className='notification-dot' />}
                </button>

                {isNotificationOpen && ReactDOM.createPortal(
                  <div className='notification-dropdown notification-dropdown--fixed'>
                    <div className='notification-dropdown-header'>
                      <div className='notification-dropdown-title'>최근 알림 목록</div>
                      <button className='achievement-more-btn' onClick={() => { setIsNotificationOpen(false); setShowPointHistory(true) }}>더보기</button>
                    </div>
                    {notifications.length === 0 ? (
                      <div className='notification-empty'>알림이 없습니다.</div>
                    ) : notifications.slice(0, 5).map((item) => (
                      <div className='notification-item' key={item.history_id}>
                        <div className='notification-item-left'>
                          <div className='notification-name'>{item.type}</div>
                          <div className={`notification-amount ${Number(item.changeAmount) >= 0 ? 'positive' : 'negative'}`}>
                            {Number(item.changeAmount) >= 0 ? '+' : ''}{Number(item.changeAmount).toLocaleString('ko-KR')}pt
                          </div>
                        </div>
                        <div className='notification-date'>{formatNoticeDate(item.createdAt)}</div>
                      </div>
                    ))}
                  </div>,
                  document.body
                )}
              </div>

              <button type='button' className={`icon-container set-icons ${editMode ? 'set-icons--active' : ''}`} onClick={editMode ? closeEdit : openEdit} title={editMode ? '편집 취소' : '프로필 편집'}>
                <Edit alt='edit' className='icons' />
              </button>
              <button type='button' className='icon-container set-icons' onClick={toggleTheme}>
                <Mode alt='change mode' className='icons' />
              </button>
              <button type='button' className='icon-container set-icons' onClick={handleLogout} title='로그아웃'>
                <Logout alt='logout' className='icons' />
              </button>
            </div>
          </div>

          {/* ── Main panel (hidden when collapsed) ── */}
          {!collapsed && (
            <>
              {/* Avatar + nickname */}
              <div className='profile-master'>
                <div className='profile-account'>
                  <div
                    className={`glowing-container ${editMode ? 'glowing-container--editable' : ''}`}
                    style={{ '--profile-url': `url(${displayImg})` }}
                    onClick={editMode ? () => fileInputRef.current?.click() : undefined}
                    title={editMode ? '사진 변경' : undefined}
                  >
                    <img src={displayImg} alt='profile image' className='profile-pic' />
                    {editMode && <div className='avatar-edit-overlay'><span>📷</span></div>}
                  </div>

                  <div className={`profile-membership ${isPremium ? 'profile-membership--premium' : 'profile-membership--free'}`}>
                    {membershipLabel}
                  </div>

                  <input ref={fileInputRef} type='file' accept='image/*' style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setEditPreviewUrl(URL.createObjectURL(f)) }} />
                </div>

                {editMode ? (
                  <div className='nickname-edit-wrap'>
                    <input
                      ref={nicknameInputRef}
                      className='nickname-input'
                      type='text'
                      value={editNickname}
                      maxLength={20}
                      onChange={(e) => setEditNickname(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') closeEdit() }}
                      placeholder='닉네임 입력'
                    />
                    {saveError && <p className='nickname-error'>{saveError}</p>}
                    <div className='nickname-actions'>
                      <button className='edit-btn edit-btn--cancel' onClick={closeEdit} disabled={saving}>취소</button>
                      <button className='edit-btn edit-btn--save' onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
                    </div>
                    <button className='btn-ox btn-x ox-label' onClick={() => setShowDeleteConfirm(true)}>계정 삭제</button>
                  </div>
                ) : (
                  <>
                    <div>
                      <h2 className='profile-name'>{member?.nickname || '사용자'}</h2>
                      {/* Title badge + dropdown */}
                      <div className='profile-title-dropdown-wrap' ref={titleDropdownRef}>
                        <button
                          type='button'
                          className={`profile-title-badge ${isTitleDropdownOpen ? 'profile-title-open' : ''}`}
                          onClick={handleToggleTitleDropdown}
                        >
                          <span className='profile-title-text-hover'>
                            {currentTitleName}
                            <span className='profile-title-text-tooltip'>{currentTitleDescription}</span>
                          </span>
                        </button>

                        {isTitleDropdownOpen && (
                          <div className='profile-title-dropdown'>
                            <div className='profile-title-dropdown-header'>
                              <div className='profile-title-dropdown-title'>칭호 선택</div>
                              <span className='achievement-count'>{titles.length}개</span>
                            </div>
                            <div className='profile-title-dropdown-list'>
                              {titleLoading ? (
                                <div className='achievement-empty-block'>불러오는 중...</div>
                              ) : titles.length > 0 ? (
                                titles.map((item) => {
                                  const isEquipped = Number(item?.is_equipped) === 1 || Number(item?.ach_id) === Number(equippedTitle?.ach_id)
                                  return (
                                    <div className='title-item2' key={item.ach_id}>
                                      <div className='title-item-tooltip'>{getTooltipText(item, '칭호 설명이 없습니다.')}</div>
                                      <div className='title-item-left'><span className='title-item-name'>{item.name}</span></div>
                                      <button
                                        type='button'
                                        className={`title-equip-btn ${isEquipped ? 'title-equip-btn--active' : ''}`}
                                        disabled={titleEquipLoading || isEquipped}
                                        onClick={() => handleEquipTitle(item.ach_id)}
                                      >
                                        {isEquipped ? '장착 중' : titleEquipLoading ? '변경 중...' : '장착'}
                                      </button>
                                    </div>
                                  )
                                })
                              ) : (
                                <div className='achievement-empty-block'>보유한 칭호가 없습니다.</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Stats row */}
              <div className='profile-investment-legend'>
                <div className='profile-stats'>
                  <div className='stats-description'>
                    <span className='description-top'>{displayTier || '브론즈'}</span>
                    <p>{tierRank ? `${tierRank}` : '-'}<span className='point-unit'>위</span></p>
                  </div>
                  <hr />
                  <div className='stats-description'>
                    <span className='description-top'>ISR</span>
                    <p>{member?.isr_score ?? 0}</p>
                  </div>
                </div>
                <div className='total-description'>
                  <span className='description-top'>잔여 포인트</span>
                  <p className='description-slave'>
                    <span className='clickable-points' onClick={() => setShowPointHistory(true)}>
                      {formatNumber(member?.points ?? 0)}
                    </span>
                    <span className='point-unit'>pt</span>
                  </p>
                </div>
              </div>

              {/* Recent achievements */}
              <div className='profile-stock'>
                <div className='achievement-title-row'>
                  <h2>달성한 업적</h2>
                  <button className='achievement-more-btn' onClick={handleOpenAchievements}>더보기</button>
                </div>
                <div className='achievement-recent-grid'>
                  {recentAchievements.length > 0 ? (
                    recentAchievements.slice(0, 3).map((item, index) => (
                      <div className='achievement-recent-card' key={`${item?.ach_id || item?.name || 'ach'}-${index}`}>
                        {typeof item !== 'string' && (
                          <img src={getAchievementIcon(item.ach_id)} alt={item.name} className='achievement-recent-img' />
                        )}
                        <div className='achievement-recent-name'>{typeof item === 'string' ? item : item?.name}</div>
                        <div className='achievement-recent-tooltip'>
                          <div className='achievement-recent-tooltip-arrow' />
                          {getTooltipText(item, '업적 설명이 없습니다.')}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className='achievement-empty-block'>표시할 업적이 없습니다.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Investment modal */}
      {showInvestmentModal && ReactDOM.createPortal(
        <div className='trade-modal-overlay' onClick={() => setShowInvestmentModal(false)}>
          <div className='trade-modal-content' onClick={(e) => e.stopPropagation()}>
            <div className='trade-modal-header'>
              <h2>투자 현황</h2>
              <button className='trade-modal-close' onClick={() => setShowInvestmentModal(false)}>✕</button>
            </div>
            <div className='trade-modal-body'>
              <div className='profile-investment-section'>
                <div className='profile-investment-section-body'>
                  {portfolioChartData.segments.length > 0 ? (
                    <>
                      <div className='profile-investment-pie-wrap'>
                        <div className='profile-investment-pie' style={{ background: animatedPortfolioChartData.gradient }}>
                          <div className='profile-investment-pie-hole'>
                            <span className='profile-investment-pie-hole-label'>총 원금</span>
                            <p><strong>{formatNumber(portfolioChartData.total)}</strong><span>pt</span></p>
                          </div>
                        </div>
                      </div>
                      <div className='profile-investment-legend'>
                        {portfolioChartData.segments.map((item) => (
                          <div className='profile-investment-legend-item' key={item.id}>
                            <div className='profile-investment-legend-left'>
                              <span className='profile-investment-legend-color' style={{ backgroundColor: item.color }} />
                              <span>{item.name}</span>
                            </div>
                            <div className='profile-investment-legend-right'>
                              <span>{formatNumber(item.amount)}pt</span>
                              <strong>{item.ratio.toFixed(2)}%</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className='profile-investment-empty'>보유 주식이 없습니다.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && ReactDOM.createPortal(
        <div className='trade-modal-overlay' onClick={() => !deleteLoading && setShowDeleteConfirm(false)}>
          <div className='trade-modal-content' onClick={(e) => e.stopPropagation()}>
            <div className='trade-modal-header'><h2>계정 삭제</h2></div>
            <div className='trade-modal-body'>
              <p style={{ color: 'var(--text)', lineHeight: 1.6 }}>
                계정을 삭제하면 모든 데이터(포인트, 주식, 업적 등)가 <strong>영구적으로 삭제</strong>되며 복구할 수 없습니다.
              </p>
              <p style={{ color: 'var(--danger)', fontWeight: 600, marginTop: '0.5rem' }}>정말로 삭제하시겠어요?</p>
            </div>
            <div className='trade-modal-footer'>
              <button className='btn-cancel' onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>취소</button>
              <button className='submit-btn buy' onClick={handleDeleteAccount} disabled={deleteLoading} style={{ backgroundColor: 'var(--danger)' }}>
                {deleteLoading ? '삭제 중...' : '삭제하기'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default Profile