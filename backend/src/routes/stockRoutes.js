const express = require("express");
const router = express.Router();
const stockController = require("../controllers/stockController");

/**
 * @swagger
 * /api/stocks:
 *   get:
 *     summary: 전체 종목 조회
 *     tags: [Stocks]
 *     responses:
 *       200:
 *         description: 종목 목록 조회 성공
 */
router.get("/", stockController.getAllStocks);

/**
 * @swagger
 * /api/stocks/{symbol}/chart:
 *   get:
 *     summary: 종목 차트 조회
 *     tags: [Stocks]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: 종목 코드
 *     responses:
 *       200:
 *         description: 차트 조회 성공
 */
router.get("/:symbol/chart", stockController.getStockChart);

/**
 * @swagger
 * /api/stocks/{symbol}:
 *   get:
 *     summary: 종목 현재가 조회
 *     tags: [Stocks]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: 종목 코드
 *     responses:
 *       200:
 *         description: 현재가 조회 성공
 */
router.get("/:symbol", stockController.getStockPrice);

module.exports = router;