const { v4: uuidv4 } = require('uuid');
const Ride = require('../models/Ride');
const RideModification = require('../models/RideModification');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const PricingService = require('../services/PricingService');
const db = require('../config/database');
const logger = require('../utils/logger');
const EmailService = require('../services/EmailService');
const NotificationService = require('../services/NotificationService');

// Initialize services
const notificationService = new NotificationService();

// Rate card configuration
const RATE_CARD = {
  baseFare: 2.50,
  perKm: 1.20,
  perMinute: 0.35,
  luggageFee: 2.00,
  extraStopFee: 3.00,
  bookingFee: 1.00,
  longDistanceDiscount: 0.10,
  discountAfterKm: 50
};

// Create new ride booking
const createRide = async (req, res) => {
  try {
    const {
      pickupLocation,
      dropoffLocation,
      scheduledAt,
      passengers,
      luggage,
      specialRequests,
      extraStops
    } = req.body;

    // Create new ride
    const ride = new Ride({
      customerId: req.user.id,
      pickupLocation,
      dropoffLocation,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      passengers: passengers || 1,
      luggage: luggage || 0,
      specialRequests: specialRequests || '',
      extraStops: extraStops || []
    });

    // Validate ride data
    const validationErrors = ride.validate();
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: validationErrors.join(', ')
      });
    }

    // Calculate estimated distance and duration (placeholder)
    ride.estimatedDistance = calculateDistance(pickupLocation, dropoffLocation);
    ride.estimatedDuration = calculateDuration(ride.estimatedDistance);

    // Calculate fare using pricing service
    const pricingResult = await PricingService.calculateRidePrice({
      pickupLocation,
      dropoffLocation,
      scheduledAt,
      passengers,
      luggage,
      extraStops,
      vehicleType: 'sedan',
      estimatedDistance: ride.estimatedDistance,
      estimatedDuration: ride.estimatedDuration
    });

    // Apply pricing result to ride
    ride.baseFare = pricingResult.pricing.baseFare || 0;
    ride.distanceFare = pricingResult.pricing.distanceFare || 0;
    ride.timeFare = pricingResult.pricing.timeFare || 0;
    ride.extraFees = pricingResult.pricing.extraFees || {};
    ride.totalFare = pricingResult.pricing.totalFare;

    // Save to database
    await db('rides').insert(ride.toDatabase());

    // Create modification link for customer
    const modification = new RideModification({
      rideId: ride.id,
      customerId: req.user.id,
      originalData: {
        scheduledAt: ride.scheduledAt,
        pickupLocation: ride.pickupLocation,
        dropoffLocation: ride.dropoffLocation,
        passengers: ride.passengers,
        luggage: ride.luggage,
        specialRequests: ride.specialRequests
      }
    });

    await db('ride_modifications').insert(modification.toDatabase());

    // Send confirmation email with account link
    const emailData = {
      customerName: req.user.getFullName(),
      rideId: ride.id,
      date: ride.scheduledAt ? new Date(ride.scheduledAt).toLocaleDateString('nl-NL') : 'Direct',
      time: ride.scheduledAt ? new Date(ride.scheduledAt).toLocaleTimeString('nl-NL') : 'Nu',
      pickupLocation: ride.pickupLocation.address,
      dropoffLocation: ride.dropoffLocation.address,
      price: ride.totalFare.toFixed(2),
      accountLink: `${process.env.BASE_URL || 'https://yourapp.com'}/account/rides/${ride.id}`
    };

    await EmailService.sendRideConfirmation(req.user.email, emailData);

    // Auto-assign driver if immediate booking
    if (!ride.scheduledAt || new Date(ride.scheduledAt) <= new Date(Date.now() + 30 * 60 * 1000)) {
      // Find available driver (simplified logic)
      const availableDriver = await findAvailableDriver(ride.pickupLocation);
      if (availableDriver) {
        await assignDriver(ride.id, availableDriver.id);
      }
    }

    logger.info('Ride created successfully', {
      rideId: ride.id,
      customerId: req.user.id,
      totalFare: ride.totalFare
    });

    res.status(201).json({
      success: true,
      ride: ride.toJSON(),
      modificationToken: modification.token
    });

  } catch (error) {
    logger.error('Create ride failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Rit boeken mislukt'
    });
  }
};

// Get user's rides
const getUserRides = async (req, res) => {
  try {
    const { status, limit = 10, offset = 0 } = req.query;
    
    let query = db('rides')
      .where('customer_id', req.user.id)
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    if (status) {
      query = query.where('status', status);
    }

    const rideRows = await query;
    const rides = rideRows.map(row => Ride.fromDatabase(row));

    // Get driver and vehicle info for each ride
    const ridesWithDetails = await Promise.all(rides.map(async (ride) => {
      const rideData = ride.toJSON();
      
      if (ride.driverId) {
        const driverRow = await db('users').where('id', ride.driverId).first();
        if (driverRow) {
          const driver = User.fromDatabase(driverRow);
          rideData.driver = driver.toDriverJSON();
        }
      }

      if (ride.vehicleId) {
        const vehicleRow = await db('vehicles').where('id', ride.vehicleId).first();
        if (vehicleRow) {
          const vehicle = Vehicle.fromDatabase(vehicleRow);
          rideData.vehicle = vehicle.toPublicJSON();
        }
      }

      return rideData;
    }));

    res.json({
      success: true,
      rides: ridesWithDetails,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: await db('rides').where('customer_id', req.user.id).count('* as count').first()
      }
    });

  } catch (error) {
    logger.error('Get user rides failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Ritten ophalen mislukt'
    });
  }
};

// Get single ride details
const getRide = async (req, res) => {
  try {
    const { rideId } = req.params;

    const rideRow = await db('rides').where('id', rideId).first();
    if (!rideRow) {
      return res.status(404).json({
        success: false,
        error: 'Rit niet gevonden'
      });
    }

    const ride = Ride.fromDatabase(rideRow);

    // Check if user has access to this ride
    if (req.user.role === 'customer' && ride.customerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Geen toegang tot deze rit'
      });
    }

    if (req.user.role === 'driver' && ride.driverId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Geen toegang tot deze rit'
      });
    }

    const rideData = ride.toJSON();

    // Add driver info if assigned
    if (ride.driverId) {
      const driverRow = await db('users').where('id', ride.driverId).first();
      if (driverRow) {
        const driver = User.fromDatabase(driverRow);
        rideData.driver = driver.toDriverJSON();
      }
    }

    // Add vehicle info if assigned
    if (ride.vehicleId) {
      const vehicleRow = await db('vehicles').where('id', ride.vehicleId).first();
      if (vehicleRow) {
        const vehicle = Vehicle.fromDatabase(vehicleRow);
        rideData.vehicle = vehicle.toPublicJSON();
      }
    }

    // Add customer info for drivers
    if (req.user.role === 'driver') {
      const customerRow = await db('users').where('id', ride.customerId).first();
      if (customerRow) {
        const customer = User.fromDatabase(customerRow);
        rideData.customer = customer.toPublicJSON();
      }
    }

    res.json({
      success: true,
      ride: rideData
    });

  } catch (error) {
    logger.error('Get ride failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Rit ophalen mislukt'
    });
  }
};

// Update ride (date/time only)
const updateRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { scheduledAt } = req.body;

    if (!scheduledAt) {
      return res.status(400).json({
        success: false,
        error: 'Nieuwe datum en tijd zijn verplicht'
      });
    }

    const rideRow = await db('rides').where('id', rideId).first();
    if (!rideRow) {
      return res.status(404).json({
        success: false,
        error: 'Rit niet gevonden'
      });
    }

    const ride = Ride.fromDatabase(rideRow);

    // Check if user owns this ride
    if (ride.customerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Geen toegang tot deze rit'
      });
    }

    // Check if ride can be modified (24 hours before)
    if (ride.scheduledAt) {
      const scheduledTime = new Date(ride.scheduledAt);
      const twentyFourHoursBefore = new Date(scheduledTime.getTime() - (24 * 60 * 60 * 1000));
      
      if (new Date() > twentyFourHoursBefore) {
        return res.status(400).json({
          success: false,
          error: 'Wijzigingen zijn alleen mogelijk tot 24 uur voor uw vertrektijd'
        });
      }
    }

    if (!ride.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        error: 'Deze rit kan niet meer worden gewijzigd'
      });
    }

    // Validate new scheduled time
    const newDate = new Date(scheduledAt);
    const now = new Date();
    
    if (newDate < now) {
      return res.status(400).json({
        success: false,
        error: 'Nieuwe datum/tijd kan niet in het verleden liggen'
      });
    }

    // Check minimum time requirement (2 hours from now)
    const minimumTime = new Date(now.getTime() + (2 * 60 * 60 * 1000));
    if (newDate < minimumTime) {
      return res.status(400).json({
        success: false,
        error: 'Nieuwe tijd moet minimaal 2 uur in de toekomst liggen'
      });
    }

    // Update ride
    const oldScheduledAt = ride.scheduledAt;
    ride.scheduledAt = newDate;
    ride.updatedAt = new Date();

    await db('rides').where('id', rideId).update({
      scheduled_at: ride.scheduledAt,
      updated_at: ride.updatedAt
    });

    logger.info('Ride updated', {
      rideId: ride.id,
      customerId: req.user.id,
      oldDateTime: oldScheduledAt,
      newDateTime: newDate
    });

    res.json({
      success: true,
      message: 'Rit succesvol bijgewerkt',
      ride: ride.toJSON(),
      changes: {
        oldDateTime: oldScheduledAt,
        newDateTime: newDate
      }
    });

  } catch (error) {
    logger.error('Update ride failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Rit bijwerken mislukt'
    });
  }
};

// Cancel ride
const cancelRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { reason } = req.body;

    const rideRow = await db('rides').where('id', rideId).first();
    if (!rideRow) {
      return res.status(404).json({
        success: false,
        error: 'Rit niet gevonden'
      });
    }

    const ride = Ride.fromDatabase(rideRow);

    // Check if user can cancel this ride
    if (req.user.role === 'customer' && ride.customerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Geen toegang tot deze rit'
      });
    }

    if (!ride.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        error: 'Deze rit kan niet meer worden geannuleerd'
      });
    }

    // Check 24 hour cancellation policy
    let cancellationFee = 0;
    if (ride.scheduledAt) {
      const scheduledTime = new Date(ride.scheduledAt);
      const twentyFourHoursBefore = new Date(scheduledTime.getTime() - (24 * 60 * 60 * 1000));
      
      if (new Date() > twentyFourHoursBefore) {
        // Late cancellation - charge full amount
        cancellationFee = ride.totalFare;
      }
    }

    // Update ride status
    ride.updateStatus('cancelled', reason || 'Geannuleerd door klant');

    await db('rides').where('id', rideId).update({
      status: ride.status,
      cancelled_at: ride.cancelledAt,
      cancel_reason: ride.cancelReason,
      updated_at: ride.updatedAt
    });

    logger.info('Ride cancelled', {
      rideId: ride.id,
      customerId: req.user.id,
      reason: reason,
      cancellationFee: cancellationFee
    });

    const message = cancellationFee > 0 
      ? `Rit geannuleerd. Vanwege late annulering wordt €${cancellationFee.toFixed(2)} in rekening gebracht.`
      : 'Rit succesvol geannuleerd';

    res.json({
      success: true,
      message: message,
      ride: ride.toJSON(),
      cancellationFee: cancellationFee,
      isLateCancellation: cancellationFee > 0
    });

  } catch (error) {
    logger.error('Cancel ride failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Rit annuleren mislukt'
    });
  }
};

// Rate completed ride
const rateRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { rating, feedback } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Beoordeling moet tussen 1 en 5 sterren zijn'
      });
    }

    const rideRow = await db('rides').where('id', rideId).first();
    if (!rideRow) {
      return res.status(404).json({
        success: false,
        error: 'Rit niet gevonden'
      });
    }

    const ride = Ride.fromDatabase(rideRow);

    // Check if user can rate this ride
    if (ride.customerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Geen toegang tot deze rit'
      });
    }

    if (!ride.canBeRated()) {
      return res.status(400).json({
        success: false,
        error: 'Deze rit kan niet worden beoordeeld'
      });
    }

    // Update ride rating
    ride.rating = rating;
    ride.feedback = feedback || '';
    ride.updatedAt = new Date();

    await db('rides').where('id', rideId).update({
      rating: ride.rating,
      feedback: ride.feedback,
      updated_at: ride.updatedAt
    });

    logger.info('Ride rated', {
      rideId: ride.id,
      customerId: req.user.id,
      rating: rating
    });

    res.json({
      success: true,
      message: 'Rit succesvol beoordeeld',
      ride: ride.toJSON()
    });

  } catch (error) {
    logger.error('Rate ride failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Rit beoordelen mislukt'
    });
  }
};

// Utility functions
const calculateDistance = (pickup, dropoff) => {
  // Simplified distance calculation (in real app, use Google Maps API)
  const lat1 = pickup.latitude;
  const lon1 = pickup.longitude;
  const lat2 = dropoff.latitude;
  const lon2 = dropoff.longitude;

  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimals
};

const calculateDuration = (distance) => {
  // Simplified duration calculation (assume 30 km/h average in city)
  return Math.ceil(distance / 30 * 60); // minutes
};

const findAvailableDriver = async (pickupLocation) => {
  // Simplified driver assignment (in real app, use geolocation and availability)
  const driverRow = await db('users')
    .where('role', 'driver')
    .where('is_active', true)
    .first();

  return driverRow ? User.fromDatabase(driverRow) : null;
};

const assignDriver = async (rideId, driverId) => {
  // Find driver's vehicle
  const vehicleRow = await db('vehicles').where('driver_id', driverId).where('is_active', true).first();
  
  const updateData = {
    driver_id: driverId,
    status: 'assigned',
    updated_at: new Date()
  };

  if (vehicleRow) {
    updateData.vehicle_id = vehicleRow.id;
  }

  await db('rides').where('id', rideId).update(updateData);

  // Send notification to driver
  const driverRow = await db('users').where('id', driverId).first();
  const rideRow = await db('rides').where('id', rideId).first();
  
  if (driverRow && rideRow) {
    const driver = User.fromDatabase(driverRow);
    const ride = Ride.fromDatabase(rideRow);
    
    const emailData = {
      driverName: driver.getFullName(),
      rideId: ride.id,
      customerName: 'Klant', // Would get from customer table
      date: ride.scheduledAt ? new Date(ride.scheduledAt).toLocaleDateString('nl-NL') : 'Direct',
      time: ride.scheduledAt ? new Date(ride.scheduledAt).toLocaleTimeString('nl-NL') : 'Nu',
      pickupLocation: ride.pickupLocation.address,
      dropoffLocation: ride.dropoffLocation.address,
      distance: ride.estimatedDistance,
      estimatedTime: ride.estimatedDuration
    };

    await EmailService.sendDriverAssignment(driver.email, emailData);
  }

  logger.info('Driver assigned to ride', { rideId, driverId });
};

module.exports = {
  createRide,
  getUserRides,
  getRide,
  updateRide,
  cancelRide,
  rateRide
};