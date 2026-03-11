require("dotenv").config();

const express = require("express");
const cors = require("cors");
const router = require("./routes/router.js");
const loginRouter = require("./routes/loginRouter.js");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/", router);
app.use("/login", loginRouter);

app.get("/__whoami", (req, res) => {
  res.json({ ok: true, pid: process.pid, time: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`서버 실행중: http://localhost:${PORT}`);
});