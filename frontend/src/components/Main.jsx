import React from 'react'
import Navigation from './Navigation'
import Dashboard from './dashboard'
import Profile from './Profile'

const Main = () => {
  return (
    <div className=''>
      <Navigation />
      <Dashboard/>
      <Profile />
    </div>
  )
}

export default Main