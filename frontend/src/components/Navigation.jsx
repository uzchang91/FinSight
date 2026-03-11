import React from 'react'
import './Navigation.css'
import finsight from '../assets/finsight.svg'
import iconp from '../assets/icons/icon-placeholder.svg'

const Navigation = () => {
  return (
    <div className='navigation'>
      <div className='nav-content'>
        <img src={finsight} alt="logo" className='nav-logo' />
        <ul className='nav-list'>
          <li className='nav-menu'>
            <img src={iconp} alt="dashboard" className='icons' /><span>대시보드</span>
          </li>
          <li className='nav-menu'>
            <img src={iconp} alt="Education" className='icons' /><span>교육실</span>
          </li>
          <li className='nav-menu'>
            <img src={iconp} alt="Strategic Room" className='icons' /><span>전략실</span>
          </li>
          <li className='nav-menu'>
            <img src={iconp} alt="Ranking" className='icons' /><span>랭킹</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default Navigation