const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middleware/auth');
const { createRequest, getMyRequests } = require('../controllers/requestController');

// Only logged-in MDA Officers can submit requests
router.post('/', verifyToken, verifyRole('mda_officer'), createRequest);

// Any logged-in user can view their own submitted requests
router.get('/my-requests', verifyToken, getMyRequests);

module.exports = router;
