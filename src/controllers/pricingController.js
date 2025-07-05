const PricingRule = require('../models/PricingRule');
const PricingService = require('../services/PricingService');
const db = require('../config/database');
const logger = require('../utils/logger');

// Get price estimate for route
const getPriceEstimate = async (req, res) => {
  try {
    const { fromLocation, toLocation, scheduledAt, vehicleType, passengers, luggage, extraStops } = req.body;

    if (!fromLocation || !toLocation) {
      return res.status(400).json({
        success: false,
        error: 'Van en naar locatie zijn verplicht'
      });
    }

    const estimate = await PricingService.getPriceEstimate(fromLocation, toLocation, {
      scheduledAt,
      vehicleType,
      passengers,
      luggage,
      extraStops
    });

    res.json(estimate);

  } catch (error) {
    logger.error('Get price estimate failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Prijsschatting ophalen mislukt'
    });
  }
};

// Create new pricing rule (Admin only)
const createPricingRule = async (req, res) => {
  try {
    const {
      name,
      type,
      fromLocation,
      toLocation,
      fixedPrice,
      priority,
      validFrom,
      validUntil,
      dayOfWeek,
      timeFrom,
      timeUntil,
      vehicleTypes,
      minimumDistance,
      maximumDistance,
      notes
    } = req.body;

    const pricingRule = new PricingRule({
      name,
      type,
      fromLocation,
      toLocation,
      fixedPrice,
      priority,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      dayOfWeek: dayOfWeek || [],
      timeFrom,
      timeUntil,
      vehicleTypes: vehicleTypes || [],
      minimumDistance: minimumDistance || 0,
      maximumDistance: maximumDistance || 999,
      notes: notes || ''
    });

    // Validate pricing rule
    const validationErrors = pricingRule.validate();
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: validationErrors.join(', ')
      });
    }

    // Save to database
    await db('pricing_rules').insert(pricingRule.toDatabase());

    logger.info('Pricing rule created', {
      ruleId: pricingRule.id,
      name: pricingRule.name,
      type: pricingRule.type,
      fixedPrice: pricingRule.fixedPrice
    });

    res.status(201).json({
      success: true,
      pricingRule: pricingRule.toJSON(),
      message: 'Prijsregel succesvol aangemaakt'
    });

  } catch (error) {
    logger.error('Create pricing rule failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Prijsregel aanmaken mislukt'
    });
  }
};

// Get all pricing rules (Admin only)
const getPricingRules = async (req, res) => {
  try {
    const { type, isActive, limit = 50, offset = 0 } = req.query;

    let query = db('pricing_rules').orderBy('priority', 'desc').orderBy('created_at', 'desc');

    if (type) {
      query = query.where('type', type);
    }

    if (isActive !== undefined) {
      query = query.where('is_active', isActive === 'true');
    }

    const rules = await query.limit(parseInt(limit)).offset(parseInt(offset));
    const total = await db('pricing_rules').count('* as count').first();

    const pricingRules = rules.map(row => PricingRule.fromDatabase(row));

    res.json({
      success: true,
      pricingRules: pricingRules.map(rule => rule.toJSON()),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: parseInt(total.count)
      }
    });

  } catch (error) {
    logger.error('Get pricing rules failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Prijsregels ophalen mislukt'
    });
  }
};

// Get single pricing rule (Admin only)
const getPricingRule = async (req, res) => {
  try {
    const { ruleId } = req.params;

    const ruleRow = await db('pricing_rules').where('id', ruleId).first();
    if (!ruleRow) {
      return res.status(404).json({
        success: false,
        error: 'Prijsregel niet gevonden'
      });
    }

    const pricingRule = PricingRule.fromDatabase(ruleRow);

    res.json({
      success: true,
      pricingRule: pricingRule.toJSON()
    });

  } catch (error) {
    logger.error('Get pricing rule failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Prijsregel ophalen mislukt'
    });
  }
};

// Update pricing rule (Admin only)
const updatePricingRule = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const updateData = req.body;

    const ruleRow = await db('pricing_rules').where('id', ruleId).first();
    if (!ruleRow) {
      return res.status(404).json({
        success: false,
        error: 'Prijsregel niet gevonden'
      });
    }

    const pricingRule = PricingRule.fromDatabase(ruleRow);

    // Update fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        switch (key) {
          case 'name':
            pricingRule.name = updateData[key];
            break;
          case 'type':
            pricingRule.type = updateData[key];
            break;
          case 'fromLocation':
            pricingRule.fromLocation = updateData[key];
            break;
          case 'toLocation':
            pricingRule.toLocation = updateData[key];
            break;
          case 'fixedPrice':
            pricingRule.fixedPrice = updateData[key];
            break;
          case 'priority':
            pricingRule.priority = updateData[key];
            break;
          case 'isActive':
            pricingRule.isActive = updateData[key];
            break;
          case 'validFrom':
            pricingRule.validFrom = updateData[key] ? new Date(updateData[key]) : null;
            break;
          case 'validUntil':
            pricingRule.validUntil = updateData[key] ? new Date(updateData[key]) : null;
            break;
          case 'dayOfWeek':
            pricingRule.dayOfWeek = updateData[key];
            break;
          case 'timeFrom':
            pricingRule.timeFrom = updateData[key];
            break;
          case 'timeUntil':
            pricingRule.timeUntil = updateData[key];
            break;
          case 'vehicleTypes':
            pricingRule.vehicleTypes = updateData[key];
            break;
          case 'minimumDistance':
            pricingRule.minimumDistance = updateData[key];
            break;
          case 'maximumDistance':
            pricingRule.maximumDistance = updateData[key];
            break;
          case 'notes':
            pricingRule.notes = updateData[key];
            break;
        }
      }
    });

    pricingRule.updatedAt = new Date();

    // Validate updated rule
    const validationErrors = pricingRule.validate();
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: validationErrors.join(', ')
      });
    }

    // Update in database
    await db('pricing_rules').where('id', ruleId).update(pricingRule.toDatabase());

    logger.info('Pricing rule updated', {
      ruleId: pricingRule.id,
      updatedFields: Object.keys(updateData)
    });

    res.json({
      success: true,
      pricingRule: pricingRule.toJSON(),
      message: 'Prijsregel succesvol bijgewerkt'
    });

  } catch (error) {
    logger.error('Update pricing rule failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Prijsregel bijwerken mislukt'
    });
  }
};

// Delete pricing rule (Admin only)
const deletePricingRule = async (req, res) => {
  try {
    const { ruleId } = req.params;

    const ruleRow = await db('pricing_rules').where('id', ruleId).first();
    if (!ruleRow) {
      return res.status(404).json({
        success: false,
        error: 'Prijsregel niet gevonden'
      });
    }

    await db('pricing_rules').where('id', ruleId).del();

    logger.info('Pricing rule deleted', { ruleId });

    res.json({
      success: true,
      message: 'Prijsregel succesvol verwijderd'
    });

  } catch (error) {
    logger.error('Delete pricing rule failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Prijsregel verwijderen mislukt'
    });
  }
};

// Test pricing rule against route
const testPricingRule = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { fromLocation, toLocation, scheduledAt, vehicleType, estimatedDistance } = req.body;

    const ruleRow = await db('pricing_rules').where('id', ruleId).first();
    if (!ruleRow) {
      return res.status(404).json({
        success: false,
        error: 'Prijsregel niet gevonden'
      });
    }

    const pricingRule = PricingRule.fromDatabase(ruleRow);

    const routeData = {
      fromLocation,
      toLocation,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
      vehicleType: vehicleType || 'sedan',
      estimatedDistance: estimatedDistance || 0
    };

    const matches = pricingRule.matchesRoute(fromLocation, toLocation) &&
                   pricingRule.isValidAtTime(routeData.scheduledAt) &&
                   pricingRule.isValidForVehicle(routeData.vehicleType) &&
                   pricingRule.isValidForDistance(routeData.estimatedDistance);

    res.json({
      success: true,
      matches: matches,
      rule: pricingRule.toJSON(),
      testDetails: {
        routeMatch: pricingRule.matchesRoute(fromLocation, toLocation),
        timeValid: pricingRule.isValidAtTime(routeData.scheduledAt),
        vehicleValid: pricingRule.isValidForVehicle(routeData.vehicleType),
        distanceValid: pricingRule.isValidForDistance(routeData.estimatedDistance)
      }
    });

  } catch (error) {
    logger.error('Test pricing rule failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Prijsregel testen mislukt'
    });
  }
};

module.exports = {
  getPriceEstimate,
  createPricingRule,
  getPricingRules,
  getPricingRule,
  updatePricingRule,
  deletePricingRule,
  testPricingRule
};