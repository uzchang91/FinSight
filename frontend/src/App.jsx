import './App.css'
import Join from './components/Join'
import Landing from './components/Login'

function App() {

  return (
    <div>
      <div className='landing-title'>
        <img src="/FinSight.svg" alt="" className='logo' />
        <h1>투자를 게임처럼 배우다!</h1>
      </div>
      <Join />
    </div>
  )
}

export default App