const express = require('express');

const router = express.Router();

// Placeholder routes - will be implemented later
router.post('/stripe', (req, res) => {
  res.json({ message: 'Stripe webhook - coming soon' });
});

router.post('/mollie', (req, res) => {
  res.json({ message: 'Mollie webhook - coming soon' });
});

module.exports = router;