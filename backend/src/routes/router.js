console.log("ROUTER LOADED ✅", new Date().toISOString());

const express = require("express");
const router = express.Router();
// 새집(src) 구조에 맞는 올바른 경로
const db = require("../../config/db");

// 1. 기본 접속 화면 (백엔드 1번의 예쁜 HTML UI 적용)
router.get("/", (req, res) => {
  res.send(`
    <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <title>FinSight Backend</title>
      </head>
      <body style="font-family:sans-serif; padding:40px;">
        <h1>FinSight Backend 연결 성공 🚀</h1>
        <p><a href="/ping">DB 연결 확인 (/ping)</a></p>
        <p><a href="/members">Members 조회 (/members)</a></p>
        <p><a href="/api/auth">소셜 로그인 화면으로 이동 (/login)</a></p>
      </body>
    </html>
  `);
});

// 2. DB 연결 테스트 라우터 (성공/실패 규격 통일)
router.get("/ping", async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT 1 AS ok");

    return res.json({
      success: true,
      message: "DB 연결 성공",
      data: rows[0]
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "DB 연결 실패",
      error: err.message
    });
  }
});

// 3. 회원 목록 조회 테스트 라우터
router.get("/members", async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM members");

    return res.json({
      success: true,
      message: "members 조회 성공",
      data: rows
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "members 조회 실패",
      error: err.message
    });
  }
});

module.exports = router;