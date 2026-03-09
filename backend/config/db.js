// mySQL 서버에 접속할때 사용하는 파일
const mysql = require('mysql2');

// DB서버에 연결할 연결정보를 생성
const conn = mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'nodejs',
});

// 연결 정보를 가지고 DB에 연결
conn.connect();

module.exports = conn;