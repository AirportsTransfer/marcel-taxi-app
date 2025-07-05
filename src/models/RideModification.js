const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class RideModification {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.rideId = data.rideId || null;
    this.customerId = data.customerId || null;
    this.token = data.token || this.generateToken();
    this.expiresAt = data.expiresAt || this.getDefaultExpiry();
    this.modifications = data.modifications || {};
    this.originalData = data.originalData || {};
    this.status = data.status || 'pending'; // pending, applied, expired, cancelled
    this.reason = data.reason || '';
    this.appliedAt = data.appliedAt || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Token methoden
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  getDefaultExpiry() {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24); // 24 uur geldig
    return expiry;
  }

  isExpired() {
    return new Date() > this.expiresAt;
  }

  isValid() {
    return this.status === 'pending' && !this.isExpired();
  }

  // Validatie methoden
  validate() {
    const errors = [];

    if (!this.rideId) {
      errors.push('Rit ID is verplicht');
    }

    if (!this.customerId) {
      errors.push('Klant ID is verplicht');
    }

    if (!this.token) {
      errors.push('Token is verplicht');
    }

    if (this.isExpired()) {
      errors.push('Modificatie link is verlopen');
    }

    return errors;
  }

  validateModifications() {
    const errors = [];
    const allowedFields = ['scheduledAt', 'pickupLocation', 'dropoffLocation', 'passengers', 'luggage', 'specialRequests'];

    // Controleer of alleen toegestane velden worden gewijzigd
    Object.keys(this.modifications).forEach(field => {
      if (!allowedFields.includes(field)) {
        errors.push(`Veld '${field}' mag niet worden gewijzigd`);
      }
    });

    // Valideer datum/tijd wijzigingen
    if (this.modifications.scheduledAt) {
      const newDateTime = new Date(this.modifications.scheduledAt);
      const now = new Date();
      
      if (newDateTime < now) {
        errors.push('Nieuwe datum/tijd kan niet in het verleden liggen');
      }

      // Minimaal 2 uur van tevoren
      const minimumTime = new Date(now.getTime() + (2 * 60 * 60 * 1000));
      if (newDateTime < minimumTime) {
        errors.push('Wijzigingen moeten minimaal 2 uur van tevoren worden doorgegeven');
      }
    }

    // Valideer aantal passagiers
    if (this.modifications.passengers) {
      if (this.modifications.passengers < 1 || this.modifications.passengers > 8) {
        errors.push('Aantal passagiers moet tussen 1 en 8 zijn');
      }
    }

    // Valideer aantal bagage
    if (this.modifications.luggage) {
      if (this.modifications.luggage < 0 || this.modifications.luggage > 10) {
        errors.push('Aantal bagage moet tussen 0 en 10 zijn');
      }
    }

    return errors;
  }

  // Modificatie methoden
  addModification(field, value, originalValue) {
    this.modifications[field] = value;
    this.originalData[field] = originalValue;
    this.updatedAt = new Date();
  }

  removeModification(field) {
    delete this.modifications[field];
    delete this.originalData[field];
    this.updatedAt = new Date();
  }

  hasModification(field) {
    return this.modifications.hasOwnProperty(field);
  }

  getModificationSummary() {
    const summary = [];

    if (this.hasModification('scheduledAt')) {
      const oldDate = new Date(this.originalData.scheduledAt);
      const newDate = new Date(this.modifications.scheduledAt);
      summary.push(`Datum/tijd: ${oldDate.toLocaleString('nl-NL')} → ${newDate.toLocaleString('nl-NL')}`);
    }

    if (this.hasModification('pickupLocation')) {
      summary.push(`Ophaallocatie: ${this.originalData.pickupLocation.address} → ${this.modifications.pickupLocation.address}`);
    }

    if (this.hasModification('dropoffLocation')) {
      summary.push(`Bestemmingslocatie: ${this.originalData.dropoffLocation.address} → ${this.modifications.dropoffLocation.address}`);
    }

    if (this.hasModification('passengers')) {
      summary.push(`Passagiers: ${this.originalData.passengers} → ${this.modifications.passengers}`);
    }

    if (this.hasModification('luggage')) {
      summary.push(`Bagage: ${this.originalData.luggage} → ${this.modifications.luggage}`);
    }

    if (this.hasModification('specialRequests')) {
      summary.push(`Speciale verzoeken: ${this.originalData.specialRequests || 'Geen'} → ${this.modifications.specialRequests || 'Geen'}`);
    }

    return summary;
  }

  // Status methoden
  isPending() {
    return this.status === 'pending';
  }

  isApplied() {
    return this.status === 'applied';
  }

  isExpiredStatus() {
    return this.status === 'expired';
  }

  isCancelled() {
    return this.status === 'cancelled';
  }

  apply() {
    if (!this.isValid()) {
      throw new Error('Modificatie kan niet worden toegepast');
    }

    this.status = 'applied';
    this.appliedAt = new Date();
    this.updatedAt = new Date();
  }

  expire() {
    this.status = 'expired';
    this.updatedAt = new Date();
  }

  cancel(reason) {
    this.status = 'cancelled';
    this.reason = reason;
    this.updatedAt = new Date();
  }

  // URL methoden
  getModificationURL(baseURL = 'https://yourdomain.com') {
    return `${baseURL}/modify-ride/${this.token}`;
  }

  // Database methoden
  toDatabase() {
    return {
      id: this.id,
      ride_id: this.rideId,
      customer_id: this.customerId,
      token: this.token,
      expires_at: this.expiresAt,
      modifications: JSON.stringify(this.modifications),
      original_data: JSON.stringify(this.originalData),
      status: this.status,
      reason: this.reason,
      applied_at: this.appliedAt,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  static fromDatabase(row) {
    if (!row) return null;

    return new RideModification({
      id: row.id,
      rideId: row.ride_id,
      customerId: row.customer_id,
      token: row.token,
      expiresAt: row.expires_at,
      modifications: row.modifications ? JSON.parse(row.modifications) : {},
      originalData: row.original_data ? JSON.parse(row.original_data) : {},
      status: row.status,
      reason: row.reason,
      appliedAt: row.applied_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  // API response methoden
  toJSON() {
    return {
      id: this.id,
      rideId: this.rideId,
      token: this.token,
      expiresAt: this.expiresAt,
      modifications: this.modifications,
      originalData: this.originalData,
      status: this.status,
      reason: this.reason,
      appliedAt: this.appliedAt,
      modificationSummary: this.getModificationSummary(),
      isValid: this.isValid(),
      isExpired: this.isExpired(),
      createdAt: this.createdAt
    };
  }

  toCustomerJSON() {
    return {
      rideId: this.rideId,
      modifications: this.modifications,
      originalData: this.originalData,
      status: this.status,
      expiresAt: this.expiresAt,
      modificationSummary: this.getModificationSummary(),
      isValid: this.isValid(),
      isExpired: this.isExpired()
    };
  }
}

module.exports = RideModification;