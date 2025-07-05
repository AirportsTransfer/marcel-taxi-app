
class Vehicle {
  constructor(data = {}) {
    this.id = data.id || null;
    this.licensePlate = data.licensePlate || '';
    this.brand = data.brand || '';
    this.model = data.model || '';
    this.year = data.year || new Date().getFullYear();
    this.color = data.color || '';
    this.seats = data.seats || 4;
    this.vehicleType = data.vehicleType || 'sedan'; // sedan, suv, van, luxury
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.driverId = data.driverId || null;
    this.companyId = data.companyId || null;
    this.features = data.features || []; // ['airco', 'wifi', 'childSeat']
    this.fuelType = data.fuelType || 'benzine'; // benzine, diesel, electric, hybrid
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Validatie methoden
  validate() {
    const errors = [];
    
    if (!this.licensePlate || this.licensePlate.length < 6) {
      errors.push('Kenteken is verplicht en minimaal 6 tekens');
    }
    
    if (!this.brand || this.brand.length < 2) {
      errors.push('Merk is verplicht');
    }
    
    if (!this.model || this.model.length < 1) {
      errors.push('Model is verplicht');
    }
    
    if (this.seats < 1 || this.seats > 50) {
      errors.push('Aantal zitplaatsen moet tussen 1 en 50 zijn');
    }
    
    return errors;
  }

  // Utility methoden
  isLuxury() {
    return this.vehicleType === 'luxury';
  }

  canCarryLuggage() {
    return ['suv', 'van', 'luxury'].includes(this.vehicleType);
  }

  getCapacityMultiplier() {
    const multipliers = {
      'sedan': 1.0,
      'suv': 1.2,
      'van': 1.5,
      'luxury': 1.8
    };
    return multipliers[this.vehicleType] || 1.0;
  }

  hasFeature(feature) {
    return this.features.includes(feature);
  }

  // Database methoden
  toDatabase() {
    return {
      id: this.id,
      license_plate: this.licensePlate,
      brand: this.brand,
      model: this.model,
      year: this.year,
      color: this.color,
      seats: this.seats,
      vehicle_type: this.vehicleType,
      is_active: this.isActive,
      driver_id: this.driverId,
      company_id: this.companyId,
      features: JSON.stringify(this.features),
      fuel_type: this.fuelType,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  static fromDatabase(row) {
    if (!row) return null;
    
    return new Vehicle({
      id: row.id,
      licensePlate: row.license_plate,
      brand: row.brand,
      model: row.model,
      year: row.year,
      color: row.color,
      seats: row.seats,
      vehicleType: row.vehicle_type,
      isActive: row.is_active,
      driverId: row.driver_id,
      companyId: row.company_id,
      features: row.features ? JSON.parse(row.features) : [],
      fuelType: row.fuel_type,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  // API response methoden
  toJSON() {
    return {
      id: this.id,
      licensePlate: this.licensePlate,
      brand: this.brand,
      model: this.model,
      year: this.year,
      color: this.color,
      seats: this.seats,
      vehicleType: this.vehicleType,
      isActive: this.isActive,
      features: this.features,
      fuelType: this.fuelType,
      displayName: `${this.brand} ${this.model} (${this.year})`
    };
  }

  toPublicJSON() {
    return {
      brand: this.brand,
      model: this.model,
      color: this.color,
      seats: this.seats,
      vehicleType: this.vehicleType,
      features: this.features,
      displayName: `${this.brand} ${this.model}`
    };
  }
}

module.exports = Vehicle;