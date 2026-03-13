import React, { useEffect, useState } from 'react'
import Landing from './components/Landing'
import Main from './components/Main'

function App() {
  const [page, setPage] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('token') ? 'main' : 'landing'
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')

    if (token) {
      localStorage.setItem('token', token)
      window.history.replaceState({}, '', '/')  // clean the URL
      setPage('main')
    }

    if (params.get('error')) {
      alert('카카오 로그인에 실패했습니다.')
    }
  }, [])
  return (
    <>
      {page === 'landing' && <Landing setPage={setPage} />}
      {page === 'main' && <Main />}
    </>
  )
}

export default App