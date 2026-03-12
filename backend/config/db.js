const mysql = require("mysql2");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, conn) => {
  if (err) {
    console.error(" DB 연결 실패:", err.message);
  } else {
    console.log(" DB 연결 성공 (Connection Pool 준비 완료)");
    conn.release(); // 연결 확인만 하고 다시 풀(Pool)에 반납
  }
});

module.exports = db;