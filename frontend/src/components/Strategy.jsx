import { React, useState } from "react"
import Education from "./Education";
import QuizPage from "./QuizPage";

const Strategy = ({ onNavigate, activeMenu }) => {
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '')
    const tab = hash.split('/')[1]
    return tab === 'Quiz' ? 'Quiz' : 'Education'
  }

  const [activeTab, setActiveTab] = useState(getInitialTab)

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    window.location.hash = `Strategy/${tab}`
  }

  return (
    <div className='dash-container'>
      <div className='breadcrumb'>대시보드 &gt; 전략실</div>

      <div className='education-tabs'>
        <button
          className={`education-filter-btn strategy ${activeTab === 'Education' ? 'active' : ''}`}
          onClick={() => handleTabChange('Education')}
        >
          학습 리스트
        </button>
        <button
          className={`education-filter-btn strategy ${activeTab === 'Quiz' ? 'active' : ''}`}
          onClick={() => handleTabChange('Quiz')}
        >
          퀴즈 통합 첼린지
        </button>
      </div>

      {activeTab === 'Education' ? <Education /> : <QuizPage />}
    </div>
  )
}

export default Strategy