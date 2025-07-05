const express = require('express');
const {
  sendTestNotification,
  sendRideConfirmation,
  sendDriverAssignment,
  sendRideStatusUpdate,
  sendRideModification,
  sendNoShowNotification,
  sendDriverNotification,
  getNotificationHistory
} = require('../controllers/notificationController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Test notification (Admin only)
router.post('/test', auth, requireRole(['admin']), sendTestNotification);

// Ride notifications
router.post('/rides/:rideId/confirmation', auth, requireRole(['admin', 'dispatcher']), sendRideConfirmation);
router.post('/rides/:rideId/assignment', auth, requireRole(['admin', 'dispatcher']), sendDriverAssignment);
router.post('/rides/:rideId/status', auth, requireRole(['admin', 'dispatcher', 'driver']), sendRideStatusUpdate);
router.post('/rides/:rideId/modification', auth, requireRole(['admin', 'dispatcher']), sendRideModification);
router.post('/rides/:rideId/no-show', auth, requireRole(['admin', 'dispatcher']), sendNoShowNotification);

// Driver notifications
router.post('/drivers/:driverId/notify', auth, requireRole(['admin', 'dispatcher']), sendDriverNotification);

// Notification history (Admin only)
router.get('/history', auth, requireRole(['admin']), getNotificationHistory);

module.exports = router;