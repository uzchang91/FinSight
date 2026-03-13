const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const authMiddleware = require("../../middlewares/authMiddleware");

/**
 * @swagger
 * /api/auth:
 *   get:
 *     summary: 소셜 로그인 화면
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: 로그인 화면 반환
 */
router.get("/", authController.loginPage);

/**
 * @swagger
 * /api/auth/test:
 *   get:
 *     summary: auth 라우터 테스트
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: 테스트 성공
 */
router.get("/test", authController.test);

router.get("/kakao", authController.kakaoLogin);
router.get("/kakao/callback", authController.kakaoCallback);

router.get("/google", authController.googleLogin);
router.get("/google/callback", authController.googleCallback);

router.get("/me", authMiddleware, authController.getMe);
router.patch("/me", authMiddleware, authController.updateMe);
router.get("/meta", authMiddleware, authController.getProfileMeta);
router.post("/logout", authMiddleware, authController.logout);

module.exports = router;