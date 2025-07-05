const { v4: uuidv4 } = require('uuid');

class Ride {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.customerId = data.customerId || null;
    this.driverId = data.driverId || null;
    this.vehicleId = data.vehicleId || null;
    this.companyId = data.companyId || null;
    this.status = data.status || 'pending'; // pending, confirmed, assigned, picked_up, in_progress, completed, cancelled
    this.pickupLocation = data.pickupLocation || {};
    this.dropoffLocation = data.dropoffLocation || {};
    this.extraStops = data.extraStops || [];
    this.scheduledAt = data.scheduledAt || null;
    this.estimatedDistance = data.estimatedDistance || 0;
    this.estimatedDuration = data.estimatedDuration || 0;
    this.actualDistance = data.actualDistance || 0;
    this.actualDuration = data.actualDuration || 0;
    this.baseFare = data.baseFare || 0;
    this.distanceFare = data.distanceFare || 0;
    this.timeFare = data.timeFare || 0;
    this.extraFees = data.extraFees || {};
    this.totalFare = data.totalFare || 0;
    this.paymentStatus = data.paymentStatus || 'pending'; // pending, authorized, paid, failed, refunded
    this.paymentMethod = data.paymentMethod || null;
    this.passengers = data.passengers || 1;
    this.luggage = data.luggage || 0;
    this.specialRequests = data.specialRequests || '';
    this.notes = data.notes || '';
    this.rating = data.rating || null;
    this.feedback = data.feedback || '';
    this.pickupTime = data.pickupTime || null;
    this.startTime = data.startTime || null;
    this.endTime = data.endTime || null;
    this.cancelledAt = data.cancelledAt || null;
    this.cancelReason = data.cancelReason || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Validatie methoden
  validate() {
    const errors = [];

    if (!this.customerId) {
      errors.push('Klant ID is verplicht');
    }

    if (!this.pickupLocation.address || !this.pickupLocation.latitude || !this.pickupLocation.longitude) {
      errors.push('Ophaallocatie is onvolledig');
    }

    if (!this.dropoffLocation.address || !this.dropoffLocation.latitude || !this.dropoffLocation.longitude) {
      errors.push('Bestemmingslocatie is onvolledig');
    }

    if (this.passengers < 1 || this.passengers > 50) {
      errors.push('Aantal passagiers moet tussen 1 en 50 zijn');
    }

    if (this.luggage < 0) {
      errors.push('Aantal bagage stuks kan niet negatief zijn');
    }

    if (this.scheduledAt && new Date(this.scheduledAt) < new Date()) {
      errors.push('Geplande tijd kan niet in het verleden liggen');
    }

    return errors;
  }

  validateStatusTransition(newStatus) {
    const validTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['assigned', 'cancelled'],
      'assigned': ['picked_up', 'cancelled'],
      'picked_up': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': []
    };

    return validTransitions[this.status]?.includes(newStatus) || false;
  }

  // Status methoden
  updateStatus(newStatus, reason = '') {
    if (!this.validateStatusTransition(newStatus)) {
      throw new Error(`Ongeldige status overgang van '${this.status}' naar '${newStatus}'`);
    }

    this.status = newStatus;
    this.updatedAt = new Date();

    if (newStatus === 'cancelled') {
      this.cancelledAt = new Date();
      this.cancelReason = reason;
    } else if (newStatus === 'picked_up') {
      this.pickupTime = new Date();
    } else if (newStatus === 'in_progress') {
      this.startTime = new Date();
    } else if (newStatus === 'completed') {
      this.endTime = new Date();
    }
  }

  // Utility methoden
  isPending() {
    return this.status === 'pending';
  }

  isConfirmed() {
    return this.status === 'confirmed';
  }

  isAssigned() {
    return this.status === 'assigned';
  }

  isInProgress() {
    return ['picked_up', 'in_progress'].includes(this.status);
  }

  isCompleted() {
    return this.status === 'completed';
  }

  isCancelled() {
    return this.status === 'cancelled';
  }

  canBeCancelled() {
    return !['completed', 'cancelled'].includes(this.status);
  }

  canBeRated() {
    return this.status === 'completed' && !this.rating;
  }

  isScheduled() {
    return this.scheduledAt && new Date(this.scheduledAt) > new Date();
  }

  // Pricing methoden
  calculateFare(rateCard) {
    this.baseFare = rateCard.baseFare || 0;
    this.distanceFare = (this.estimatedDistance || 0) * (rateCard.perKm || 0);
    this.timeFare = (this.estimatedDuration || 0) * (rateCard.perMinute || 0);

    // Extra fees
    if (this.luggage > 0) {
      this.extraFees.luggage = this.luggage * (rateCard.luggageFee || 0);
    }

    if (this.extraStops.length > 0) {
      this.extraFees.extraStops = this.extraStops.length * (rateCard.extraStopFee || 0);
    }

    if (this.isScheduled()) {
      this.extraFees.booking = rateCard.bookingFee || 0;
    }

    // Korting voor lange ritten
    if (this.estimatedDistance > (rateCard.discountAfterKm || 50)) {
      const discountAmount = (this.distanceFare + this.timeFare) * (rateCard.longDistanceDiscount || 0);
      this.extraFees.longDistanceDiscount = -discountAmount;
    }

    const extraFeesTotal = Object.values(this.extraFees).reduce((sum, fee) => sum + fee, 0);
    this.totalFare = this.baseFare + this.distanceFare + this.timeFare + extraFeesTotal;

    return this.totalFare;
  }

  addExtraStop(location) {
    this.extraStops.push({
      id: uuidv4(),
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      order: this.extraStops.length + 1,
      completed: false
    });
    this.updatedAt = new Date();
  }

  removeExtraStop(stopId) {
    this.extraStops = this.extraStops.filter(stop => stop.id !== stopId);
    this.extraStops.forEach((stop, index) => {
      stop.order = index + 1;
    });
    this.updatedAt = new Date();
  }

  // Database methoden
  toDatabase() {
    return {
      id: this.id,
      customer_id: this.customerId,
      driver_id: this.driverId,
      vehicle_id: this.vehicleId,
      company_id: this.companyId,
      status: this.status,
      pickup_location: JSON.stringify(this.pickupLocation),
      dropoff_location: JSON.stringify(this.dropoffLocation),
      extra_stops: JSON.stringify(this.extraStops),
      scheduled_at: this.scheduledAt,
      estimated_distance: this.estimatedDistance,
      estimated_duration: this.estimatedDuration,
      actual_distance: this.actualDistance,
      actual_duration: this.actualDuration,
      base_fare: this.baseFare,
      distance_fare: this.distanceFare,
      time_fare: this.timeFare,
      extra_fees: JSON.stringify(this.extraFees),
      total_fare: this.totalFare,
      payment_status: this.paymentStatus,
      payment_method: this.paymentMethod,
      passengers: this.passengers,
      luggage: this.luggage,
      special_requests: this.specialRequests,
      notes: this.notes,
      rating: this.rating,
      feedback: this.feedback,
      pickup_time: this.pickupTime,
      start_time: this.startTime,
      end_time: this.endTime,
      cancelled_at: this.cancelledAt,
      cancel_reason: this.cancelReason,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  static fromDatabase(row) {
    if (!row) return null;

    return new Ride({
      id: row.id,
      customerId: row.customer_id,
      driverId: row.driver_id,
      vehicleId: row.vehicle_id,
      companyId: row.company_id,
      status: row.status,
      pickupLocation: row.pickup_location ? JSON.parse(row.pickup_location) : {},
      dropoffLocation: row.dropoff_location ? JSON.parse(row.dropoff_location) : {},
      extraStops: row.extra_stops ? JSON.parse(row.extra_stops) : [],
      scheduledAt: row.scheduled_at,
      estimatedDistance: row.estimated_distance,
      estimatedDuration: row.estimated_duration,
      actualDistance: row.actual_distance,
      actualDuration: row.actual_duration,
      baseFare: row.base_fare,
      distanceFare: row.distance_fare,
      timeFare: row.time_fare,
      extraFees: row.extra_fees ? JSON.parse(row.extra_fees) : {},
      totalFare: row.total_fare,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      passengers: row.passengers,
      luggage: row.luggage,
      specialRequests: row.special_requests,
      notes: row.notes,
      rating: row.rating,
      feedback: row.feedback,
      pickupTime: row.pickup_time,
      startTime: row.start_time,
      endTime: row.end_time,
      cancelledAt: row.cancelled_at,
      cancelReason: row.cancel_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  // API response methoden
  toJSON() {
    return {
      id: this.id,
      customerId: this.customerId,
      driverId: this.driverId,
      vehicleId: this.vehicleId,
      companyId: this.companyId,
      status: this.status,
      pickupLocation: this.pickupLocation,
      dropoffLocation: this.dropoffLocation,
      extraStops: this.extraStops,
      scheduledAt: this.scheduledAt,
      estimatedDistance: this.estimatedDistance,
      estimatedDuration: this.estimatedDuration,
      actualDistance: this.actualDistance,
      actualDuration: this.actualDuration,
      totalFare: this.totalFare,
      paymentStatus: this.paymentStatus,
      paymentMethod: this.paymentMethod,
      passengers: this.passengers,
      luggage: this.luggage,
      specialRequests: this.specialRequests,
      rating: this.rating,
      feedback: this.feedback,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toPublicJSON() {
    return {
      id: this.id,
      status: this.status,
      pickupLocation: this.pickupLocation,
      dropoffLocation: this.dropoffLocation,
      scheduledAt: this.scheduledAt,
      estimatedDistance: this.estimatedDistance,
      estimatedDuration: this.estimatedDuration,
      totalFare: this.totalFare,
      passengers: this.passengers,
      createdAt: this.createdAt
    };
  }
}

module.exports = Ride;