const express = require('express');
const {
  createPartnership,
  getPartnerships,
  updatePartnershipStatus,
  shareRide,
  getIncomingRideOffers,
  respondToRideOffer,
  getRideSharingStats
} = require('../controllers/partnershipController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Partnership management (Admin only)
router.post('/', auth, requireRole(['admin']), createPartnership);
router.get('/', auth, requireRole(['admin']), getPartnerships);
router.put('/:partnershipId/status', auth, requireRole(['admin']), updatePartnershipStatus);

// Ride sharing (Admin and dispatchers)
router.post('/rides/:rideId/share', auth, requireRole(['admin', 'dispatcher']), shareRide);
router.get('/ride-offers', auth, requireRole(['admin', 'dispatcher']), getIncomingRideOffers);
router.put('/ride-offers/:rideShareId/respond', auth, requireRole(['admin', 'dispatcher']), respondToRideOffer);

// Statistics
router.get('/stats', auth, requireRole(['admin']), getRideSharingStats);

module.exports = router;