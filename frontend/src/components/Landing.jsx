import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useThemeStore } from '../store/useThemeStore';
import './Landing.css'
import FAQPage from './FAQPage'
import { api, API_BASE_URL } from '../config/api'
import Kakao from '../assets/kakao.svg?react'
import Google from '../assets/google.svg?react'
import Home from '../assets/icons/home.svg?react'
import Service from '../assets/icons/bar-chart.svg?react'
import FaqIcon from '../assets/icons/megaphone.svg?react'
import Minus from '../assets/icons/minus.svg?react'
import Plus from '../assets/icons/plus.svg?react'
import CloseIcon from '../assets/icons/close.svg?react'
import LogoDark from '../assets/finsight.svg?react'
import LogoWhite from '../assets/finsight-w.svg?react'
import LongLogo from '../assets/logo_long.svg?react'
import LongLogoW from '../assets/logo_long_w.svg?react'
import Mode from '../assets/icons/mode.svg?react'
import MarketBackground from './MarketBackground'
import BackgroundGrid from './BackgroundGrid'

const BACKEND_URL = API_BASE_URL;

const Landing = ({ setPage }) => {
  const [faqList, setFaqList] = useState([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('전체')
  const [openFaqId, setOpenFaqId] = useState(null)
  const [faqModalOpen, setFaqModalOpen] = useState(false)
  const [faqModalTarget, setFaqModalTarget] = useState('top')

  const topRef = useRef(null)
  const serviceRef = useRef(null)
  const faqRef = useRef(null)

  const clearAuth = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('member')
    localStorage.removeItem('nickname')
    sessionStorage.clear()
  }

  const scrollToSection = (elementRef) => {
    elementRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const handleKakaoLogin = () => {
    clearAuth()
    window.location.href = `${BACKEND_URL}/api/auth/kakao`
  }

  const handleGoogleLogin = () => {
    clearAuth()
    window.location.href = `${BACKEND_URL}/api/auth/google`
  }

  const getFaqCategory = (faq) => {
    const text = `${faq?.question || ''} ${faq?.answer || ''}`.toLowerCase()

    if (
      text.includes('로그인') ||
      text.includes('카카오') ||
      text.includes('구글') ||
      text.includes('계정')
    ) {
      return '로그인'
    }

    if (
      text.includes('퀴즈') ||
      text.includes('교육') ||
      text.includes('학습')
    ) {
      return '학습'
    }

    if (
      text.includes('투자') ||
      text.includes('주식') ||
      text.includes('실전') ||
      text.includes('가상')
    ) {
      return '투자'
    }

    if (
      text.includes('포인트') ||
      text.includes('랭킹') ||
      text.includes('isr')
    ) {
      return '성장'
    }

    return '기타'
  }

  const goToFaqPage = (focusTarget = 'top') => {
    setFaqModalTarget(focusTarget)
    setFaqModalOpen(true)
    document.body.style.overflow = 'hidden'
  }

  const closeFaqModal = () => {
    setFaqModalOpen(false)
    document.body.style.overflow = ''
  }

  useEffect(() => {
    const fetchFaq = async () => {
      try {
        const result = await api.get('/api/faq?limit=5')

        if (Array.isArray(result?.data)) {
          setFaqList(result.data)
        } else {
          setFaqList([])
        }
      } catch (err) {
        console.error('FAQ 불러오기 실패:', err)
        setFaqList([])
      }
    }

    fetchFaq()
  }, [])

  const categories = useMemo(() => {
    const dynamicCategories = faqList.map((faq) => getFaqCategory(faq))
    return ['전체', ...Array.from(new Set(dynamicCategories))]
  }, [faqList])

  const filteredFaqList = useMemo(() => {
    return faqList.filter((faq) => {
      const category = getFaqCategory(faq)
      const keyword = searchKeyword.trim().toLowerCase()
      const targetText = `${faq.question || ''} ${faq.answer || ''}`.toLowerCase()

      const categoryMatched =
        selectedCategory === '전체' || selectedCategory === category

      const keywordMatched =
        keyword === '' || targetText.includes(keyword)

      return categoryMatched && keywordMatched
    })
  }, [faqList, selectedCategory, searchKeyword])

  const toggleFaq = (faqId) => {
    setOpenFaqId((prev) => (prev === faqId ? null : faqId))
  }

  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  return (
    <div className='white-section' ref={topRef}>
      <BackgroundGrid />
      <MarketBackground />

      <div className='landing-header'>
        <div className='header-logo'>
          {isDarkMode ? <LongLogoW className='landing-logo' /> : <LongLogo className='landing-logo' />}
          {isDarkMode ? <LogoWhite className='landing-logo2' /> : <LogoDark className='landing-logo2' />}
        </div>

        <div className='landing-navigation'>
          <div className='landing-btn'>
            <button
              className='landing-navigation-menu'
              onClick={() => scrollToSection(topRef)}
            >
              <Home alt='home' className='landing-menu' />
              <p>홈</p>
            </button>

            <button
              className='landing-navigation-menu'
              onClick={() => scrollToSection(serviceRef)}
            >
              <Service alt='service' className='landing-menu' />
              <p>서비스</p>
            </button>

            <button
              className='landing-navigation-menu'
              onClick={() => scrollToSection(faqRef)}
            >
              <FaqIcon alt='faq' className='landing-menu' />
              <p>FAQ</p>
            </button>

            <button
              type='button'
              className='landing-navigation-menu'
              onClick={toggleTheme}
            >
              <Mode alt='change mode' className='landing-menu' />
              <p>테마</p>
            </button>
          </div>
        </div>

        <div className='floating-nav'>
          <button className='kakao_btn' onClick={handleKakaoLogin}>
            <Kakao alt='카카오' />
            <span>로그인</span>
          </button>

          <button className='google_btn' onClick={handleGoogleLogin}>
            <Google alt='구글' />
            <span>로그인</span>
          </button>
        </div>
      </div>

      <div className='container'>
        <div className='landing-content'>
          <div className='title'>
            <h1 className='hero-title'>투자를 <span className='text-gradient'>게임처럼</span> 배우다</h1>
          </div>
          <div className='title-description'>
            <p>주식 차트 분석, 투자 판단, 그리고 나만의 투자 성향 분석까지.</p>
            <p>실전 데이터를 기반으로 투자 감각을 훈련하는 금융 트레이닝 플랫폼.</p>
          </div>
          <div className='ad-title' ref={serviceRef}>
            <h2>많은 사람들이 투자에 관심이 있지만,</h2>
            <div className='intro-description'>
              <h3>사기를 당할까 걱정...</h3>
              <h4>돈을 다 잃을까 무섭고...</h4>
              <h4>어디서부터 시작해야 할지 모르겠고...</h4>
            </div>
          </div>
          <div className='title-description'>
            <p>그래서 우리는 투자를 안전하게 연습할 수 있는 공간을 만들고,</p>
            <p>실제 시장 데이터 기반으로 투자 판단을 습득하고 자신의 투자 스타일을 분석!</p>
          </div>
          <div className='floating-nav2'>
            <button className='kakao_btn2' onClick={handleKakaoLogin}>
              <Kakao alt='카카오' />
              <span>카카오로 시작</span>
            </button>

            <button className='google_btn2' onClick={handleGoogleLogin}>
              <Google alt='구글' />
              <span>구글로 시작</span>
            </button>
          </div>
        </div>


        <section id='faq-section' className='landing-faq-section' ref={faqRef}>
          <div className='landing-faq-header'>
            <p className='landing-faq-subtitle'>FAQ PREVIEW</p>
            <h2>자주 묻는 질문</h2>
            <p className='landing-faq-preview-desc'>
              자주 찾는 질문만 먼저 모아봤습니다. 전체 내용과 질문 남기기는 FAQ 페이지에서 볼 수 있습니다.
            </p>
          </div>

          <div className='landing-faq-toolbar'>
            <div className='landing-faq-categories'>
              {categories.map((category) => (
                <button
                  key={category}
                  type='button'
                  className={`landing-faq-chip ${selectedCategory === category ? 'active' : ''
                    }`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            <input
              type='text'
              className='landing-faq-search'
              placeholder='질문 검색'
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
          </div>

          <div className='landing-faq-list'>
            {filteredFaqList.length === 0 ? (
              <p className='faq-empty'>검색 결과가 없습니다.</p>
            ) : (
              filteredFaqList.map((faq) => {
                const isOpen = openFaqId === faq.faq_id
                const category = getFaqCategory(faq)

                return (
                  <div key={faq.faq_id} className='landing-faq-accordion'>
                    <button
                      type='button'
                      className={`landing-faq-question-row ${isOpen ? 'open' : ''}`}
                      onClick={() => toggleFaq(faq.faq_id)}
                    >
                      <div className='landing-faq-question-left'>
                        <span className={`landing-faq-badge ${category}`}>{category}</span>
                        <span className='landing-faq-question-text'>
                          Q. {faq.question}
                        </span>
                      </div>
                      <span className='landing-faq-toggle'>{isOpen ? <Minus /> : <Plus />}</span>
                    </button>

                    {isOpen && (
                      <div className='landing-faq-answer-box'>
                        <p>A. {faq.answer}</p>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div className='landing-faq-preview-actions'>
            <button
              type='button'
              className='landing-faq-primary-btn'
              onClick={() => goToFaqPage('top')}
            >
              전체 FAQ 보기
            </button>

            <button
              type='button'
              className='landing-faq-secondary-btn'
              onClick={() => goToFaqPage('question')}
            >
              질문 남기기
            </button>
          </div>
        </section>
      </div>

      {/* ── FAQ Modal ─────────────────────────────────── */}
      {faqModalOpen && (
        <div className='faq-modal-overlay' onClick={closeFaqModal}>
          <div className='faq-modal-container' onClick={(e) => e.stopPropagation()}>
            <div className='faq-modal-header'>
              <button
                className='faq-modal-close'
                onClick={closeFaqModal}
                aria-label='닫기'
              >
                <CloseIcon alt="닫기" />
              </button>
            </div>
            <div className='faq-modal-body'>
              <FAQPage scrollTarget={faqModalTarget} />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Landing