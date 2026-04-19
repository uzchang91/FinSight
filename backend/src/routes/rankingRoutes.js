const express = require("express");
const router = express.Router();
const rankingController = require("../controllers/rankingController");

// Optional auth — attaches req.user if a valid token is present,
// but never blocks the request with 401. The leaderboard is public data;
// currentUserId is just a convenience for highlighting the caller's row.
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      const { verifyToken } = require("../../src/utils/jwt");
      const token = authHeader.split(" ")[1];
      req.user = verifyToken(token);
    }
  } catch (_) {
    // Invalid/expired token — just proceed without req.user
  }
  next();
};

router.get("/", optionalAuth, rankingController.getLeaderboard);

module.exports = router;