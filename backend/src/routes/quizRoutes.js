const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");

router.get("/", quizController.getAllQuizzes);
router.get("/random", quizController.getRandomQuiz);
router.get("/:quiz_id", quizController.getQuizById);
router.post("/answer", quizController.checkAnswer);

module.exports = router;