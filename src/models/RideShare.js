const { v4: uuidv4 } = require('uuid');

class RideShare {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.originalRideId = data.originalRideId || null;
    this.sourceCompanyId = data.sourceCompanyId || null; // Company that created the ride
    this.targetCompanyId = data.targetCompanyId || null; // Company that will execute the ride
    this.partnershipId = data.partnershipId || null;
    this.status = data.status || 'offered'; // offered, accepted, rejected, completed, cancelled
    this.offerPrice = data.offerPrice || 0;
    this.commissionAmount = data.commissionAmount || 0;
    this.acceptedPrice = data.acceptedPrice || null;
    this.assignedDriverId = data.assignedDriverId || null;
    this.assignedVehicleId = data.assignedVehicleId || null;
    this.rideData = data.rideData || {}; // Copy of original ride data
    this.responseTime = data.responseTime || null; // When partner responded
    this.acceptedAt = data.acceptedAt || null;
    this.completedAt = data.completedAt || null;
    this.rejectionReason = data.rejectionReason || '';
    this.cancellationReason = data.cancellationReason || '';
    this.notes = data.notes || '';
    this.expiresAt = data.expiresAt || this.getDefaultExpiry();
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Default expiry (30 minutes from creation)
  getDefaultExpiry() {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 30);
    return expiry;
  }

  // Validatie methoden
  validate() {
    const errors = [];

    if (!this.originalRideId) {
      errors.push('Originele rit ID is verplicht');
    }

    if (!this.sourceCompanyId) {
      errors.push('Bron bedrijf ID is verplicht');
    }

    if (!this.targetCompanyId) {
      errors.push('Doel bedrijf ID is verplicht');
    }

    if (this.sourceCompanyId === this.targetCompanyId) {
      errors.push('Bron en doel bedrijf kunnen niet hetzelfde zijn');
    }

    if (!this.partnershipId) {
      errors.push('Partnerschap ID is verplicht');
    }

    if (this.offerPrice <= 0) {
      errors.push('Aanbiedingsprijs moet groter zijn dan 0');
    }

    if (!['offered', 'accepted', 'rejected', 'completed', 'cancelled'].includes(this.status)) {
      errors.push('Ongeldige status');
    }

    return errors;
  }

  // Status methoden
  isOffered() {
    return this.status === 'offered';
  }

  isAccepted() {
    return this.status === 'accepted';
  }

  isRejected() {
    return this.status === 'rejected';
  }

  isCompleted() {
    return this.status === 'completed';
  }

  isCancelled() {
    return this.status === 'cancelled';
  }

  isExpired() {
    return new Date() > this.expiresAt;
  }

  isActive() {
    return ['offered', 'accepted'].includes(this.status) && !this.isExpired();
  }

  canBeAccepted() {
    return this.status === 'offered' && !this.isExpired();
  }

  canBeCancelled() {
    return ['offered', 'accepted'].includes(this.status);
  }

  // Status updates
  accept(acceptedPrice, driverId = null, vehicleId = null) {
    if (!this.canBeAccepted()) {
      throw new Error('Rit delen kan niet meer worden geaccepteerd');
    }

    this.status = 'accepted';
    this.acceptedPrice = acceptedPrice;
    this.assignedDriverId = driverId;
    this.assignedVehicleId = vehicleId;
    this.acceptedAt = new Date();
    this.responseTime = this.calculateResponseTime();
    this.updatedAt = new Date();
  }

  reject(reason) {
    if (this.status !== 'offered') {
      throw new Error('Alleen aangeboden ritten kunnen worden afgewezen');
    }

    this.status = 'rejected';
    this.rejectionReason = reason;
    this.responseTime = this.calculateResponseTime();
    this.updatedAt = new Date();
  }

  complete() {
    if (this.status !== 'accepted') {
      throw new Error('Alleen geaccepteerde ritten kunnen worden voltooid');
    }

    this.status = 'completed';
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  cancel(reason) {
    if (!this.canBeCancelled()) {
      throw new Error('Deze rit delen kan niet worden geannuleerd');
    }

    this.status = 'cancelled';
    this.cancellationReason = reason;
    this.updatedAt = new Date();
  }

  // Time calculations
  calculateResponseTime() {
    const responseDate = new Date();
    const createdDate = new Date(this.createdAt);
    return Math.round((responseDate - createdDate) / 1000 / 60); // Minutes
  }

  getTimeRemaining() {
    if (this.isExpired()) return 0;
    
    const now = new Date();
    const expiry = new Date(this.expiresAt);
    return Math.max(0, Math.round((expiry - now) / 1000 / 60)); // Minutes
  }

  // Commission calculations
  calculateCommission(commissionRate) {
    const finalPrice = this.acceptedPrice || this.offerPrice;
    this.commissionAmount = finalPrice * commissionRate;
    return this.commissionAmount;
  }

  getNetAmountForPartner() {
    const finalPrice = this.acceptedPrice || this.offerPrice;
    return finalPrice - this.commissionAmount;
  }

  // Ride data methoden
  setRideData(rideData) {
    this.rideData = {
      customerId: rideData.customerId,
      pickupLocation: rideData.pickupLocation,
      dropoffLocation: rideData.dropoffLocation,
      scheduledAt: rideData.scheduledAt,
      passengers: rideData.passengers,
      luggage: rideData.luggage,
      specialRequests: rideData.specialRequests,
      extraStops: rideData.extraStops,
      estimatedDistance: rideData.estimatedDistance,
      estimatedDuration: rideData.estimatedDuration,
      vehicleType: rideData.vehicleType || 'sedan',
      paymentMethod: rideData.paymentMethod
    };
    this.updatedAt = new Date();
  }

  getRideData() {
    return this.rideData;
  }

  // Driver assignment
  assignDriver(driverId, vehicleId = null) {
    if (this.status !== 'accepted') {
      throw new Error('Chauffeur kan alleen worden toegewezen aan geaccepteerde ritten');
    }

    this.assignedDriverId = driverId;
    this.assignedVehicleId = vehicleId;
    this.updatedAt = new Date();
  }

  // Pricing methods
  updatePricing(newPrice, commissionRate) {
    if (this.status === 'offered') {
      this.offerPrice = newPrice;
    } else if (this.status === 'accepted') {
      this.acceptedPrice = newPrice;
    }

    this.calculateCommission(commissionRate);
    this.updatedAt = new Date();
  }

  // Display methods
  getDisplayStatus() {
    const statusMap = {
      'offered': 'Aangeboden',
      'accepted': 'Geaccepteerd',
      'rejected': 'Afgewezen',
      'completed': 'Voltooid',
      'cancelled': 'Geannuleerd'
    };

    let status = statusMap[this.status] || this.status;
    
    if (this.isExpired() && this.status === 'offered') {
      status = 'Verlopen';
    }

    return status;
  }

  getShortDescription() {
    const pickup = this.rideData.pickupLocation?.address || 'Onbekend';
    const dropoff = this.rideData.dropoffLocation?.address || 'Onbekend';
    
    return `${pickup} → ${dropoff}`;
  }

  // Database methoden
  toDatabase() {
    return {
      id: this.id,
      original_ride_id: this.originalRideId,
      source_company_id: this.sourceCompanyId,
      target_company_id: this.targetCompanyId,
      partnership_id: this.partnershipId,
      status: this.status,
      offer_price: this.offerPrice,
      commission_amount: this.commissionAmount,
      accepted_price: this.acceptedPrice,
      assigned_driver_id: this.assignedDriverId,
      assigned_vehicle_id: this.assignedVehicleId,
      ride_data: JSON.stringify(this.rideData),
      response_time: this.responseTime,
      accepted_at: this.acceptedAt,
      completed_at: this.completedAt,
      rejection_reason: this.rejectionReason,
      cancellation_reason: this.cancellationReason,
      notes: this.notes,
      expires_at: this.expiresAt,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  static fromDatabase(row) {
    if (!row) return null;

    return new RideShare({
      id: row.id,
      originalRideId: row.original_ride_id,
      sourceCompanyId: row.source_company_id,
      targetCompanyId: row.target_company_id,
      partnershipId: row.partnership_id,
      status: row.status,
      offerPrice: parseFloat(row.offer_price),
      commissionAmount: parseFloat(row.commission_amount),
      acceptedPrice: row.accepted_price ? parseFloat(row.accepted_price) : null,
      assignedDriverId: row.assigned_driver_id,
      assignedVehicleId: row.assigned_vehicle_id,
      rideData: row.ride_data ? JSON.parse(row.ride_data) : {},
      responseTime: row.response_time,
      acceptedAt: row.accepted_at,
      completedAt: row.completed_at,
      rejectionReason: row.rejection_reason,
      cancellationReason: row.cancellation_reason,
      notes: row.notes,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  // API response methoden
  toJSON() {
    return {
      id: this.id,
      originalRideId: this.originalRideId,
      sourceCompanyId: this.sourceCompanyId,
      targetCompanyId: this.targetCompanyId,
      partnershipId: this.partnershipId,
      status: this.status,
      displayStatus: this.getDisplayStatus(),
      offerPrice: this.offerPrice,
      commissionAmount: this.commissionAmount,
      acceptedPrice: this.acceptedPrice,
      assignedDriverId: this.assignedDriverId,
      assignedVehicleId: this.assignedVehicleId,
      rideData: this.rideData,
      responseTime: this.responseTime,
      acceptedAt: this.acceptedAt,
      completedAt: this.completedAt,
      rejectionReason: this.rejectionReason,
      cancellationReason: this.cancellationReason,
      expiresAt: this.expiresAt,
      timeRemaining: this.getTimeRemaining(),
      isExpired: this.isExpired(),
      isActive: this.isActive(),
      shortDescription: this.getShortDescription(),
      netAmountForPartner: this.getNetAmountForPartner(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toPartnerJSON() {
    return {
      id: this.id,
      status: this.status,
      displayStatus: this.getDisplayStatus(),
      offerPrice: this.offerPrice,
      rideData: this.rideData,
      expiresAt: this.expiresAt,
      timeRemaining: this.getTimeRemaining(),
      shortDescription: this.getShortDescription(),
      createdAt: this.createdAt
    };
  }
}

module.exports = RideShare;