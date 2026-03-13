import React ,{ useState } from 'react'
import './Main.css'
import Navigation from './Navigation'
import Dashboard from './dashboard'
import Profile from './Profile'
import QuizPage from './QuizPage'

const Main = () => {

  const [activeMenu, setActiveMenu] = useState('dashboard');

  return (
    <div className='main-body'>
      
      <Navigation setActiveMenu={setActiveMenu} activeMenu={activeMenu} />

      {activeMenu === 'dashboard' && <Dashboard />}
      {activeMenu === 'quiz' && <QuizPage />}
      
      <Profile />
    </div>
  )
}

export default Main