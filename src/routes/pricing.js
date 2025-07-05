const express = require('express');
const {
  getPriceEstimate,
  createPricingRule,
  getPricingRules,
  getPricingRule,
  updatePricingRule,
  deletePricingRule,
  testPricingRule
} = require('../controllers/pricingController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/estimate', getPriceEstimate);

// Admin only routes
router.post('/rules', auth, requireRole(['admin']), createPricingRule);
router.get('/rules', auth, requireRole(['admin']), getPricingRules);
router.get('/rules/:ruleId', auth, requireRole(['admin']), getPricingRule);
router.put('/rules/:ruleId', auth, requireRole(['admin']), updatePricingRule);
router.delete('/rules/:ruleId', auth, requireRole(['admin']), deletePricingRule);
router.post('/rules/:ruleId/test', auth, requireRole(['admin']), testPricingRule);

module.exports = router;