import React from 'react'
import profile from '../assets/chicken running machine.gif'
import './Ranking.css'

const leagueData = [
  {
    id: 'bronze',
    title: '브론즈',
    users: [
      { rank: 1, name: 'Vivere', score: '99p' },
      { rank: 2, name: '주린이성준', score: '92p' },
      { rank: 3, name: '투자초보', score: '88p' },
      { rank: 4, name: '차트연습생', score: '81p' },
    ],
  },
  {
    id: 'silver',
    title: '실버',
    users: [
      { rank: 1, name: 'StockKing', score: '180p' },
      { rank: 2, name: 'BullRunner', score: '173p' },
      { rank: 3, name: 'CandleMaster', score: '165p' },
      { rank: 4, name: 'AlphaWave', score: '159p' },
    ],
  },
  {
    id: 'gold',
    title: '골드',
    users: [
      { rank: 1, name: 'GrowthHunter', score: '268p' },
      { rank: 2, name: 'ValuePick', score: '254p' },
      { rank: 3, name: 'BreakoutPro', score: '249p' },
      { rank: 4, name: 'BluechipFan', score: '241p' },
    ],
  },
  {
    id: 'diamond',
    title: '다이아',
    users: [
      { rank: 1, name: 'MarketLegend', score: '420p' },
      { rank: 2, name: 'TopTrader', score: '409p' },
      { rank: 3, name: 'PrimeInvestor', score: '401p' },
      { rank: 4, name: 'QuantumStock', score: '392p' },
    ],
  },
]

const Ranking = () => {
  const myLeague = '브론즈'
  const myPoint = 99
  const myRank = '1st'

  return (
    <main className='ranking-container'>
      <div className='ranking-breadcrumb'>대시보드 &gt; 랭킹</div>

      <section className='ranking-summary-card'>
        <h1>
          모두의 성적, <strong>시즌 랭킹!</strong>
        </h1>
        <p>나의 순위는 어디에?</p>
      </section>

      <section className='ranking-status-card'>
        <h2>
          {myLeague} / {myPoint}p
        </h2>
        <p>{myRank}</p>
      </section>

      <section className='league-grid'>
        {leagueData.map((league) => (
          <article className='league-card' key={league.id}>
            <h3 className='league-title'>{league.title}</h3>

            <ul className='league-user-list'>
              {league.users.map((user) => (
                <li className='league-user-item' key={`${league.id}-${user.rank}`}>
                  <div className='league-user-left'>
                    <span className='league-rank'>{user.rank}</span>
                    <img
                      src={profile}
                      alt='프로필 이미지'
                      className='league-profile'
                    />
                    <span className='league-name'>{user.name}</span>
                  </div>

                  <span className='league-score'>{user.score}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  )
}

export default Ranking