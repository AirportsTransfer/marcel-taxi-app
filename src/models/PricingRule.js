const { v4: uuidv4 } = require('uuid');

class PricingRule {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.name = data.name || '';
    this.type = data.type || 'postcode'; // postcode, location, zone
    this.fromLocation = data.fromLocation || {};
    this.toLocation = data.toLocation || {};
    this.fixedPrice = data.fixedPrice || 0;
    this.priority = data.priority || 1; // Higher number = higher priority
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.validFrom = data.validFrom || null;
    this.validUntil = data.validUntil || null;
    this.dayOfWeek = data.dayOfWeek || []; // [0,1,2,3,4,5,6] Sunday=0
    this.timeFrom = data.timeFrom || null; // '09:00'
    this.timeUntil = data.timeUntil || null; // '17:00'
    this.vehicleTypes = data.vehicleTypes || []; // ['sedan', 'suv', 'van', 'luxury']
    this.minimumDistance = data.minimumDistance || 0;
    this.maximumDistance = data.maximumDistance || 999;
    this.notes = data.notes || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Validatie methoden
  validate() {
    const errors = [];

    if (!this.name || this.name.length < 3) {
      errors.push('Naam is verplicht (minimaal 3 tekens)');
    }

    if (!['postcode', 'location', 'zone'].includes(this.type)) {
      errors.push('Ongeldig type');
    }

    if (this.fixedPrice <= 0) {
      errors.push('Vaste prijs moet groter zijn dan 0');
    }

    if (this.type === 'postcode') {
      if (!this.fromLocation.postcode || !this.toLocation.postcode) {
        errors.push('Van en naar postcode zijn verplicht');
      }
    }

    if (this.type === 'location') {
      if (!this.fromLocation.name || !this.toLocation.name) {
        errors.push('Van en naar locatie namen zijn verplicht');
      }
    }

    if (this.priority < 1 || this.priority > 100) {
      errors.push('Prioriteit moet tussen 1 en 100 zijn');
    }

    return errors;
  }

  // Location matching methoden
  matchesRoute(fromLocation, toLocation) {
    if (!this.isActive) return false;

    // Check time validity
    if (!this.isValidAtTime(new Date())) return false;

    // Check based on type
    switch (this.type) {
      case 'postcode':
        return this.matchesPostcodeRoute(fromLocation, toLocation);
      case 'location':
        return this.matchesLocationRoute(fromLocation, toLocation);
      case 'zone':
        return this.matchesZoneRoute(fromLocation, toLocation);
      default:
        return false;
    }
  }

  matchesPostcodeRoute(fromLocation, toLocation) {
    const fromPostcode = this.extractPostcode(fromLocation.address || fromLocation.postcode);
    const toPostcode = this.extractPostcode(toLocation.address || toLocation.postcode);

    if (!fromPostcode || !toPostcode) return false;

    // Exact match
    if (this.fromLocation.postcode === fromPostcode && this.toLocation.postcode === toPostcode) {
      return true;
    }

    // Reverse match (if bidirectional)
    if (this.fromLocation.bidirectional && 
        this.fromLocation.postcode === toPostcode && 
        this.toLocation.postcode === fromPostcode) {
      return true;
    }

    // Pattern match (e.g., 101* matches 1012, 1015, etc.)
    if (this.fromLocation.postcode.includes('*') || this.toLocation.postcode.includes('*')) {
      return this.matchesPostcodePattern(fromPostcode, toPostcode);
    }

    return false;
  }

  matchesLocationRoute(fromLocation, toLocation) {
    // Check if locations match by name or coordinates
    const fromMatches = this.matchesLocationPoint(fromLocation, this.fromLocation);
    const toMatches = this.matchesLocationPoint(toLocation, this.toLocation);

    if (fromMatches && toMatches) return true;

    // Check reverse if bidirectional
    if (this.fromLocation.bidirectional) {
      const fromMatchesReverse = this.matchesLocationPoint(fromLocation, this.toLocation);
      const toMatchesReverse = this.matchesLocationPoint(toLocation, this.fromLocation);
      if (fromMatchesReverse && toMatchesReverse) return true;
    }

    return false;
  }

  matchesZoneRoute(fromLocation, toLocation) {
    // Zone-based pricing (e.g., Airport zone to City center zone)
    const fromZone = this.getLocationZone(fromLocation);
    const toZone = this.getLocationZone(toLocation);

    return fromZone === this.fromLocation.zone && toZone === this.toLocation.zone;
  }

  matchesLocationPoint(location, ruleLocation) {
    // Match by name (case insensitive)
    if (ruleLocation.name && location.address) {
      const locationName = location.address.toLowerCase();
      const ruleName = ruleLocation.name.toLowerCase();
      if (locationName.includes(ruleName) || ruleName.includes(locationName)) {
        return true;
      }
    }

    // Match by coordinates (within radius)
    if (ruleLocation.latitude && ruleLocation.longitude && 
        location.latitude && location.longitude) {
      const distance = this.calculateDistance(
        location.latitude, location.longitude,
        ruleLocation.latitude, ruleLocation.longitude
      );
      const radius = ruleLocation.radius || 1; // 1km default radius
      return distance <= radius;
    }

    return false;
  }

  matchesPostcodePattern(fromPostcode, toPostcode) {
    const fromPattern = this.fromLocation.postcode.replace('*', '\\d*');
    const toPattern = this.toLocation.postcode.replace('*', '\\d*');
    
    const fromRegex = new RegExp(`^${fromPattern}$`);
    const toRegex = new RegExp(`^${toPattern}$`);
    
    return fromRegex.test(fromPostcode) && toRegex.test(toPostcode);
  }

  // Time validation
  isValidAtTime(dateTime) {
    const now = new Date(dateTime);

    // Check date range
    if (this.validFrom && now < new Date(this.validFrom)) return false;
    if (this.validUntil && now > new Date(this.validUntil)) return false;

    // Check day of week
    if (this.dayOfWeek.length > 0 && !this.dayOfWeek.includes(now.getDay())) return false;

    // Check time range
    if (this.timeFrom || this.timeUntil) {
      const currentTime = now.getHours() * 100 + now.getMinutes(); // e.g., 1430 for 14:30
      const fromTime = this.timeFrom ? this.parseTime(this.timeFrom) : 0;
      const untilTime = this.timeUntil ? this.parseTime(this.timeUntil) : 2359;

      if (currentTime < fromTime || currentTime > untilTime) return false;
    }

    return true;
  }

  parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 100 + minutes;
  }

  // Vehicle type validation
  isValidForVehicle(vehicleType) {
    if (this.vehicleTypes.length === 0) return true;
    return this.vehicleTypes.includes(vehicleType);
  }

  // Distance validation
  isValidForDistance(distance) {
    return distance >= this.minimumDistance && distance <= this.maximumDistance;
  }

  // Utility methoden
  extractPostcode(address) {
    if (!address) return null;
    
    // Dutch postcode pattern: 1234AB or 1234 AB
    const match = address.match(/(\d{4})\s?([A-Z]{2})/i);
    return match ? match[1] : null;
  }

  getLocationZone(location) {
    // Implement zone detection logic based on coordinates or address
    // This could be extended with predefined zones
    if (location.address) {
      if (location.address.toLowerCase().includes('schiphol')) return 'airport';
      if (location.address.toLowerCase().includes('centrum')) return 'city_center';
      if (location.address.toLowerCase().includes('noord')) return 'north';
      if (location.address.toLowerCase().includes('zuid')) return 'south';
    }
    return 'unknown';
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

  // Display methoden
  getDisplayName() {
    switch (this.type) {
      case 'postcode':
        return `${this.fromLocation.postcode} → ${this.toLocation.postcode}`;
      case 'location':
        return `${this.fromLocation.name} → ${this.toLocation.name}`;
      case 'zone':
        return `${this.fromLocation.zone} → ${this.toLocation.zone}`;
      default:
        return this.name;
    }
  }

  getDescription() {
    let desc = `Vaste prijs: €${this.fixedPrice.toFixed(2)}`;
    
    if (this.timeFrom || this.timeUntil) {
      desc += ` (${this.timeFrom || '00:00'} - ${this.timeUntil || '23:59'})`;
    }
    
    if (this.dayOfWeek.length > 0 && this.dayOfWeek.length < 7) {
      const dayNames = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
      const days = this.dayOfWeek.map(d => dayNames[d]).join(', ');
      desc += ` (${days})`;
    }
    
    return desc;
  }

  // Database methoden
  toDatabase() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      from_location: JSON.stringify(this.fromLocation),
      to_location: JSON.stringify(this.toLocation),
      fixed_price: this.fixedPrice,
      priority: this.priority,
      is_active: this.isActive,
      valid_from: this.validFrom,
      valid_until: this.validUntil,
      day_of_week: JSON.stringify(this.dayOfWeek),
      time_from: this.timeFrom,
      time_until: this.timeUntil,
      vehicle_types: JSON.stringify(this.vehicleTypes),
      minimum_distance: this.minimumDistance,
      maximum_distance: this.maximumDistance,
      notes: this.notes,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  static fromDatabase(row) {
    if (!row) return null;

    return new PricingRule({
      id: row.id,
      name: row.name,
      type: row.type,
      fromLocation: row.from_location ? JSON.parse(row.from_location) : {},
      toLocation: row.to_location ? JSON.parse(row.to_location) : {},
      fixedPrice: parseFloat(row.fixed_price),
      priority: row.priority,
      isActive: row.is_active,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      dayOfWeek: row.day_of_week ? JSON.parse(row.day_of_week) : [],
      timeFrom: row.time_from,
      timeUntil: row.time_until,
      vehicleTypes: row.vehicle_types ? JSON.parse(row.vehicle_types) : [],
      minimumDistance: row.minimum_distance,
      maximumDistance: row.maximum_distance,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  // API response methoden
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      fromLocation: this.fromLocation,
      toLocation: this.toLocation,
      fixedPrice: this.fixedPrice,
      priority: this.priority,
      isActive: this.isActive,
      validFrom: this.validFrom,
      validUntil: this.validUntil,
      dayOfWeek: this.dayOfWeek,
      timeFrom: this.timeFrom,
      timeUntil: this.timeUntil,
      vehicleTypes: this.vehicleTypes,
      minimumDistance: this.minimumDistance,
      maximumDistance: this.maximumDistance,
      notes: this.notes,
      displayName: this.getDisplayName(),
      description: this.getDescription(),
      createdAt: this.createdAt
    };
  }

  toPublicJSON() {
    return {
      displayName: this.getDisplayName(),
      description: this.getDescription(),
      fixedPrice: this.fixedPrice,
      type: this.type
    };
  }
}

module.exports = PricingRule;