<<<<<<< HEAD
console.log("ROUTER LOADED ✅", new Date().toISOString());
const express = require("express");
const router = express.Router();
const db = require("../config/db.js");
const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey']
});

router.get("/", (req,res)=>{
  res.send("접속완료")
})

router.get("/members", async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM members"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({
      message: "DB error",
      error: err.message
    });
  }
=======
const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.get("/", (req, res) => {
  res.send(`
    <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <title>FinSight Backend</title>
      </head>
      <body style="font-family:sans-serif; padding:40px;">
        <h1>FinSight Backend 연결 성공</h1>
        <p><a href="/ping">DB 연결 확인</a></p>
        <p><a href="/members-test">Members 조회</a></p>
        <p><a href="/api/auth">소셜 로그인 화면으로 이동</a></p>
      </body>
    </html>
  `);
>>>>>>> 041965bf9bcdc14e0632e7bcc6384745ff4fd888
});

router.get("/ping", async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT 1 AS ok");
<<<<<<< HEAD
    res.json(rows[0]); // { ok: 1 }
  } catch (err) {
    res.status(500).json({ message: "DB error", error: err.message });
  }
});


=======

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

router.get("/members-test", async (req, res) => {
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
>>>>>>> 041965bf9bcdc14e0632e7bcc6384745ff4fd888

module.exports = router;