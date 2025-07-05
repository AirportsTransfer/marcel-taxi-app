const { v4: uuidv4 } = require('uuid');

class NoShow {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.rideId = data.rideId || null;
    this.customerId = data.customerId || null;
    this.driverId = data.driverId || null;
    this.companyId = data.companyId || null;
    this.type = data.type || 'customer'; // customer, driver
    this.waitTime = data.waitTime || 0; // in minutes
    this.maxWaitTime = data.maxWaitTime || 10; // in minutes
    this.penalty = data.penalty || 0; // penalty amount
    this.reason = data.reason || '';
    this.evidence = data.evidence || []; // photos, GPS logs, etc.
    this.status = data.status || 'pending'; // pending, confirmed, disputed, resolved
    this.reportedAt = data.reportedAt || new Date();
    this.confirmedAt = data.confirmedAt || null;
    this.resolvedAt = data.resolvedAt || null;
    this.notes = data.notes || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
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

    if (!['customer', 'driver'].includes(this.type)) {
      errors.push('Ongeldige no-show type');
    }

    if (this.waitTime < 0) {
      errors.push('Wachttijd kan niet negatief zijn');
    }

    if (this.penalty < 0) {
      errors.push('Boete kan niet negatief zijn');
    }

    return errors;
  }

  // Status methoden
  isPending() {
    return this.status === 'pending';
  }

  isConfirmed() {
    return this.status === 'confirmed';
  }

  isDisputed() {
    return this.status === 'disputed';
  }

  isResolved() {
    return this.status === 'resolved';
  }

  confirm() {
    this.status = 'confirmed';
    this.confirmedAt = new Date();
    this.updatedAt = new Date();
  }

  dispute(reason) {
    this.status = 'disputed';
    this.reason = reason;
    this.updatedAt = new Date();
  }

  resolve(resolution) {
    this.status = 'resolved';
    this.resolvedAt = new Date();
    this.notes = resolution;
    this.updatedAt = new Date();
  }

  // Penalty methoden
  calculatePenalty(rateCard) {
    if (this.type === 'customer') {
      // Klant penalty
      this.penalty = rateCard.customerNoShowPenalty || 15.00;
    } else if (this.type === 'driver') {
      // Chauffeur penalty
      this.penalty = rateCard.driverNoShowPenalty || 25.00;
    }

    return this.penalty;
  }

  // Evidence methoden
  addEvidence(evidence) {
    this.evidence.push({
      id: uuidv4(),
      type: evidence.type, // photo, gps, timestamp, note
      data: evidence.data,
      timestamp: new Date()
    });
    this.updatedAt = new Date();
  }

  // Database methoden
  toDatabase() {
    return {
      id: this.id,
      ride_id: this.rideId,
      customer_id: this.customerId,
      driver_id: this.driverId,
      company_id: this.companyId,
      type: this.type,
      wait_time: this.waitTime,
      max_wait_time: this.maxWaitTime,
      penalty: this.penalty,
      reason: this.reason,
      evidence: JSON.stringify(this.evidence),
      status: this.status,
      reported_at: this.reportedAt,
      confirmed_at: this.confirmedAt,
      resolved_at: this.resolvedAt,
      notes: this.notes,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  static fromDatabase(row) {
    if (!row) return null;

    return new NoShow({
      id: row.id,
      rideId: row.ride_id,
      customerId: row.customer_id,
      driverId: row.driver_id,
      companyId: row.company_id,
      type: row.type,
      waitTime: row.wait_time,
      maxWaitTime: row.max_wait_time,
      penalty: row.penalty,
      reason: row.reason,
      evidence: row.evidence ? JSON.parse(row.evidence) : [],
      status: row.status,
      reportedAt: row.reported_at,
      confirmedAt: row.confirmed_at,
      resolvedAt: row.resolved_at,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  // API response methoden
  toJSON() {
    return {
      id: this.id,
      rideId: this.rideId,
      customerId: this.customerId,
      driverId: this.driverId,
      type: this.type,
      waitTime: this.waitTime,
      maxWaitTime: this.maxWaitTime,
      penalty: this.penalty,
      reason: this.reason,
      status: this.status,
      reportedAt: this.reportedAt,
      confirmedAt: this.confirmedAt,
      resolvedAt: this.resolvedAt,
      notes: this.notes,
      createdAt: this.createdAt
    };
  }
}

module.exports = NoShow;