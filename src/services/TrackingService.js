const DriverLocation = require('../models/DriverLocation');
const db = require('../config/database');
const logger = require('../utils/logger');

class TrackingService {
  constructor(io) {
    this.io = io;
    this.activeDrivers = new Map(); // driverId -> socket
    this.activeRides = new Map(); // rideId -> {driverId, customerId, sockets}
    this.locationHistory = new Map(); // driverId -> Array of recent locations
    this.geofences = new Map(); // geofenceId -> geofence config
    
    this.initializeGeofences();
  }

  // Driver connection management
  addDriverConnection(driverId, socket) {
    this.activeDrivers.set(driverId, socket);
    logger.info('Driver connected to tracking', { driverId, socketId: socket.id });

    // Set up driver-specific event listeners
    socket.on('location-update', (data) => {
      this.handleLocationUpdate(driverId, data);
    });

    socket.on('status-update', (data) => {
      this.handleStatusUpdate(driverId, data);
    });

    socket.on('disconnect', () => {
      this.removeDriverConnection(driverId);
    });
  }

  removeDriverConnection(driverId) {
    if (this.activeDrivers.has(driverId)) {
      this.activeDrivers.delete(driverId);
      // Set driver offline
      this.updateDriverStatus(driverId, 'offline');
      logger.info('Driver disconnected from tracking', { driverId });
    }
  }

  // Customer tracking for rides
  addRideTracking(rideId, driverId, customerId, customerSocket) {
    if (!this.activeRides.has(rideId)) {
      this.activeRides.set(rideId, {
        driverId,
        customerId,
        customerSockets: new Set(),
        startTime: new Date()
      });
    }

    const rideTracking = this.activeRides.get(rideId);
    rideTracking.customerSockets.add(customerSocket);

    customerSocket.on('disconnect', () => {
      rideTracking.customerSockets.delete(customerSocket);
      if (rideTracking.customerSockets.size === 0) {
        this.removeRideTracking(rideId);
      }
    });

    logger.info('Customer added to ride tracking', { rideId, customerId });
  }

  removeRideTracking(rideId) {
    if (this.activeRides.has(rideId)) {
      this.activeRides.delete(rideId);
      logger.info('Ride tracking removed', { rideId });
    }
  }

  // Location update handling
  async handleLocationUpdate(driverId, locationData) {
    try {
      // Get or create driver location
      let driverLocation = await this.getDriverLocation(driverId);
      
      if (!driverLocation) {
        driverLocation = new DriverLocation({
          driverId,
          vehicleId: locationData.vehicleId,
          ...locationData
        });
      } else {
        driverLocation.updateLocation(locationData);
      }

      // Validate location data
      const validationErrors = driverLocation.validate();
      if (validationErrors.length > 0) {
        logger.error('Invalid location data', { driverId, errors: validationErrors });
        return;
      }

      // Save to database (upsert)
      await this.saveDriverLocation(driverLocation);

      // Update location history
      this.updateLocationHistory(driverId, driverLocation);

      // Check geofences
      this.checkGeofences(driverId, driverLocation);

      // Broadcast to customers tracking this driver
      this.broadcastLocationUpdate(driverLocation);

      // Send driver-specific updates
      this.sendDriverUpdates(driverId, driverLocation);

    } catch (error) {
      logger.error('Handle location update failed', {
        driverId,
        error: error.message
      });
    }
  }

  async handleStatusUpdate(driverId, statusData) {
    try {
      const driverLocation = await this.getDriverLocation(driverId);
      if (!driverLocation) return;

      const oldStatus = driverLocation.status;
      
      switch (statusData.status) {
        case 'available':
          driverLocation.setAvailable();
          break;
        case 'busy':
          driverLocation.setBusy(statusData.rideId);
          break;
        case 'break':
          driverLocation.setOnBreak();
          break;
        case 'offline':
          driverLocation.setOffline();
          break;
      }

      await this.saveDriverLocation(driverLocation);

      // Broadcast status change
      this.broadcastStatusUpdate(driverId, oldStatus, driverLocation.status);

      logger.info('Driver status updated', {
        driverId,
        oldStatus,
        newStatus: driverLocation.status
      });

    } catch (error) {
      logger.error('Handle status update failed', {
        driverId,
        error: error.message
      });
    }
  }

  // Database operations
  async getDriverLocation(driverId) {
    try {
      const row = await db('driver_locations').where('driver_id', driverId).first();
      return row ? DriverLocation.fromDatabase(row) : null;
    } catch (error) {
      logger.error('Get driver location failed', { driverId, error: error.message });
      return null;
    }
  }

  async saveDriverLocation(driverLocation) {
    try {
      const data = driverLocation.toDatabase();
      
      // Use upsert (ON CONFLICT UPDATE)
      await db.raw(`
        INSERT INTO driver_locations (${Object.keys(data).join(', ')})
        VALUES (${Object.keys(data).map(() => '?').join(', ')})
        ON CONFLICT (driver_id) DO UPDATE SET
        ${Object.keys(data).filter(key => key !== 'driver_id').map(key => `${key} = EXCLUDED.${key}`).join(', ')}
      `, Object.values(data));

    } catch (error) {
      logger.error('Save driver location failed', {
        driverId: driverLocation.driverId,
        error: error.message
      });
    }
  }

  async updateDriverStatus(driverId, status) {
    try {
      await db('driver_locations')
        .where('driver_id', driverId)
        .update({
          status: status,
          updated_at: new Date()
        });
    } catch (error) {
      logger.error('Update driver status failed', { driverId, status, error: error.message });
    }
  }

  // Location history management
  updateLocationHistory(driverId, location) {
    if (!this.locationHistory.has(driverId)) {
      this.locationHistory.set(driverId, []);
    }

    const history = this.locationHistory.get(driverId);
    history.push({
      latitude: location.latitude,
      longitude: location.longitude,
      speed: location.speed,
      heading: location.heading,
      timestamp: location.updatedAt
    });

    // Keep only last 50 locations
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }

  getLocationHistory(driverId, limit = 20) {
    const history = this.locationHistory.get(driverId) || [];
    return history.slice(-limit);
  }

  // Real-time broadcasting
  broadcastLocationUpdate(driverLocation) {
    // Broadcast to customers tracking this driver's ride
    if (driverLocation.rideId && this.activeRides.has(driverLocation.rideId)) {
      const rideTracking = this.activeRides.get(driverLocation.rideId);
      const locationUpdate = {
        type: 'location-update',
        rideId: driverLocation.rideId,
        driverId: driverLocation.driverId,
        location: driverLocation.toTrackingJSON(),
        timestamp: new Date()
      };

      rideTracking.customerSockets.forEach(socket => {
        socket.emit('driver-location', locationUpdate);
      });
    }

    // Broadcast to admin dashboard
    this.io.to('admin-room').emit('driver-location-update', driverLocation.toJSON());
  }

  broadcastStatusUpdate(driverId, oldStatus, newStatus) {
    const statusUpdate = {
      type: 'status-update',
      driverId,
      oldStatus,
      newStatus,
      timestamp: new Date()
    };

    // Send to admin dashboard
    this.io.to('admin-room').emit('driver-status-update', statusUpdate);

    // Send to driver
    const driverSocket = this.activeDrivers.get(driverId);
    if (driverSocket) {
      driverSocket.emit('status-updated', { status: newStatus });
    }
  }

  sendDriverUpdates(driverId, location) {
    const driverSocket = this.activeDrivers.get(driverId);
    if (!driverSocket) return;

    // Send location confirmation to driver
    driverSocket.emit('location-updated', {
      success: true,
      location: location.toJSON(),
      gpsQuality: location.getGpsQuality(),
      batteryStatus: location.getBatteryStatus()
    });

    // Send warnings if needed
    if (location.needsBatteryWarning()) {
      driverSocket.emit('battery-warning', {
        level: location.batteryLevel,
        message: 'Batterij bijna leeg - zorg ervoor dat je apparaat wordt opgeladen'
      });
    }

    if (!location.hasGoodGpsAccuracy()) {
      driverSocket.emit('gps-warning', {
        accuracy: location.accuracy,
        message: 'GPS signaal is zwak - probeer naar een open ruimte te gaan'
      });
    }
  }

  // Geofencing
  initializeGeofences() {
    // Add common geofences
    this.geofences.set('airport', {
      name: 'Schiphol Airport',
      type: 'circle',
      center: { latitude: 52.3105, longitude: 4.7683 },
      radius: 5, // km
      triggers: ['enter', 'exit']
    });

    this.geofences.set('city-center', {
      name: 'Amsterdam Centrum',
      type: 'circle',
      center: { latitude: 52.3702, longitude: 4.8952 },
      radius: 3, // km
      triggers: ['enter', 'exit']
    });
  }

  checkGeofences(driverId, location) {
    this.geofences.forEach((geofence, geofenceId) => {
      const wasInside = this.wasDriverInGeofence(driverId, geofenceId);
      const isInside = location.isInGeofence(geofence);

      if (!wasInside && isInside && geofence.triggers.includes('enter')) {
        this.triggerGeofenceEvent(driverId, geofenceId, 'enter', geofence);
      } else if (wasInside && !isInside && geofence.triggers.includes('exit')) {
        this.triggerGeofenceEvent(driverId, geofenceId, 'exit', geofence);
      }

      // Store current state
      this.setDriverGeofenceState(driverId, geofenceId, isInside);
    });
  }

  triggerGeofenceEvent(driverId, geofenceId, event, geofence) {
    const eventData = {
      driverId,
      geofenceId,
      geofenceName: geofence.name,
      event,
      timestamp: new Date()
    };

    // Send to admin dashboard
    this.io.to('admin-room').emit('geofence-event', eventData);

    // Send to driver
    const driverSocket = this.activeDrivers.get(driverId);
    if (driverSocket) {
      driverSocket.emit('geofence-event', {
        geofence: geofence.name,
        event: event === 'enter' ? 'Gebied binnengereden' : 'Gebied verlaten'
      });
    }

    logger.info('Geofence event triggered', eventData);
  }

  wasDriverInGeofence(driverId, geofenceId) {
    // Simple in-memory tracking - in production, use Redis or database
    return this.driverGeofenceState?.get(`${driverId}-${geofenceId}`) || false;
  }

  setDriverGeofenceState(driverId, geofenceId, isInside) {
    if (!this.driverGeofenceState) {
      this.driverGeofenceState = new Map();
    }
    this.driverGeofenceState.set(`${driverId}-${geofenceId}`, isInside);
  }

  // Public API methods
  async getNearbyDrivers(latitude, longitude, radiusKm = 5, status = 'available') {
    try {
      const rows = await db('driver_locations')
        .where('status', status)
        .whereRaw(`
          (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * 
          cos(radians(longitude) - radians(?)) + sin(radians(?)) * 
          sin(radians(latitude)))) <= ?
        `, [latitude, longitude, latitude, radiusKm]);

      return rows.map(row => DriverLocation.fromDatabase(row));
    } catch (error) {
      logger.error('Get nearby drivers failed', { error: error.message });
      return [];
    }
  }

  async getDriversInArea(bounds) {
    try {
      const { northEast, southWest } = bounds;
      
      const rows = await db('driver_locations')
        .whereBetween('latitude', [southWest.latitude, northEast.latitude])
        .whereBetween('longitude', [southWest.longitude, northEast.longitude])
        .where('status', '!=', 'offline');

      return rows.map(row => DriverLocation.fromDatabase(row));
    } catch (error) {
      logger.error('Get drivers in area failed', { error: error.message });
      return [];
    }
  }

  async getDriverStats() {
    try {
      const stats = await db('driver_locations')
        .select('status')
        .count('* as count')
        .groupBy('status');

      const result = {
        available: 0,
        busy: 0,
        break: 0,
        offline: 0,
        total: 0
      };

      stats.forEach(stat => {
        result[stat.status] = parseInt(stat.count);
        result.total += parseInt(stat.count);
      });

      return result;
    } catch (error) {
      logger.error('Get driver stats failed', { error: error.message });
      return { available: 0, busy: 0, break: 0, offline: 0, total: 0 };
    }
  }
}

module.exports = TrackingService;