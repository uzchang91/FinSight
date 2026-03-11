import React from 'react'
import './Dashboard.css'

const Dashboard = () => {
  return (
    <div className='dash-container'>
      <div className=''>대시보드</div>
      <div className=''>
        <div className='dash-title'>
          <h1>어서오세요 <strong>사용자</strong>님!</h1>
          <p>일일 퀘스트 <span className='daily-percent'>00% 달성했어요!</span></p>
        </div>

      </div>
    </div>
  )
}

export default Dashboard