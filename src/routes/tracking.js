const express = require('express');
const {
  updateLocation,
  updateStatus,
  getDriverLocation,
  getLocationHistory,
  getNearbyDrivers,
  getDriversInArea,
  getTrackingStats,
  startRideTracking,
  stopRideTracking
} = require('../controllers/trackingController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Driver routes
router.post('/location', auth, requireRole(['driver']), updateLocation);
router.post('/status', auth, requireRole(['driver']), updateStatus);
router.get('/drivers/:driverId/location', auth, getDriverLocation);
router.get('/drivers/:driverId/history', auth, requireRole(['admin', 'driver']), getLocationHistory);

// Customer routes
router.get('/nearby', auth, getNearbyDrivers);
router.post('/rides/:rideId/start', auth, requireRole(['customer']), startRideTracking);
router.delete('/rides/:rideId/stop', auth, stopRideTracking);

// Admin routes
router.post('/drivers/area', auth, requireRole(['admin']), getDriversInArea);
router.get('/stats', auth, requireRole(['admin']), getTrackingStats);

module.exports = router;