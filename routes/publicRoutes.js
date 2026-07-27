const express = require('express');
const router = express.Router();
const { listDepartments, listVoteHeads } = require('../controllers/publicController');

router.get('/departments', listDepartments);
router.get('/vote-heads', listVoteHeads);

module.exports = router;
