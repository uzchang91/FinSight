import React, { useEffect, useState, useCallback, useMemo } from 'react'
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import './Main.css'
import Navigation from './Navigation'
import Dashboard from './Dashboard'
import Profile from './Profile'
import Strategy from './Strategy'
import Stocks from './Stocks'
import Ranking from './Ranking'
import Billing from './Billing'
import FAQPage from './FAQPage'
import { api } from '../config/api'
import HeaderBackground from './HeaderBackground'
import HeaderGrid from './HeaderGrid'

const Main = () => {

  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      // you can initiate the tsParticles instance (engine) here, adding custom shapes or presets
      // this loads the tsparticles package bundle, it's the easiest method for getting everything ready
      // starting from v2 you can add only the features you need reducing the bundle size
      //await loadAll(engine);
      //await loadFull(engine);
      await loadSlim(engine);
      //await loadBasic(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  const particlesLoaded = (container) => {
  };

  const options = useMemo(
    () => ({
      fullScreen: {
        enable: true,
        zIndex: -2,
      },
      fpsLimit: 120,
      interactivity: {
        events: {
          onClick: {
            enable: false,
            mode: "push",
          },
          onHover: {
            enable: true,
            mode: "repulse",
          },
          resize: true,
        },
        modes: {
          push: {
            quantity: 10,
          },
          repulse: {
            distance: 160,
            duration: 1,
          },
        },
      },
      particles: {
        color: {
          value: ["#4775FF", "#d858ff", "#FF4766"],
        },
        links: {
          color: "random",
          distance: 400,
          enable: true,
          opacity: 0.5,
          width: 1,
        },
        move: {
          direction: "none",
          enable: true,
          outModes: {
            default: "bounce",
          },
          random: false,
          speed: 1,
          straight: false,
        },
        number: {
          density: {
            enable: true,
            value_area: 120,
          },
          value: 70,
        },
        opacity: {
          value: 1,
        },
        shape: {
          type: "circle",
        },
        size: {
          value: { min: 1, max: 3 },
        },
      },
      detectRetina: true,
    }),
    [],
  );

  const VALID_MENUS = [
    'Dashboard',
    'Education',
    'Quiz',
    'Stocks',
    'Ranking',
    'Billing',
    'FAQ',
    'Strategy',
  ]

  const PROTECTED_MENUS = ['Quiz', 'Stocks', 'Billing']

  const getInitialMenu = () => {
    const hash = window.location.hash.replace('#', '')
    const menu = hash.split('/')[0]
    return VALID_MENUS.includes(menu) ? menu : 'Dashboard'
  }

  const [activeMenu, setActiveMenu] = useState(getInitialMenu)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [membershipType, setMembershipType] = useState(null)
  const [profileCollapsed, setProfileCollapsed] = useState(
    () => localStorage.getItem('profile_collapsed') === 'true'
  )
  const [role, setRole] = useState('user')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tokenFromUrl = params.get('token')

    if (tokenFromUrl) {
      localStorage.setItem('token', tokenFromUrl)
      const cleanUrl = window.location.origin + window.location.pathname + window.location.hash
      window.history.replaceState({}, document.title, cleanUrl)
    }

    const token = localStorage.getItem('token')
    const loggedIn = !!token
    setIsLoggedIn(loggedIn)

    const initialHash = window.location.hash.replace('#', '')
    const initialMenu = initialHash.split('/')[0]
    if (PROTECTED_MENUS.includes(initialMenu) && !loggedIn) {
      window.location.hash = 'Dashboard'
      setActiveMenu('Dashboard')
    }

    if (loggedIn) {
      fetchMembership(token)
      fetchRole(token)
    } else {
      setMembershipType(null)
      setRole('user')
    }

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '')
      const menu = hash.split('/')[0]
      if (!VALID_MENUS.includes(menu)) return

      const currentLoggedIn = !!localStorage.getItem('token')

      if (PROTECTED_MENUS.includes(menu) && !currentLoggedIn) {
        window.location.hash = 'Dashboard'
        return
      }

      setActiveMenu(menu)
    }

    window.addEventListener('hashchange', handleHashChange)

    // api.js 가 401 을 받으면 hard-redirect 대신 이 이벤트를 발생시킴
    const handleAuthExpired = () => {
      // Token may have already been refreshed by the time this event fires.
      // Only redirect if the token is genuinely gone.
      if (localStorage.getItem('token')) return
      window.location.hash = ''
      window.location.href = '/'
    }
    window.addEventListener('auth:expired', handleAuthExpired)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
      window.removeEventListener('auth:expired', handleAuthExpired)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('profile_collapsed', String(profileCollapsed))
  }, [profileCollapsed])

  // 토큰 만료 전 자동 갱신 — 45분마다 실행 (만료 1시간 기준, 여유 있게 갱신)
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const intervalId = setInterval(async () => {
      const currentToken = localStorage.getItem('token')
      if (!currentToken) return

      try {
        const data = await api.post('/api/auth/refresh', {})
        const newToken = data?.data?.token
        if (newToken) {
          localStorage.setItem('token', newToken)
        }
      } catch (err) {
        console.warn('토큰 자동 갱신 실패 (무시됨):', err.message)
      }
    }, 45 * 60 * 1000) // 45분마다

    return () => clearInterval(intervalId)
  }, [])

  const fetchMembership = async (token) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/billing/membership`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await res.json()

      if (!res.ok) {
        setMembershipType('free')
        return
      }

      const membership = data?.data?.membership_type || 'free'
      setMembershipType(membership)
    } catch (err) {
      console.error('멤버십 조회 실패:', err)
      setMembershipType('free')
    }
  }

  const fetchRole = async (token) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await res.json()
      // response shape: { success, data: { member: { role } } }  or  { success, data: { role } }
      const userRole =
        data?.data?.member?.role ??
        data?.data?.role ??
        'user'
      setRole(userRole)
    } catch (err) {
      console.error('role 조회 실패:', err)
      setRole('user')
    }
  }

  const handleMenuChange = (menu) => {
    const token = localStorage.getItem('token')
    const loggedIn = !!token
    setIsLoggedIn(loggedIn)

    if (PROTECTED_MENUS.includes(menu) && !loggedIn) {
      alert('로그인 후 이용할 수 있습니다.')
      window.location.hash = 'Dashboard'
      setActiveMenu('Dashboard')
      return
    }

    window.location.hash = menu
    setActiveMenu(menu)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const renderContent = () => {
    const token = localStorage.getItem('token')
    const loggedIn = !!token

    switch (activeMenu) {
      case 'Dashboard':
        return <Dashboard onNavigate={handleMenuChange} />
      case 'Strategy':
        return <Strategy
          onNavigate={handleMenuChange}
          activeMenu={activeMenu}
        />
      case 'Stocks':
        return loggedIn ? <Stocks /> : <Dashboard />
      case 'Ranking':
        return <Ranking />
      case 'Billing':
        return (
          <Billing
            membershipType={membershipType}
            setMembershipType={setMembershipType}
          />
        )
      case 'FAQ':
        return <FAQPage />
      default:
        return <Dashboard />
    }
  }
  if (init) {
    return (
      <>
        <HeaderGrid />
        <Particles
          id="tsparticles"
          particlesLoaded={particlesLoaded}
          options={options}
        />
        <div className='header-gd'>
        </div>
        <div className='main-body'>
          <aside className='navigation-area'>
            <Navigation
              setActiveMenu={handleMenuChange}
              activeMenu={activeMenu}
              membershipType={membershipType}
              role={role}
            />
          </aside>

          <div className='content-area'>
            {renderContent()}
          </div>

          <aside className='profile-area'>
            <Profile
              collapsed={profileCollapsed}
              setCollapsed={setProfileCollapsed}
            />
          </aside>
        </div>
      </>
    )
  }
}

export default Main