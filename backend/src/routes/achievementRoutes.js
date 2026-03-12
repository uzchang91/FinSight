const express = require("express");
const router = express.Router();
const achievementController = require("../controllers/achievementController");

router.get("/", achievementController.getAllAchievements);
router.get("/:id", achievementController.getAchievementById);

module.exports = router;