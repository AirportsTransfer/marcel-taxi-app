const express = require('express');
const {
  getDashboardStats,
  getRides,
  getUsers,
  getFinancialReport,
  updateUserStatus,
  getSystemLogs
} = require('../controllers/adminController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Dashboard statistics
router.get('/dashboard/stats', auth, requireRole(['admin']), getDashboardStats);

// Ride management
router.get('/rides', auth, requireRole(['admin']), getRides);

// User management
router.get('/users', auth, requireRole(['admin']), getUsers);
router.put('/users/:userId/status', auth, requireRole(['admin']), updateUserStatus);

// Financial reports
router.get('/reports/financial', auth, requireRole(['admin']), getFinancialReport);

// System logs
router.get('/logs', auth, requireRole(['admin']), getSystemLogs);

module.exports = router;