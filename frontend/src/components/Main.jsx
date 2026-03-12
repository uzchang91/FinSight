import React from 'react'
import './Main.css'
import Navigation from './Navigation'
import Dashboard from './dashboard'
import Profile from './Profile'

const Main = () => {
  return (
    <div className='main-body'>
      <Navigation />
      <Dashboard/>
      <Profile />
    </div>
  )
}

export default Main