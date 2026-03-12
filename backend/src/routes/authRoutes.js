const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const authMiddleware = require("../../middleware/authMiddleware");

/* 기본 */
router.get("/", authController.loginPage);
router.get("/test", authController.test);

/* 소셜 로그인 */
router.get("/kakao", authController.kakaoLogin);
router.get("/kakao/callback", authController.kakaoCallback);

router.get("/google", authController.googleLogin);
router.get("/google/callback", authController.googleCallback);

/* 사용자 */
router.get("/me", authMiddleware, authController.getMe);
router.patch("/me", authMiddleware, authController.updateMe);

/* 로그아웃 */
router.post("/logout", authMiddleware, authController.logout);

module.exports = router;