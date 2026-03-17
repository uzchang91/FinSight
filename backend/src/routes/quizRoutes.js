const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");
const authMiddleware = require("../../middlewares/authMiddleware");

router.get("/", (req, res) => {
  res.send(`
    <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <title>Quiz API</title>
      </head>
      <body style="font-family:sans-serif; padding:40px; line-height:1.8;">
        <h1>🧠 Quiz API 연결 성공</h1>
        <hr />
        <ul>
          <li><a href="/">🏠 메인으로 돌아가기</a></li>
          <li><a href="/api/quiz/all">📚 전체 퀴즈 조회 (/api/quiz/all)</a></li>
          <li><a href="/api/quiz/random">🎲 랜덤 퀴즈 조회 (/api/quiz/random)</a></li>
          <li><a href="/api/quiz/1">🔎 퀴즈 1개 조회 (/api/quiz/1)</a></li>
          <li><a href="/api/quiz/status/me">📋 내 퀘스트 현황 (/api/quiz/status/me)</a></li>
        </ul>
      </body>
    </html>
  `);
});

router.get("/all", quizController.getAllQuizzes);
router.get("/random", quizController.getRandomQuiz);
router.get("/status/me", authMiddleware, quizController.getMyQuestStatus);
router.post("/check", authMiddleware, quizController.checkAnswer);
router.get("/:quiz_id", quizController.getQuizById);

module.exports = router;
