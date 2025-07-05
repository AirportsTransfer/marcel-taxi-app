const { v4: uuidv4 } = require('uuid');

class CompanyPartnership {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.requestingCompanyId = data.requestingCompanyId || null;
    this.targetCompanyId = data.targetCompanyId || null;
    this.status = data.status || 'pending'; // pending, accepted, rejected, suspended
    this.partnershipType = data.partnershipType || 'bidirectional'; // bidirectional, one_way
    this.commissionRate = data.commissionRate || 0.10; // 10% default commission
    this.allowedServices = data.allowedServices || ['ride_sharing'];
    this.coverageAreas = data.coverageAreas || []; // Geographic areas where partnership applies
    this.maxRidesPerDay = data.maxRidesPerDay || null; // Optional limit
    this.maxRidesPerMonth = data.maxRidesPerMonth || null;
    this.autoAcceptRides = data.autoAcceptRides || false;
    this.priority = data.priority || 1; // Higher number = higher priority when multiple partners available
    this.notes = data.notes || '';
    this.termsAcceptedAt = data.termsAcceptedAt || null;
    this.suspendedAt = data.suspendedAt || null;
    this.suspensionReason = data.suspensionReason || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Validatie methoden
  validate() {
    const errors = [];

    if (!this.requestingCompanyId) {
      errors.push('Aanvragend bedrijf ID is verplicht');
    }

    if (!this.targetCompanyId) {
      errors.push('Doel bedrijf ID is verplicht');
    }

    if (this.requestingCompanyId === this.targetCompanyId) {
      errors.push('Een bedrijf kan geen partnerschap met zichzelf aangaan');
    }

    if (!['pending', 'accepted', 'rejected', 'suspended'].includes(this.status)) {
      errors.push('Ongeldige status');
    }

    if (!['bidirectional', 'one_way'].includes(this.partnershipType)) {
      errors.push('Ongeldig partnerschap type');
    }

    if (this.commissionRate < 0 || this.commissionRate > 0.5) {
      errors.push('Commissiepercentage moet tussen 0% en 50% liggen');
    }

    return errors;
  }

  // Status methoden
  isPending() {
    return this.status === 'pending';
  }

  isAccepted() {
    return this.status === 'accepted';
  }

  isRejected() {
    return this.status === 'rejected';
  }

  isSuspended() {
    return this.status === 'suspended';
  }

  isActive() {
    return this.status === 'accepted' && !this.isSuspended();
  }

  // Status updates
  accept() {
    this.status = 'accepted';
    this.termsAcceptedAt = new Date();
    this.updatedAt = new Date();
  }

  reject() {
    this.status = 'rejected';
    this.updatedAt = new Date();
  }

  suspend(reason) {
    this.status = 'suspended';
    this.suspendedAt = new Date();
    this.suspensionReason = reason;
    this.updatedAt = new Date();
  }

  reactivate() {
    this.status = 'accepted';
    this.suspendedAt = null;
    this.suspensionReason = '';
    this.updatedAt = new Date();
  }

  // Partnership type methoden
  isBidirectional() {
    return this.partnershipType === 'bidirectional';
  }

  isOneWay() {
    return this.partnershipType === 'one_way';
  }

  // Service checks
  allowsService(service) {
    return this.allowedServices.includes(service);
  }

  allowsRideSharing() {
    return this.allowsService('ride_sharing');
  }

  // Coverage area checks
  coversArea(location) {
    if (this.coverageAreas.length === 0) return true; // No restrictions

    return this.coverageAreas.some(area => this.locationInArea(location, area));
  }

  locationInArea(location, area) {
    switch (area.type) {
      case 'postcode':
        return this.matchesPostcode(location, area.postcodes);
      case 'city':
        return this.matchesCity(location, area.cities);
      case 'radius':
        return this.withinRadius(location, area.center, area.radius);
      default:
        return false;
    }
  }

  matchesPostcode(location, postcodes) {
    if (!location.postcode) return false;
    return postcodes.some(pc => location.postcode.startsWith(pc));
  }

  matchesCity(location, cities) {
    if (!location.address) return false;
    const address = location.address.toLowerCase();
    return cities.some(city => address.includes(city.toLowerCase()));
  }

  withinRadius(location, center, radius) {
    if (!location.latitude || !location.longitude) return false;
    
    const distance = this.calculateDistance(
      location.latitude, location.longitude,
      center.latitude, center.longitude
    );
    
    return distance <= radius;
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Limits check
  canAcceptMoreRides(currentRidesToday, currentRidesThisMonth) {
    if (this.maxRidesPerDay && currentRidesToday >= this.maxRidesPerDay) {
      return false;
    }

    if (this.maxRidesPerMonth && currentRidesThisMonth >= this.maxRidesPerMonth) {
      return false;
    }

    return true;
  }

  // Commission calculation
  calculateCommission(ridePrice) {
    return ridePrice * this.commissionRate;
  }

  // Partnership direction check
  allowsRideFrom(requestingCompanyId, targetCompanyId) {
    if (!this.isActive()) return false;

    // Bidirectional: both directions allowed
    if (this.isBidirectional()) {
      return (this.requestingCompanyId === requestingCompanyId && this.targetCompanyId === targetCompanyId) ||
             (this.requestingCompanyId === targetCompanyId && this.targetCompanyId === requestingCompanyId);
    }

    // One-way: only from requesting to target
    return this.requestingCompanyId === requestingCompanyId && this.targetCompanyId === targetCompanyId;
  }

  // Settings updates
  updateSettings(settings) {
    if (settings.commissionRate !== undefined) {
      this.commissionRate = settings.commissionRate;
    }
    
    if (settings.allowedServices !== undefined) {
      this.allowedServices = settings.allowedServices;
    }
    
    if (settings.coverageAreas !== undefined) {
      this.coverageAreas = settings.coverageAreas;
    }
    
    if (settings.maxRidesPerDay !== undefined) {
      this.maxRidesPerDay = settings.maxRidesPerDay;
    }
    
    if (settings.maxRidesPerMonth !== undefined) {
      this.maxRidesPerMonth = settings.maxRidesPerMonth;
    }
    
    if (settings.autoAcceptRides !== undefined) {
      this.autoAcceptRides = settings.autoAcceptRides;
    }
    
    if (settings.priority !== undefined) {
      this.priority = settings.priority;
    }

    this.updatedAt = new Date();
  }

  // Database methoden
  toDatabase() {
    return {
      id: this.id,
      requesting_company_id: this.requestingCompanyId,
      target_company_id: this.targetCompanyId,
      status: this.status,
      partnership_type: this.partnershipType,
      commission_rate: this.commissionRate,
      allowed_services: JSON.stringify(this.allowedServices),
      coverage_areas: JSON.stringify(this.coverageAreas),
      max_rides_per_day: this.maxRidesPerDay,
      max_rides_per_month: this.maxRidesPerMonth,
      auto_accept_rides: this.autoAcceptRides,
      priority: this.priority,
      notes: this.notes,
      terms_accepted_at: this.termsAcceptedAt,
      suspended_at: this.suspendedAt,
      suspension_reason: this.suspensionReason,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  static fromDatabase(row) {
    if (!row) return null;

    return new CompanyPartnership({
      id: row.id,
      requestingCompanyId: row.requesting_company_id,
      targetCompanyId: row.target_company_id,
      status: row.status,
      partnershipType: row.partnership_type,
      commissionRate: parseFloat(row.commission_rate),
      allowedServices: row.allowed_services ? JSON.parse(row.allowed_services) : [],
      coverageAreas: row.coverage_areas ? JSON.parse(row.coverage_areas) : [],
      maxRidesPerDay: row.max_rides_per_day,
      maxRidesPerMonth: row.max_rides_per_month,
      autoAcceptRides: row.auto_accept_rides,
      priority: row.priority,
      notes: row.notes,
      termsAcceptedAt: row.terms_accepted_at,
      suspendedAt: row.suspended_at,
      suspensionReason: row.suspension_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  // API response methoden
  toJSON() {
    return {
      id: this.id,
      requestingCompanyId: this.requestingCompanyId,
      targetCompanyId: this.targetCompanyId,
      status: this.status,
      partnershipType: this.partnershipType,
      commissionRate: this.commissionRate,
      allowedServices: this.allowedServices,
      coverageAreas: this.coverageAreas,
      maxRidesPerDay: this.maxRidesPerDay,
      maxRidesPerMonth: this.maxRidesPerMonth,
      autoAcceptRides: this.autoAcceptRides,
      priority: this.priority,
      notes: this.notes,
      termsAcceptedAt: this.termsAcceptedAt,
      suspendedAt: this.suspendedAt,
      suspensionReason: this.suspensionReason,
      isActive: this.isActive(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toPublicJSON() {
    return {
      id: this.id,
      status: this.status,
      partnershipType: this.partnershipType,
      allowedServices: this.allowedServices,
      isActive: this.isActive(),
      createdAt: this.createdAt
    };
  }
}

module.exports = CompanyPartnership;