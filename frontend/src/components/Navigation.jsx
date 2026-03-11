import React from 'react'
import './Navigation.css'
import logo from '../assets/finsight.svg'
import logoLong from '../assets/logo-long.svg'
import iconp from '../assets/icons/icon-placeholder.svg'

const Navigation = () => {
  return (
    <div className='navigation'>
      <nav className='nav-content'>
        <img src={logoLong} alt="logo" className='nav-logo' />
        <ul className='nav-list'>
          <li className='nav-menu'>
            <div className='nav-line'>
              <img src={iconp} alt="dashboard" className='icons' /><span>대시보드</span>
            </div>
          </li>
          <li className='nav-menu'>
            <div className='nav-line'>
              <img src={iconp} alt="Education" className='icons' /><span>교육실</span>
            </div>
          </li>
          <li className='nav-menu'>
            <div className='nav-line'>
              <img src={iconp} alt="Strategy Room" className='icons' /><span>전략실</span>
            </div>
            <img src={iconp} alt="collapsed" className='icons' />
          </li>
          <li className='nav-menu'>
            <div className='nav-line'>
              <img src={iconp} alt="Ranking" className='icons' /><span>랭킹</span>
            </div>
          </li>
        </ul>
      </nav>
    </div>
  )
}

export default Navigation