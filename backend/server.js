require("dotenv").config();

const express = require("express");
const cors = require("cors");
const router = require("./src/routes/router.js");
const authRoutes = require("./src/routes/authRoutes.js");
const stockRoutes = require("./src/routes/stockRoutes.js");
const quizRoutes = require("./src/routes/quizRoutes.js");
const achievementRoutes = require("./src/routes/achievementRoutes.js");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/", router);
app.use("/api/auth", authRoutes);

app.use("/api/stocks", stockRoutes);
app.use("/api/quiz", quizRoutes);

app.use("/api/achievements", achievementRoutes);

app.get("/__whoami", (req, res) => {
  res.json({ ok: true, pid: process.pid, time: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`서버 실행중: http://localhost:${PORT}`);
});