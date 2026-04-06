const express = require("express");
const router = express.Router();
const db = require("../../config/db");
const passport = require("passport");
const authController = require("../controllers/authController");

console.log("ROUTER LOADED ✅", new Date().toISOString());

router.get("/", (req, res) => {});

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