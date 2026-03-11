import React from 'react'
import './Profile.css'
import notification from '../assets/icons/notification.svg'
import account from '../assets/icons/account.svg'
import logout from '../assets/icons/logout.svg'
import iconp from '../assets/icons/icon-placeholder.svg'

const Profile = () => {
  return (
    <div className='profile'>
      <div className='profile-set'>
        <img src={notification} alt="notification" className='set-icons'/>
        <img src={account} alt="account" className='set-icons'/>
        <img src={logout} alt="logout" className='set-icons'/>
      </div>
    </div>
  )
}

export default Profile