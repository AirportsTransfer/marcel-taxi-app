const express = require('express');
const {
  createPayment,
  getPayment,
  updatePaymentStatus,
  getPaymentMethods,
  getUserPayments
} = require('../controllers/paymentController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/methods', getPaymentMethods);

// Customer routes
router.post('/rides/:rideId', auth, requireRole(['customer']), createPayment);
router.get('/', auth, getUserPayments);
router.get('/:paymentId', auth, getPayment);
router.put('/:paymentId/status', auth, updatePaymentStatus);

module.exports = router;