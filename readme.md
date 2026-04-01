FinSight (핀사이트) 📈🎮

    "감이 아닌 데이터로 실력을 쌓는 투자 게임" FinSight는 복잡한 주식 학습을 재미있는 게임 경험으로 전환하는 차세대 에듀핀테크(EdTech + FinTech) 플랫폼입니다. 

🌟 프로젝트 개요 (Overview)

FinSight는 주식 시장에 처음 입문하는 MZ세대를 위해 설계되었습니다. 기존의 단순 수익률 나열 방식에서 벗어나, 사용자의 투자 결정 과정 전체를 분석하고 '금융 정체성 카드'를 성장시키는 시스템을 제공합니다. 

    리스크 없는 실전 훈련: 실제 KOSPI 데이터를 활용하여 자산 손실 걱정 없이 투자 의사결정을 연습할 수 있습니다. 

    게임화된 성장 경험: 포인트 시스템, 랭킹 경쟁, 업적 달성을 통해 지속적인 학습 동기를 부여합니다. 

    데이터 기반 분석: 단순 수익률이 아닌 리스크 관리, 일관성 등 다각도 지표로 본인의 투자 성향을 파악합니다. 

🚀 핵심 기능 (Core Features)
1. ISR (Investment Skill Rating) 시스템 📊

FinSight만의 핵심 차별화 요소로, 운에 의한 수익이 아닌 실제 투자 역량을 6가지 지표로 수치화합니다. 

    판단력 (20%) 및 위험관리 (20%) 

    일관성 (15%) 및 투자습관 (15%) 

    전략성 (15%) 및 시장대응력 (17, 18%) 

2. 실전 데이터 기반 시뮬레이션 📉

    실시간 데이터 연동: yahoo-finance2 라이브러리를 통해 실제 KOSPI 종목의 OHLC 및 거래량 데이터를 반영합니다. 

    기술적 지표 제공: 서버 로직을 통해 RSI, MACD, 이동평균선(MA5/20) 등을 자동 산출하여 차트에 시각화합니다. 

    포인트 자본 시스템: 실제 돈이 아닌 포인트를 사용하여 손실 시 리스크 패널티를 적용받으며 실전을 대비합니다. 

3. AI 기반 금융 퀴즈 및 학습 🤖

    생성형 AI 문제: **Groq API(LLM)**를 활용해 실제 시장 상황과 유사한 투자 시나리오 및 퀴즈를 생성합니다. 

    맞춤형 피드백: 사용자의 정답률과 수준에 맞춰 LLM이 직접 해설과 피드백을 제공합니다. 

4. 게이미피케이션 (Gamification) 🏆

    시즌제 랭킹: 리더보드를 통해 사용자 간의 점수(ISR, 승률 등) 경쟁을 유도합니다. 

    금융 정체성 카드: 플레이를 통해 칭호와 업적을 획득하며 나만의 금융 프로필을 성장시킵니다. 

    레이더 차트 시각화: 분석된 6대 지표를 레이더 차트로 한눈에 보여줍니다. 

🛠 기술 스택 (Tech Stack)
구분	사용 기술
Frontend	

React, CSS (Glassmorphism UI), Responsive Design
Backend	

Node.js, Express
Database	

MySQL (사용자 활동, 로그 및 ISR 점수 관리)

Data API
	

yahoo-finance2 (KOSPI 시장 데이터 수집)
AI Engine	

Groq API (LLM 기반 퀴즈 생성 및 해설)
📂 프로젝트 구조 (Structure)
Plaintext

FinSight/
 ├── frontend/           # React SPA (차트, 레이더, 대시보드 UI)
 │    ├── src/components 
 │    └── src/assets     # 메달 및 업적 아이콘 SVG
 ├── backend/            # Node.js 서버
 │    ├── api/           # 인증, 주식 데이터, 퀴즈 관련 API
 │    ├── services/      # ISR 계산 로직 및 기술 지표 연산
 │    └── utils/         # Yahoo Finance & Groq API 연동 모듈
 └── README.md