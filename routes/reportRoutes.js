const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middleware/auth');
const { getSummaryReport } = require('../controllers/reportController');

router.get('/summary', verifyToken, verifyRole('treasury_accountant', 'director_of_budget', 'admin'), getSummaryReport);

module.exports = router;
