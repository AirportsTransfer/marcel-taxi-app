const DriverLocation = require('../models/DriverLocation');
const TrackingService = require('../services/TrackingService');
const db = require('../config/database');
const logger = require('../utils/logger');

// Update driver location (Driver app)
const updateLocation = async (req, res) => {
  try {
    const driverId = req.user.id;
    const {
      latitude,
      longitude,
      accuracy,
      altitude,
      speed,
      heading,
      address,
      batteryLevel,
      isGpsEnabled
    } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Latitude en longitude zijn verplicht'
      });
    }

    // Get tracking service instance from app
    const trackingService = req.app.get('trackingService');
    
    const locationData = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      accuracy: accuracy || 0,
      altitude: altitude || null,
      speed: speed || 0,
      heading: heading || null,
      address: address || '',
      batteryLevel: batteryLevel || null,
      isGpsEnabled: isGpsEnabled !== undefined ? isGpsEnabled : true
    };

    // Handle location update through tracking service
    await trackingService.handleLocationUpdate(driverId, locationData);

    res.json({
      success: true,
      message: 'Locatie succesvol bijgewerkt',
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Update location failed', {
      driverId: req.user.id,
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: 'Locatie bijwerken mislukt'
    });
  }
};

// Update driver status (Driver app)
const updateStatus = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { status, rideId } = req.body;

    if (!['available', 'busy', 'break', 'offline'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Ongeldige status'
      });
    }

    // Get tracking service instance
    const trackingService = req.app.get('trackingService');

    const statusData = { status, rideId };
    await trackingService.handleStatusUpdate(driverId, statusData);

    res.json({
      success: true,
      message: 'Status succesvol bijgewerkt',
      status: status
    });

  } catch (error) {
    logger.error('Update status failed', {
      driverId: req.user.id,
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: 'Status bijwerken mislukt'
    });
  }
};

// Get driver's current location
const getDriverLocation = async (req, res) => {
  try {
    const { driverId } = req.params;

    // Check permissions
    if (req.user.role === 'driver' && req.user.id !== driverId) {
      return res.status(403).json({
        success: false,
        error: 'Geen toegang tot deze chauffeur locatie'
      });
    }

    const locationRow = await db('driver_locations').where('driver_id', driverId).first();
    if (!locationRow) {
      return res.status(404).json({
        success: false,
        error: 'Locatie niet gevonden'
      });
    }

    const location = DriverLocation.fromDatabase(locationRow);

    // Return appropriate data based on user role
    const responseData = req.user.role === 'customer' ? 
      location.toPublicJSON() : 
      location.toJSON();

    res.json({
      success: true,
      location: responseData
    });

  } catch (error) {
    logger.error('Get driver location failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Locatie ophalen mislukt'
    });
  }
};

// Get location history for driver
const getLocationHistory = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { limit = 20 } = req.query;

    // Check permissions
    if (req.user.role === 'driver' && req.user.id !== driverId) {
      return res.status(403).json({
        success: false,
        error: 'Geen toegang tot deze gegevens'
      });
    }

    if (!['admin', 'driver'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Onvoldoende rechten'
      });
    }

    const trackingService = req.app.get('trackingService');
    const history = trackingService.getLocationHistory(driverId, parseInt(limit));

    res.json({
      success: true,
      history: history,
      driverId: driverId
    });

  } catch (error) {
    logger.error('Get location history failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Locatie geschiedenis ophalen mislukt'
    });
  }
};

// Get nearby drivers
const getNearbyDrivers = async (req, res) => {
  try {
    const { latitude, longitude, radius = 5, status = 'available' } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Latitude en longitude zijn verplicht'
      });
    }

    const trackingService = req.app.get('trackingService');
    const nearbyDrivers = await trackingService.getNearbyDrivers(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius),
      status
    );

    // Return public data for customers, full data for admins
    const responseData = nearbyDrivers.map(driver => {
      return req.user.role === 'customer' ? 
        driver.toPublicJSON() : 
        driver.toJSON();
    });

    res.json({
      success: true,
      drivers: responseData,
      searchRadius: parseFloat(radius),
      center: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      }
    });

  } catch (error) {
    logger.error('Get nearby drivers failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Chauffeurs in de buurt ophalen mislukt'
    });
  }
};

// Get drivers in area (Admin only)
const getDriversInArea = async (req, res) => {
  try {
    const { northEast, southWest } = req.body;

    if (!northEast || !southWest || !northEast.latitude || !northEast.longitude || 
        !southWest.latitude || !southWest.longitude) {
      return res.status(400).json({
        success: false,
        error: 'Ongeldige gebied grenzen'
      });
    }

    const trackingService = req.app.get('trackingService');
    const drivers = await trackingService.getDriversInArea({ northEast, southWest });

    res.json({
      success: true,
      drivers: drivers.map(driver => driver.toJSON()),
      bounds: { northEast, southWest }
    });

  } catch (error) {
    logger.error('Get drivers in area failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Chauffeurs in gebied ophalen mislukt'
    });
  }
};

// Get tracking statistics (Admin only)
const getTrackingStats = async (req, res) => {
  try {
    const trackingService = req.app.get('trackingService');
    const stats = await trackingService.getDriverStats();

    // Additional stats
    const activeRides = await db('rides')
      .whereIn('status', ['assigned', 'picked_up', 'in_progress'])
      .count('* as count')
      .first();

    const todayRides = await db('rides')
      .where('created_at', '>=', new Date().toISOString().split('T')[0])
      .count('* as count')
      .first();

    res.json({
      success: true,
      tracking: stats,
      rides: {
        active: parseInt(activeRides.count),
        today: parseInt(todayRides.count)
      },
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Get tracking stats failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Tracking statistieken ophalen mislukt'
    });
  }
};

// Start ride tracking (Customer app)
const startRideTracking = async (req, res) => {
  try {
    const { rideId } = req.params;
    const customerId = req.user.id;

    // Verify ride belongs to customer
    const ride = await db('rides').where('id', rideId).where('customer_id', customerId).first();
    if (!ride) {
      return res.status(404).json({
        success: false,
        error: 'Rit niet gevonden'
      });
    }

    if (!ride.driver_id) {
      return res.status(400).json({
        success: false,
        error: 'Geen chauffeur toegewezen aan deze rit'
      });
    }

    // Get driver location
    const driverLocation = await db('driver_locations').where('driver_id', ride.driver_id).first();
    if (!driverLocation) {
      return res.status(404).json({
        success: false,
        error: 'Chauffeur locatie niet beschikbaar'
      });
    }

    const location = DriverLocation.fromDatabase(driverLocation);

    res.json({
      success: true,
      tracking: {
        rideId: rideId,
        driverId: ride.driver_id,
        location: location.toPublicJSON(),
        message: 'Tracking gestart - u ontvangt live updates'
      }
    });

  } catch (error) {
    logger.error('Start ride tracking failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Rit tracking starten mislukt'
    });
  }
};

// Stop ride tracking
const stopRideTracking = async (req, res) => {
  try {
    const { rideId } = req.params;

    // Remove tracking through Socket.IO if connected
    const trackingService = req.app.get('trackingService');
    if (trackingService) {
      trackingService.removeRideTracking(rideId);
    }

    res.json({
      success: true,
      message: 'Rit tracking gestopt'
    });

  } catch (error) {
    logger.error('Stop ride tracking failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Rit tracking stoppen mislukt'
    });
  }
};

module.exports = {
  updateLocation,
  updateStatus,
  getDriverLocation,
  getLocationHistory,
  getNearbyDrivers,
  getDriversInArea,
  getTrackingStats,
  startRideTracking,
  stopRideTracking
};