import React, { useState, useEffect } from 'react';
import axios from 'axios';

const QuizPage = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedQuiz, setSelectedQuiz] = useState(null); 
  // 💡 userAnswer를 텍스트("")가 아닌 선택한 보기 번호(null -> 1, 2, 3, 4)로 저장합니다.
  const [userAnswer, setUserAnswer] = useState(null);

  // 1. 전체 퀴즈 목록 불러오기 (GET)
  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/quiz');
        if (response.data.success) {
          setQuizzes(response.data.data);
        }
      } catch (err) {
        console.error(err);
        setError("퀴즈를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };
    fetchQuizzes();
  }, []);

  // 2. 정답 제출하기 (POST)
  const submitAnswer = async () => {
    if (!userAnswer) {
      alert("보기를 선택해주세요!");
      return;
    }

    try {
      // 백엔드로 퀴즈 번호와 유저가 선택한 번호(1~4)를 보냅니다.
      const response = await axios.post('http://localhost:5000/api/quiz/answer', {
        quiz_id: selectedQuiz.quiz_id,
        answer: userAnswer
      });

      if (response.data.success) {
        alert(`결과: ${response.data.message}\n(해설: ${selectedQuiz.explanation})`);
        
        // 풀이가 끝났으니 다시 목록 화면으로 돌아갑니다.
        setSelectedQuiz(null);
        setUserAnswer(null);
      }
    } catch (err) {
      console.error(err);
      alert("채점 중 오류가 발생했습니다.");
    }
  };

  if (loading) return <div>퀴즈를 불러오는 중입니다... ⏳</div>;
  if (error) return <div>{error}</div>;

  // -----------------------------------------------------------------
  // 📺 화면 A: 특정 퀴즈를 선택했을 때 보여줄 [객관식 퀴즈 풀기 화면]
  // -----------------------------------------------------------------
  if (selectedQuiz) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <h2>📝 퀴즈 풀기</h2>
        <div style={{ border: '2px solid #007BFF', padding: '20px', borderRadius: '10px', backgroundColor: 'white' }}>
          <h3 style={{ marginTop: 0 }}>Q. {selectedQuiz.question}</h3>
          <p style={{ color: 'gray', marginBottom: '20px' }}>난이도: {selectedQuiz.difficulty}</p>
          
          {/* 💡 주관식 input 대신 4지선다 버튼을 생성합니다 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1, 2, 3, 4].map((num) => (
              <button
                key={num}
                onClick={() => setUserAnswer(num)} // 클릭하면 해당 번호가 정답으로 세팅됨
                style={{
                  padding: '15px',
                  textAlign: 'left',
                  fontSize: '16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  // 선택된 버튼은 파란색으로, 나머지는 회색으로 표시
                  backgroundColor: userAnswer === num ? '#007BFF' : '#f8f9fa',
                  color: userAnswer === num ? 'white' : 'black',
                  border: userAnswer === num ? '2px solid #0056b3' : '1px solid #ddd',
                  transition: 'all 0.2s'
                }}
              >
                {num}. {selectedQuiz[`option_${num}`]}
              </button>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
            <button 
              onClick={submitAnswer} 
              style={{ flex: 1, padding: '15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
            >
              정답 제출하기
            </button>
            <button 
              onClick={() => {
                setSelectedQuiz(null);
                setUserAnswer(null);
              }} 
              style={{ padding: '15px 25px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}
            >
              목록으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------
  // 📺 화면 B: 기본 상태인 [퀴즈 목록 화면]
  // -----------------------------------------------------------------
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>📝 금융/경제 퀴즈</h2>
      <p>퀴즈를 풀고 금융 지식을 쌓아보세요!</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {quizzes.map((quiz, index) => (
          <div key={quiz.quiz_id || index} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', backgroundColor: '#f9faff' }}>
            <p style={{ fontSize: '16px', margin: '0 0 10px 0' }}><strong>Q{index + 1}.</strong> {quiz.question}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#666', fontSize: '14px' }}>난이도: {quiz.difficulty}</span>
              <button 
                onClick={() => setSelectedQuiz(quiz)} 
                style={{ padding: '8px 16px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                이 퀴즈 풀기
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuizPage;