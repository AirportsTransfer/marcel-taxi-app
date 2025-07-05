const { v4: uuidv4 } = require('uuid');

class DriverLocation {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.driverId = data.driverId || null;
    this.vehicleId = data.vehicleId || null;
    this.rideId = data.rideId || null; // Current active ride
    this.latitude = data.latitude || 0;
    this.longitude = data.longitude || 0;
    this.accuracy = data.accuracy || 0; // GPS accuracy in meters
    this.altitude = data.altitude || null;
    this.speed = data.speed || 0; // km/h
    this.heading = data.heading || null; // degrees (0-360)
    this.address = data.address || '';
    this.status = data.status || 'available'; // available, busy, offline, break
    this.batteryLevel = data.batteryLevel || null;
    this.isGpsEnabled = data.isGpsEnabled !== undefined ? data.isGpsEnabled : true;
    this.lastMovement = data.lastMovement || new Date();
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Validatie methoden
  validate() {
    const errors = [];

    if (!this.driverId) {
      errors.push('Chauffeur ID is verplicht');
    }

    if (!this.latitude || !this.longitude) {
      errors.push('GPS coördinaten zijn verplicht');
    }

    if (this.latitude < -90 || this.latitude > 90) {
      errors.push('Latitude moet tussen -90 en 90 graden liggen');
    }

    if (this.longitude < -180 || this.longitude > 180) {
      errors.push('Longitude moet tussen -180 en 180 graden liggen');
    }

    if (!['available', 'busy', 'offline', 'break'].includes(this.status)) {
      errors.push('Ongeldige status');
    }

    return errors;
  }

  // Status methoden
  isAvailable() {
    return this.status === 'available';
  }

  isBusy() {
    return this.status === 'busy';
  }

  isOffline() {
    return this.status === 'offline';
  }

  isOnBreak() {
    return this.status === 'break';
  }

  isOnline() {
    return ['available', 'busy', 'break'].includes(this.status);
  }

  // Location methoden
  updateLocation(locationData) {
    const previousLat = this.latitude;
    const previousLon = this.longitude;

    this.latitude = locationData.latitude;
    this.longitude = locationData.longitude;
    this.accuracy = locationData.accuracy || this.accuracy;
    this.altitude = locationData.altitude || this.altitude;
    this.speed = locationData.speed || 0;
    this.heading = locationData.heading || this.heading;
    this.address = locationData.address || this.address;
    this.batteryLevel = locationData.batteryLevel || this.batteryLevel;
    this.isGpsEnabled = locationData.isGpsEnabled !== undefined ? locationData.isGpsEnabled : this.isGpsEnabled;
    this.updatedAt = new Date();

    // Check if driver has moved
    if (this.hasMovedFrom(previousLat, previousLon)) {
      this.lastMovement = new Date();
    }
  }

  hasMovedFrom(previousLat, previousLon, threshold = 0.00001) {
    const latDiff = Math.abs(this.latitude - previousLat);
    const lonDiff = Math.abs(this.longitude - previousLon);
    return latDiff > threshold || lonDiff > threshold;
  }

  // Distance calculations
  distanceFromPoint(latitude, longitude) {
    const R = 6371; // Earth's radius in km
    const dLat = (latitude - this.latitude) * Math.PI / 180;
    const dLon = (longitude - this.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.latitude * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  distanceFromLocation(location) {
    return this.distanceFromPoint(location.latitude, location.longitude);
  }

  isWithinRadius(latitude, longitude, radiusKm) {
    return this.distanceFromPoint(latitude, longitude) <= radiusKm;
  }

  // Status updates
  setAvailable(rideId = null) {
    this.status = 'available';
    this.rideId = rideId;
    this.updatedAt = new Date();
  }

  setBusy(rideId) {
    this.status = 'busy';
    this.rideId = rideId;
    this.updatedAt = new Date();
  }

  setOffline() {
    this.status = 'offline';
    this.rideId = null;
    this.updatedAt = new Date();
  }

  setOnBreak() {
    this.status = 'break';
    this.rideId = null;
    this.updatedAt = new Date();
  }

  // Movement tracking
  getIdleTime() {
    const now = new Date();
    const lastMovement = new Date(this.lastMovement);
    return Math.round((now - lastMovement) / 1000 / 60); // minutes
  }

  isIdle(thresholdMinutes = 5) {
    return this.getIdleTime() >= thresholdMinutes;
  }

  // Speed and direction
  isMoving(speedThreshold = 5) {
    return this.speed > speedThreshold; // km/h
  }

  getSpeedStatus() {
    if (this.speed < 5) return 'stationary';
    if (this.speed < 30) return 'slow';
    if (this.speed < 60) return 'normal';
    return 'fast';
  }

  getDirectionText() {
    if (this.heading === null) return 'unknown';
    
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(this.heading / 22.5) % 16;
    return directions[index];
  }

  // GPS quality checks
  hasGoodGpsAccuracy(threshold = 10) {
    return this.accuracy > 0 && this.accuracy <= threshold; // meters
  }

  getGpsQuality() {
    if (!this.isGpsEnabled) return 'disabled';
    if (this.accuracy <= 5) return 'excellent';
    if (this.accuracy <= 10) return 'good';
    if (this.accuracy <= 20) return 'fair';
    return 'poor';
  }

  // Battery monitoring
  needsBatteryWarning(threshold = 20) {
    return this.batteryLevel !== null && this.batteryLevel <= threshold;
  }

  getBatteryStatus() {
    if (this.batteryLevel === null) return 'unknown';
    if (this.batteryLevel > 50) return 'good';
    if (this.batteryLevel > 20) return 'medium';
    return 'low';
  }

  // Geofencing
  isInGeofence(geofence) {
    switch (geofence.type) {
      case 'circle':
        return this.isWithinRadius(geofence.center.latitude, geofence.center.longitude, geofence.radius);
      case 'polygon':
        return this.isInPolygon(geofence.coordinates);
      default:
        return false;
    }
  }

  isInPolygon(polygonCoordinates) {
    let inside = false;
    for (let i = 0, j = polygonCoordinates.length - 1; i < polygonCoordinates.length; j = i++) {
      if (((polygonCoordinates[i].latitude > this.latitude) !== (polygonCoordinates[j].latitude > this.latitude)) &&
          (this.longitude < (polygonCoordinates[j].longitude - polygonCoordinates[i].longitude) * 
           (this.latitude - polygonCoordinates[i].latitude) / 
           (polygonCoordinates[j].latitude - polygonCoordinates[i].latitude) + polygonCoordinates[i].longitude)) {
        inside = !inside;
      }
    }
    return inside;
  }

  // Database methoden
  toDatabase() {
    return {
      id: this.id,
      driver_id: this.driverId,
      vehicle_id: this.vehicleId,
      ride_id: this.rideId,
      latitude: this.latitude,
      longitude: this.longitude,
      accuracy: this.accuracy,
      altitude: this.altitude,
      speed: this.speed,
      heading: this.heading,
      address: this.address,
      status: this.status,
      battery_level: this.batteryLevel,
      is_gps_enabled: this.isGpsEnabled,
      last_movement: this.lastMovement,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  static fromDatabase(row) {
    if (!row) return null;

    return new DriverLocation({
      id: row.id,
      driverId: row.driver_id,
      vehicleId: row.vehicle_id,
      rideId: row.ride_id,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      accuracy: row.accuracy,
      altitude: row.altitude,
      speed: row.speed,
      heading: row.heading,
      address: row.address,
      status: row.status,
      batteryLevel: row.battery_level,
      isGpsEnabled: row.is_gps_enabled,
      lastMovement: row.last_movement,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  // API response methoden
  toJSON() {
    return {
      id: this.id,
      driverId: this.driverId,
      vehicleId: this.vehicleId,
      rideId: this.rideId,
      latitude: this.latitude,
      longitude: this.longitude,
      accuracy: this.accuracy,
      altitude: this.altitude,
      speed: this.speed,
      heading: this.heading,
      address: this.address,
      status: this.status,
      batteryLevel: this.batteryLevel,
      isGpsEnabled: this.isGpsEnabled,
      lastMovement: this.lastMovement,
      isMoving: this.isMoving(),
      speedStatus: this.getSpeedStatus(),
      directionText: this.getDirectionText(),
      gpsQuality: this.getGpsQuality(),
      batteryStatus: this.getBatteryStatus(),
      idleTime: this.getIdleTime(),
      updatedAt: this.updatedAt
    };
  }

  toPublicJSON() {
    return {
      latitude: this.latitude,
      longitude: this.longitude,
      accuracy: this.accuracy,
      speed: this.speed,
      heading: this.heading,
      address: this.address,
      status: this.status,
      isMoving: this.isMoving(),
      speedStatus: this.getSpeedStatus(),
      directionText: this.getDirectionText(),
      updatedAt: this.updatedAt
    };
  }

  toTrackingJSON() {
    return {
      driverId: this.driverId,
      rideId: this.rideId,
      latitude: this.latitude,
      longitude: this.longitude,
      speed: this.speed,
      heading: this.heading,
      address: this.address,
      status: this.status,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = DriverLocation;