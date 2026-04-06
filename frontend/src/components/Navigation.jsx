import React, { useEffect, useState } from 'react'
import './Navigation.css'
import LongLogo  from '../assets/finsight.svg?react'
import Dashboard from '../assets/icons/dashboard.svg?react'
import Collapse_menu from '../assets/icons/collapse_menu.svg?react'
import Education from '../assets/icons/education.svg?react'
import Card from '../assets/icons/card.svg?react'
import Rank from '../assets/icons/rank.svg?react'
import Quiz from '../assets/icons/quiz.svg?react'
import Stocks from '../assets/icons/stocks.svg?react'
import Faq from '../assets/icons/megaphone.svg?react'

const Navigation = ({
  setActiveMenu,
  activeMenu,
  membershipType,
  collapsed,
  setCollapsed,
  role,
}) => {
  const isStrategyOpen = activeMenu === 'Quiz' || activeMenu === 'Stocks'
  const [open, setOpen] = useState(isStrategyOpen)

  const isPremium = membershipType === 'premium'
  const isMembershipLoaded = membershipType !== null

  useEffect(() => {
    if (isStrategyOpen) {
      setOpen(true)
    }
  }, [isStrategyOpen])

  const handleCancel = async () => {
    const confirmed = window.confirm('정말 구독취소하시겠습니까?')
    if (!confirmed) return

    try {
      const token = localStorage.getItem('token')

      if (!token) {
        alert('로그인이 필요합니다.')
        return
      }

      const res = await fetch('http://localhost:5000/api/billing/premium/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      const contentType = res.headers.get('content-type') || ''

      if (!contentType.includes('application/json')) {
        throw new Error('구독취소 API 응답이 올바르지 않습니다. 서버를 다시 확인해주세요.')
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '구독취소 실패');
      };

      alert(data.message || '구독취소가 되었습니다.');
      window.location.reload()
    } catch (err) {
      alert(err.message || '오류가 발생했습니다.');
    }
  }

  return (
    <aside className={`navigation${collapsed ? ' collapsed' : ''}`}>
      <nav className='nav-content'>
        <div className='nav-wrapper'>
          <div className='nav-header'>
            <button
              type='button'
              className='nav-logo-button'
              onClick={() => setActiveMenu('Dashboard')}
              aria-label='대시보드로 이동'
            >
              <LongLogo alt='logo' className='nav-logo' />
            </button>

            <button
              type='button'
              className='collapse-button'
              onClick={() => {
                const next = !collapsed
                localStorage.setItem('nav_collapsed', next)
                setCollapsed(next)
              }}
              aria-label={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
            >
              <Collapse_menu alt='collapse menu' className='collapse-menu' />
            </button>
          </div>

          <ul className='nav-list'>
            <li
              className={`nav-menu ${activeMenu === 'Dashboard' ? 'active' : ''}`}
              onClick={() => setActiveMenu('Dashboard')}
              title={collapsed ? '대시보드' : undefined}
            >
              <div className='nav-line'>
                <Dashboard alt='Dashboard' className='icons icon-btn' />
                <span>대시보드</span>
              </div>
            </li>

            <li
              className={`nav-menu ${activeMenu === 'Education' ? 'active' : ''}`}
              onClick={() => setActiveMenu('Education')}
              title={collapsed ? '교육실' : undefined}
            >
              <div className='nav-line'>
                <Education alt='Education' className='icons icon-btn' />
                <span>교육실</span>
              </div>
            </li>

            <li
              className={`nav-menu ${activeMenu === 'Quiz' ? 'active' : ''}`}
              onClick={() => setActiveMenu('Quiz')}
              title={collapsed ? '퀴즈' : undefined}
            >
              <div className='nav-line'>
                <Quiz alt='퀴즈' className='icons icon-btn' />
                <span>퀴즈</span>
              </div>
            </li>

            <li
              className={`nav-menu ${activeMenu === 'Stocks' ? 'active' : ''}`}
              onClick={() => setActiveMenu('Stocks')}
              title={collapsed ? '주식' : undefined}
            >
              <div className='nav-line'>
                <Stocks alt='주식' className='icons icon-btn' />
                <span>주식</span>
              </div>
            </li>

            <li
              className={`nav-menu ${activeMenu === 'Ranking' ? 'active' : ''}`}
              onClick={() => setActiveMenu('Ranking')}
              title={collapsed ? '랭킹' : undefined}
            >
              <div className='nav-line'>
                <Rank alt='Ranking' className='icons icon-btn' />
                <span>랭킹</span>
              </div>
            </li>

            <li
              className={`nav-menu ${activeMenu === 'FAQ' ? 'active' : ''}`}
              onClick={() => setActiveMenu('FAQ')}
              title={collapsed ? 'FAQ' : undefined}
            >
              <div className='nav-line'>
                <Faq alt='FAQ' className='icons icon-btn' />
                <span>FAQ</span>
              </div>
            </li>
            <li>
              <div className='billing-nav'>
                <div className='billing-action-wrap'>
                  <button
                    type='button'
                    className={`billing-nav-button ${isPremium ? 'disabled' : ''}`}
                    onClick={() => {
                      if (isMembershipLoaded && !isPremium) {
                        setActiveMenu('Billing')
                      } else {
                        handleCancel()
                      }
                    }}
                  >
                    {!isMembershipLoaded
                      ? '확인 중...'
                      : isPremium
                        ? '구독 취소'
                        : (
                          <>
                            <Card alt='결제' className='icons' />
                            <span>구독하기</span>
                          </>
                        )}
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </div>

      </nav>
    </aside>
  )
}

export default Navigation