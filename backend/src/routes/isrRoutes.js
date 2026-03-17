const express = require("express");
const router = express.Router();

const isrController = require("../controllers/isrController");
const authMiddleware = require("../../middlewares/authMiddleware");

/* 로그인 사용자 ISR 계산 */
router.get("/me", authMiddleware, async (req, res) => {
  const memberId =
    req.user?.member_id ||
    req.user?.id ||
    req.user?.memberId ||
    req.user?.userId;

  req.params.member_id = memberId;
  return isrController.calculateUserISR(req, res);
});

/* 로그인 사용자 최신 ISR 조회 */
router.get("/me/latest", authMiddleware, async (req, res) => {
  const memberId =
    req.user?.member_id ||
    req.user?.id ||
    req.user?.memberId ||
    req.user?.userId;

  req.params.member_id = memberId;
  return isrController.getLatestISR(req, res);
});

/* 특정 회원 ISR 계산 */
router.get("/:member_id", isrController.calculateUserISR);

/* 특정 회원 최신 ISR 조회 */
router.get("/:member_id/latest", isrController.getLatestISR);

/* 전체 회원 ISR 재계산 */
router.post("/recalculate-all", isrController.calculateAllISR);

module.exports = router;
