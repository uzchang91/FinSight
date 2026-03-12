import React from 'react'
import './Profile.css'
import notification from '../assets/icons/notification.svg'
import account from '../assets/icons/account.svg'
import logout from '../assets/icons/logout.svg'
import iconp from '../assets/icons/icon-placeholder.svg'
import profile from '../assets/chicken running machine.gif'

const Profile = () => {
  return (
    <div className='profile'>
      <div className='profile-set'>
        <img src={notification} alt="notification" className='set-icons' />
        <img src={account} alt="account" className='set-icons' />
        <img src={logout} alt="logout" className='set-icons' />
      </div>
      <div className='profile-master'>
        <div className='profile-account'>
          <img src={profile} alt="profile image" className='profile-pic' />
          <div className='profile-premium'>👑</div>
        </div>
        <h2 className='profile-name'>Vivere</h2>
      </div>
      <div className='profile-stats'>
        <div className='stats-description'>
          <span className='description-top'>브론즈</span>
          <p>99</p>
        </div>
        <hr />
        <div className='stats-description'>
          <span className='description-top'>ISR</span>
          <p>86</p>
        </div>
      </div>
      <div className='total-description'>
          <span className='description-top'>시즌 누적 포인트</span>
          <p className='description-slave'>21,421<span>pt</span></p>
      </div>
      <div className='profile-stock'>
        <h2>투자 현황</h2>
        <div className='stock-content'>
          <span className='description-top'>원금</span>
          <p className='description-slave'>16,567<span>pt</span></p>
        </div>
        <div className='stock-content'>
          <span className='description-top'>총수익</span>
          <p className='description-slave gain'>1,967<span>pt</span></p>
        </div>
        <div className='stock-content'>
          <span className='description-top'>수익률</span>
          <p className='description-slave gain'>11.8<span>%</span></p>
        </div>
      </div>
    </div>
  )
}

export default Profile