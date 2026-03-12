const mysql = require("mysql2");

<<<<<<< HEAD
const conn = mysql.createPool({
=======
const db = mysql.createConnection({
>>>>>>> 041965bf9bcdc14e0632e7bcc6384745ff4fd888
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
<<<<<<< HEAD
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = conn;
=======
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error("DB 연결 실패:", err.message);
    return;
  }

  console.log("DB 연결 성공");
});

module.exports = db;
>>>>>>> 041965bf9bcdc14e0632e7bcc6384745ff4fd888
