const CompanyPartnership = require('../models/CompanyPartnership');
const RideShare = require('../models/RideShare');
const Ride = require('../models/Ride');
const db = require('../config/database');
const logger = require('../utils/logger');

// Create partnership request
const createPartnership = async (req, res) => {
  try {
    const {
      targetCompanyId,
      partnershipType,
      commissionRate,
      allowedServices,
      coverageAreas,
      maxRidesPerDay,
      maxRidesPerMonth,
      autoAcceptRides,
      notes
    } = req.body;

    // For now, we'll use a default company ID - in real app this would come from user's company
    const requestingCompanyId = req.user.companyId || 'default-company-id';

    if (!targetCompanyId) {
      return res.status(400).json({
        success: false,
        error: 'Doel bedrijf ID is verplicht'
      });
    }

    // Check if partnership already exists
    const existingPartnership = await db('company_partnerships')
      .where(function() {
        this.where('requesting_company_id', requestingCompanyId)
            .where('target_company_id', targetCompanyId);
      })
      .orWhere(function() {
        this.where('requesting_company_id', targetCompanyId)
            .where('target_company_id', requestingCompanyId);
      })
      .first();

    if (existingPartnership) {
      return res.status(400).json({
        success: false,
        error: 'Er bestaat al een partnerschap tussen deze bedrijven'
      });
    }

    const partnership = new CompanyPartnership({
      requestingCompanyId,
      targetCompanyId,
      partnershipType: partnershipType || 'bidirectional',
      commissionRate: commissionRate || 0.10,
      allowedServices: allowedServices || ['ride_sharing'],
      coverageAreas: coverageAreas || [],
      maxRidesPerDay,
      maxRidesPerMonth,
      autoAcceptRides: autoAcceptRides || false,
      notes: notes || ''
    });

    const validationErrors = partnership.validate();
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: validationErrors.join(', ')
      });
    }

    await db('company_partnerships').insert(partnership.toDatabase());

    logger.info('Partnership created', {
      partnershipId: partnership.id,
      requestingCompanyId,
      targetCompanyId
    });

    res.status(201).json({
      success: true,
      partnership: partnership.toJSON(),
      message: 'Partnerschap aanvraag succesvol verzonden'
    });

  } catch (error) {
    logger.error('Create partnership failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Partnerschap aanmaken mislukt'
    });
  }
};

// Get company partnerships
const getPartnerships = async (req, res) => {
  try {
    const companyId = req.user.companyId || 'default-company-id';
    const { status, type } = req.query;

    let query = db('company_partnerships')
      .where('requesting_company_id', companyId)
      .orWhere('target_company_id', companyId)
      .orderBy('created_at', 'desc');

    if (status) {
      query = query.where('status', status);
    }

    if (type) {
      query = query.where('partnership_type', type);
    }

    const partnershipRows = await query;
    const partnerships = partnershipRows.map(row => CompanyPartnership.fromDatabase(row));

    res.json({
      success: true,
      partnerships: partnerships.map(p => p.toJSON())
    });

  } catch (error) {
    logger.error('Get partnerships failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Partnerschappen ophalen mislukt'
    });
  }
};

// Accept/reject partnership
const updatePartnershipStatus = async (req, res) => {
  try {
    const { partnershipId } = req.params;
    const { action, reason } = req.body; // accept, reject, suspend
    const companyId = req.user.companyId || 'default-company-id';

    const partnershipRow = await db('company_partnerships').where('id', partnershipId).first();
    if (!partnershipRow) {
      return res.status(404).json({
        success: false,
        error: 'Partnerschap niet gevonden'
      });
    }

    const partnership = CompanyPartnership.fromDatabase(partnershipRow);

    // Check if user's company is the target company (for accept/reject)
    if (partnership.targetCompanyId !== companyId && action !== 'suspend') {
      return res.status(403).json({
        success: false,
        error: 'Alleen het doel bedrijf kan deze actie uitvoeren'
      });
    }

    // Check if user's company is involved (for suspend)
    if (action === 'suspend' && 
        partnership.requestingCompanyId !== companyId && 
        partnership.targetCompanyId !== companyId) {
      return res.status(403).json({
        success: false,
        error: 'Geen toegang tot dit partnerschap'
      });
    }

    let message = '';
    switch (action) {
      case 'accept':
        partnership.accept();
        message = 'Partnerschap geaccepteerd';
        break;
      case 'reject':
        partnership.reject();
        message = 'Partnerschap afgewezen';
        break;
      case 'suspend':
        partnership.suspend(reason || 'Partnerschap geschorst');
        message = 'Partnerschap geschorst';
        break;
      case 'reactivate':
        partnership.reactivate();
        message = 'Partnerschap gereactiveerd';
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Ongeldige actie'
        });
    }

    await db('company_partnerships').where('id', partnershipId).update(partnership.toDatabase());

    logger.info('Partnership status updated', {
      partnershipId,
      action,
      newStatus: partnership.status
    });

    res.json({
      success: true,
      partnership: partnership.toJSON(),
      message
    });

  } catch (error) {
    logger.error('Update partnership status failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Partnerschap status bijwerken mislukt'
    });
  }
};

// Share ride with partners
const shareRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { offerPrice, targetCompanyId, expiresInMinutes } = req.body;
    const sourceCompanyId = req.user.companyId || 'default-company-id';

    // Get original ride
    const rideRow = await db('rides').where('id', rideId).first();
    if (!rideRow) {
      return res.status(404).json({
        success: false,
        error: 'Rit niet gevonden'
      });
    }

    const ride = Ride.fromDatabase(rideRow);

    // Find active partnership
    const partnershipRow = await db('company_partnerships')
      .where(function() {
        this.where('requesting_company_id', sourceCompanyId)
            .where('target_company_id', targetCompanyId);
      })
      .orWhere(function() {
        this.where('requesting_company_id', targetCompanyId)
            .where('target_company_id', sourceCompanyId);
      })
      .where('status', 'accepted')
      .first();

    if (!partnershipRow) {
      return res.status(400).json({
        success: false,
        error: 'Geen actief partnerschap gevonden met dit bedrijf'
      });
    }

    const partnership = CompanyPartnership.fromDatabase(partnershipRow);

    // Check if partnership allows this ride
    if (!partnership.allowsRideFrom(sourceCompanyId, targetCompanyId)) {
      return res.status(400).json({
        success: false,
        error: 'Partnerschap staat deze richting niet toe'
      });
    }

    // Check coverage area
    if (!partnership.coversArea(ride.pickupLocation)) {
      return res.status(400).json({
        success: false,
        error: 'Rit valt buiten het dekkingsgebied van het partnerschap'
      });
    }

    // Create ride share
    const rideShare = new RideShare({
      originalRideId: rideId,
      sourceCompanyId,
      targetCompanyId,
      partnershipId: partnership.id,
      offerPrice: offerPrice || ride.totalFare
    });

    if (expiresInMinutes) {
      const expiry = new Date();
      expiry.setMinutes(expiry.getMinutes() + expiresInMinutes);
      rideShare.expiresAt = expiry;
    }

    rideShare.setRideData(ride);
    rideShare.calculateCommission(partnership.commissionRate);

    const validationErrors = rideShare.validate();
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: validationErrors.join(', ')
      });
    }

    await db('ride_shares').insert(rideShare.toDatabase());

    logger.info('Ride shared', {
      rideShareId: rideShare.id,
      originalRideId: rideId,
      sourceCompanyId,
      targetCompanyId,
      offerPrice: rideShare.offerPrice
    });

    res.status(201).json({
      success: true,
      rideShare: rideShare.toJSON(),
      message: 'Rit succesvol gedeeld met partner'
    });

  } catch (error) {
    logger.error('Share ride failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Rit delen mislukt'
    });
  }
};

// Get incoming ride offers
const getIncomingRideOffers = async (req, res) => {
  try {
    const targetCompanyId = req.user.companyId || 'default-company-id';
    const { status = 'offered' } = req.query;

    const rideShareRows = await db('ride_shares')
      .where('target_company_id', targetCompanyId)
      .where('status', status)
      .orderBy('created_at', 'desc');

    const rideShares = rideShareRows.map(row => RideShare.fromDatabase(row));

    res.json({
      success: true,
      rideOffers: rideShares.map(rs => rs.toPartnerJSON())
    });

  } catch (error) {
    logger.error('Get incoming ride offers failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Rit aanbiedingen ophalen mislukt'
    });
  }
};

// Accept/reject ride offer
const respondToRideOffer = async (req, res) => {
  try {
    const { rideShareId } = req.params;
    const { action, acceptedPrice, driverId, vehicleId, reason } = req.body;
    const companyId = req.user.companyId || 'default-company-id';

    const rideShareRow = await db('ride_shares').where('id', rideShareId).first();
    if (!rideShareRow) {
      return res.status(404).json({
        success: false,
        error: 'Rit aanbieding niet gevonden'
      });
    }

    const rideShare = RideShare.fromDatabase(rideShareRow);

    if (rideShare.targetCompanyId !== companyId) {
      return res.status(403).json({
        success: false,
        error: 'Geen toegang tot deze rit aanbieding'
      });
    }

    let message = '';
    if (action === 'accept') {
      if (!rideShare.canBeAccepted()) {
        return res.status(400).json({
          success: false,
          error: 'Deze rit aanbieding kan niet meer worden geaccepteerd'
        });
      }

      rideShare.accept(acceptedPrice || rideShare.offerPrice, driverId, vehicleId);
      message = 'Rit aanbieding geaccepteerd';

      // Update original ride status
      await db('rides').where('id', rideShare.originalRideId).update({
        status: 'assigned',
        driver_id: driverId,
        vehicle_id: vehicleId,
        updated_at: new Date()
      });

    } else if (action === 'reject') {
      rideShare.reject(reason || 'Afgewezen door partner');
      message = 'Rit aanbieding afgewezen';
    } else {
      return res.status(400).json({
        success: false,
        error: 'Ongeldige actie'
      });
    }

    await db('ride_shares').where('id', rideShareId).update(rideShare.toDatabase());

    logger.info('Ride offer response', {
      rideShareId,
      action,
      responseTime: rideShare.responseTime
    });

    res.json({
      success: true,
      rideShare: rideShare.toJSON(),
      message
    });

  } catch (error) {
    logger.error('Respond to ride offer failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Reageren op rit aanbieding mislukt'
    });
  }
};

// Get ride sharing statistics
const getRideSharingStats = async (req, res) => {
  try {
    const companyId = req.user.companyId || 'default-company-id';
    const { period = '30' } = req.query; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Outgoing rides (shared with partners)
    const outgoingStats = await db('ride_shares')
      .where('source_company_id', companyId)
      .where('created_at', '>=', startDate)
      .select('status')
      .count('* as count')
      .groupBy('status');

    // Incoming rides (received from partners)
    const incomingStats = await db('ride_shares')
      .where('target_company_id', companyId)
      .where('created_at', '>=', startDate)
      .select('status')
      .count('* as count')
      .groupBy('status');

    // Revenue from completed rides
    const revenueData = await db('ride_shares')
      .where('target_company_id', companyId)
      .where('status', 'completed')
      .where('created_at', '>=', startDate)
      .sum('accepted_price as total_revenue')
      .sum('commission_amount as total_commission')
      .first();

    res.json({
      success: true,
      statistics: {
        period: `${period} dagen`,
        outgoing: outgoingStats,
        incoming: incomingStats,
        revenue: {
          totalRevenue: parseFloat(revenueData.total_revenue) || 0,
          totalCommission: parseFloat(revenueData.total_commission) || 0,
          netRevenue: (parseFloat(revenueData.total_revenue) || 0) - (parseFloat(revenueData.total_commission) || 0)
        }
      }
    });

  } catch (error) {
    logger.error('Get ride sharing stats failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Statistieken ophalen mislukt'
    });
  }
};

module.exports = {
  createPartnership,
  getPartnerships,
  updatePartnershipStatus,
  shareRide,
  getIncomingRideOffers,
  respondToRideOffer,
  getRideSharingStats
};