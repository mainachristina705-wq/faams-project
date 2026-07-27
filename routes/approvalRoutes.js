const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middleware/auth');
const {
  getAccountantQueue,
  getDirectorQueue,
  accountantReview,
  directorReview,
} = require('../controllers/approvalController');

router.get('/accountant-queue', verifyToken, verifyRole('treasury_accountant'), getAccountantQueue);
router.get('/director-queue', verifyToken, verifyRole('director_of_budget'), getDirectorQueue);

router.post('/:id/accountant-review', verifyToken, verifyRole('treasury_accountant'), accountantReview);
router.post('/:id/director-review', verifyToken, verifyRole('director_of_budget'), directorReview);

module.exports = router;
