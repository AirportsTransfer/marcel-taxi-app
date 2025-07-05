const express = require('express');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Placeholder routes - will be implemented later
router.get('/', auth, requireRole(['admin', 'driver']), (req, res) => {
  res.json({ message: 'Drivers route - coming soon' });
});

module.exports = router;