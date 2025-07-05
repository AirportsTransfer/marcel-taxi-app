const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class User {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.email = data.email || '';
    this.password = data.password || '';
    this.firstName = data.firstName || '';
    this.lastName = data.lastName || '';
    this.phone = data.phone || '';
    this.role = data.role || 'customer'; // customer, driver, admin, dispatcher
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.isVerified = data.isVerified !== undefined ? data.isVerified : false;
    this.companyId = data.companyId || null;
    this.preferences = data.preferences || {};
    this.profileImage = data.profileImage || null;
    this.language = data.language || 'nl';
    this.timezone = data.timezone || 'Europe/Amsterdam';
    this.lastLoginAt = data.lastLoginAt || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Validatie methoden
  validate() {
    const errors = [];

    if (!this.email || !this.isValidEmail(this.email)) {
      errors.push('Geldig email adres is verplicht');
    }

    if (!this.firstName || this.firstName.length < 2) {
      errors.push('Voornaam is verplicht (minimaal 2 tekens)');
    }

    if (!this.lastName || this.lastName.length < 2) {
      errors.push('Achternaam is verplicht (minimaal 2 tekens)');
    }

    if (!this.phone || !this.isValidPhone(this.phone)) {
      errors.push('Geldig telefoonnummer is verplicht');
    }

    if (!['customer', 'driver', 'admin', 'dispatcher'].includes(this.role)) {
      errors.push('Ongeldige gebruikersrol');
    }

    return errors;
  }

  validatePassword(password) {
    const errors = [];

    if (!password || password.length < 8) {
      errors.push('Wachtwoord moet minimaal 8 tekens bevatten');
    }

    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Wachtwoord moet minimaal één kleine letter bevatten');
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Wachtwoord moet minimaal één hoofdletter bevatten');
    }

    if (!/(?=.*\d)/.test(password)) {
      errors.push('Wachtwoord moet minimaal één cijfer bevatten');
    }

    return errors;
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPhone(phone) {
    const phoneRegex = /^(\+31|0)[1-9]\d{8}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  // Wachtwoord methoden
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(password, salt);
  }

  async comparePassword(password) {
    return await bcrypt.compare(password, this.password);
  }

  // Utility methoden
  getFullName() {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  getInitials() {
    return `${this.firstName.charAt(0)}${this.lastName.charAt(0)}`.toUpperCase();
  }

  isDriver() {
    return this.role === 'driver';
  }

  isCustomer() {
    return this.role === 'customer';
  }

  isAdmin() {
    return this.role === 'admin';
  }

  isDispatcher() {
    return this.role === 'dispatcher';
  }

  canManageCompany() {
    return ['admin', 'dispatcher'].includes(this.role);
  }

  updateLastLogin() {
    this.lastLoginAt = new Date();
  }

  setPreference(key, value) {
    this.preferences[key] = value;
    this.updatedAt = new Date();
  }

  getPreference(key, defaultValue = null) {
    return this.preferences[key] || defaultValue;
  }

  // Database methoden
  toDatabase() {
    return {
      id: this.id,
      email: this.email,
      password: this.password,
      first_name: this.firstName,
      last_name: this.lastName,
      phone: this.phone,
      role: this.role,
      is_active: this.isActive,
      is_verified: this.isVerified,
      company_id: this.companyId,
      preferences: JSON.stringify(this.preferences),
      profile_image: this.profileImage,
      language: this.language,
      timezone: this.timezone,
      last_login_at: this.lastLoginAt,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  static fromDatabase(row) {
    if (!row) return null;

    return new User({
      id: row.id,
      email: row.email,
      password: row.password,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      role: row.role,
      isActive: row.is_active,
      isVerified: row.is_verified,
      companyId: row.company_id,
      preferences: row.preferences ? JSON.parse(row.preferences) : {},
      profileImage: row.profile_image,
      language: row.language,
      timezone: row.timezone,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  // API response methoden
  toJSON() {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      fullName: this.getFullName(),
      phone: this.phone,
      role: this.role,
      isActive: this.isActive,
      isVerified: this.isVerified,
      companyId: this.companyId,
      preferences: this.preferences,
      profileImage: this.profileImage,
      language: this.language,
      timezone: this.timezone,
      lastLoginAt: this.lastLoginAt,
      createdAt: this.createdAt
    };
  }

  toPublicJSON() {
    return {
      id: this.id,
      firstName: this.firstName,
      lastName: this.lastName,
      fullName: this.getFullName(),
      initials: this.getInitials(),
      role: this.role,
      profileImage: this.profileImage,
      isVerified: this.isVerified
    };
  }

  toAuthJSON() {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      fullName: this.getFullName(),
      role: this.role,
      companyId: this.companyId,
      preferences: this.preferences,
      language: this.language,
      timezone: this.timezone
    };
  }

  toDriverJSON() {
    if (!this.isDriver()) return null;

    return {
      id: this.id,
      firstName: this.firstName,
      lastName: this.lastName,
      fullName: this.getFullName(),
      phone: this.phone,
      profileImage: this.profileImage,
      isVerified: this.isVerified,
      rating: this.getPreference('rating', 0),
      totalRides: this.getPreference('totalRides', 0)
    };
  }
}

module.exports = User;