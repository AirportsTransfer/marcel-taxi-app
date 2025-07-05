const express = require('express');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Placeholder routes - will be implemented later
router.get('/', auth, requireRole(['admin']), (req, res) => {
  res.json({ message: 'Companies route - coming soon' });
});

module.exports = router;