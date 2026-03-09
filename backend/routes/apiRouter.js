const express = require('express');
const router = express.Router();
const conn = require('../config/db');

// 회원가입
router.post('/members', (req, res) => {
    const { id, pw, nick } = req.body; // 객체 비구조화 할당
    const sql = "insert into member (id, pw, nick) values(?, ?, ?)";
    conn.query(sql, [id, pw, nick], (err, result) => {
        // console.log(result);
        if (err) {
            return res.status(500).json({
                success: false,
                message: "INTERNAL SERVER ERROR",
            });
        }
        if (result.affectedRows > 0) {
            // json 방식으로 응답하기
            res.json({
                success: true,
                message: "회원가입 성공"
            });
            // res.json({ result: "success", });
        } else {
            res.status(400).json({
                success: false,
                message: "회원가입 실패"
            });
            // res.status(400).json({ result: "failed", });
        };
    });
});

// 로그인
router.post('/login', (req, res) => {
    const { id, pw } = req.body;
    const sql = "select nick, id from member where id = ? and pw = ?";
    conn.query(sql, [id, pw], (err, result) => {
        // console.log(result);
        if (result.length > 0) {
            res.json({
                success: true,
                messange: "로그인 성공",
                user: result[0],
            });
        } else {
            res.status(400).json({
                success: false,
                message: "로그인 실패",
            });
        };
    })
});

// 회원정보수정
router.patch('/members', (req, res) => {
    const { id, pw, nick } = req.body;
    let sql = "update member set nick = ? where id = ? and pw = ?";
    conn.query(sql, [nick, id, pw], (err, result) => {
        if (result.affectedRows > 0) {
            res.json({
                success: true,
                messange: "업데이트 성공",
                user: result[0],
            });
        } else {
            res.status(400).json({
                success: false,
                message: "업데이트 실패",
            });
        }
    })
});

// 회원 탈퇴
router.delete('/members', (req, res) => {
    const { id, pw } = req.body;
    let sql = "delete from member where id=? and pw=?";
    conn.query(sql, [id, pw], (err, result) => {
        if (result.affectedRows > 0) {
            res.json({
                success: true,
                messange: "탈퇴 성공",
                user: result[0],
            });
        } else {
            res.status(400).json({
                success: false,
                message: "탈퇴 실패",
            });
        }
    })
});

module.exports = router;