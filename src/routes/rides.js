const express = require('express');
const { 
  createRide, 
  getUserRides, 
  getRide, 
  updateRide,
  cancelRide, 
  rateRide 
} = require('../controllers/rideController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Customer routes
router.post('/', auth, requireRole(['customer']), createRide);
router.get('/', auth, getUserRides);
router.get('/:rideId', auth, getRide);
router.put('/:rideId', auth, requireRole(['customer']), updateRide);
router.put('/:rideId/cancel', auth, cancelRide);
router.put('/:rideId/rate', auth, requireRole(['customer']), rateRide);

module.exports = router;