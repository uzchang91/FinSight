const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");

/**
 * @swagger
 * /api/quiz:
 *   get:
 *     summary: 퀴즈 API 메인 화면
 *     tags: [Quiz]
 *     responses:
 *       200:
 *         description: 퀴즈 API 메인 화면 반환
 */
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
        </ul>
        <p>난이도 필터 예시: <code>/api/quiz/all?difficulty=easy</code></p>
        <p>랜덤 퀴즈 예시: <code>/api/quiz/random?difficulty=medium</code></p>
      </body>
    </html>
  `);
});

/**
 * @swagger
 * /api/quiz/all:
 *   get:
 *     summary: 전체 퀴즈 조회
 *     tags: [Quiz]
 *     parameters:
 *       - in: query
 *         name: difficulty
 *         required: false
 *         schema:
 *           type: string
 *         description: 난이도 필터
 *     responses:
 *       200:
 *         description: 전체 퀴즈 조회 성공
 */
router.get("/all", quizController.getAllQuizzes);

/**
 * @swagger
 * /api/quiz/random:
 *   get:
 *     summary: 랜덤 퀴즈 조회
 *     tags: [Quiz]
 *     parameters:
 *       - in: query
 *         name: difficulty
 *         required: false
 *         schema:
 *           type: string
 *         description: 난이도 필터
 *     responses:
 *       200:
 *         description: 랜덤 퀴즈 조회 성공
 */
router.get("/random", quizController.getRandomQuiz);

/**
 * @swagger
 * /api/quiz/check:
 *   post:
 *     summary: 퀴즈 정답 확인
 *     tags: [Quiz]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quiz_id
 *               - answer
 *             properties:
 *               quiz_id:
 *                 type: integer
 *               answer:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 정답 확인 성공
 */
router.post("/check", quizController.checkAnswer);

/**
 * @swagger
 * /api/quiz/{quiz_id}:
 *   get:
 *     summary: 퀴즈 1개 조회
 *     tags: [Quiz]
 *     parameters:
 *       - in: path
 *         name: quiz_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 퀴즈 ID
 *     responses:
 *       200:
 *         description: 퀴즈 1개 조회 성공
 */
router.get("/:quiz_id", quizController.getQuizById);

module.exports = router;