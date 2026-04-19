import React, { useState, useEffect } from 'react'
import Landing from './components/Landing'
import Main from './components/Main'
import FAQPage from './components/FAQPage'
import PaymentSuccess from './components/PaymentSuccess'

function App() {
  const [page, setPage] = useState(null)

  useEffect(() => {
    // ── 1. 결제 성공 페이지 먼저 처리 ──────────────────────────────
    if (window.location.pathname === '/payment/success') {
      setPage('payment_success')
      return
    }

    // ── 2. OAuth 콜백: URL 에 token 이 있으면 저장 후 즉시 main 으로 ──
    //    이 분기에서 return 하므로 storage 이벤트 이중 실행 문제 없음
    const urlParams = new URLSearchParams(window.location.search)
    const tokenFromUrl = urlParams.get('token')

    if (tokenFromUrl) {
      // Token must be in localStorage BEFORE replaceState, because replaceState
      // can fire a hashchange event in some browsers, which syncFromHash reads.
      localStorage.setItem('token', tokenFromUrl)
      localStorage.setItem('token_set_at', String(Date.now()))  // grace-period stamp for api.js

      // Suppress the synthetic hashchange that replaceState triggers
      let ignoreNextHashChange = true
      const guardedHashHandler = () => {
        if (ignoreNextHashChange) { ignoreNextHashChange = false; return }
      }
      window.addEventListener('hashchange', guardedHashHandler, { once: true })

      // Clean query string (keep hash intact)
      const cleanUrl =
        window.location.origin + window.location.pathname + window.location.hash
      window.history.replaceState({}, document.title, cleanUrl)

      setPage('main')
      return
    }

    // ── 3. 해시 기반 라우팅 (hashchange 이벤트로도 재실행) ──────────
    const syncFromHash = () => {
      const hash = window.location.hash.replace('#', '')

      if (hash === 'FAQ') {
        setPage('main')
        return
      }

      if (hash === 'HOME') {
        setPage('landing')
        return
      }

      // ── 4. 저장된 토큰 기준 기본 페이지 결정 ──────────────────────
      const savedToken = localStorage.getItem('token')
      setPage(savedToken ? 'main' : 'landing')
    }

    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)

    return () => {
      window.removeEventListener('hashchange', syncFromHash)
    }
  }, [])

  if (page === null) return null

  return (
    <>
      {page === 'landing' && <Landing setPage={setPage} />}
      {page === 'main' && <Main />}
      {page === 'faq' && <FAQPage setPage={setPage} />}
      {page === 'payment_success' && <PaymentSuccess />}
    </>
  )
}

export default App