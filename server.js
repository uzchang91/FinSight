require("dotenv").config();

const express = require("express");
const cors = require("cors");

const router = require("./backend/routes/router");
const authRoutes = require("./backend/routes/authRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", router);
app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`서버 실행중: http://localhost:${PORT}`);
  console.log("JWT_SECRET 존재 여부:", !!process.env.JWT_SECRET);
});