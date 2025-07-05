const { v4: uuidv4 } = require('uuid');

class Company {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.name = data.name || '';
    this.subdomain = data.subdomain || '';
    this.email = data.email || '';
    this.phone = data.phone || '';
    this.address = data.address || '';
    this.city = data.city || '';
    this.postalCode = data.postalCode || '';
    this.country = data.country || 'NL';
    this.vatNumber = data.vatNumber || '';
    this.chamberOfCommerce = data.chamberOfCommerce || '';
    this.website = data.website || '';
    this.description = data.description || '';
    this.logoUrl = data.logoUrl || '';
    this.primaryColor = data.primaryColor || '#1976d2';
    this.secondaryColor = data.secondaryColor || '#ffffff';
    this.settings = data.settings || {};
    this.rateCard = data.rateCard || {};
    this.features = data.features || [];
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.isVerified = data.isVerified !== undefined ? data.isVerified : false;
    this.subscriptionPlan = data.subscriptionPlan || 'basic';
    this.subscriptionExpiresAt = data.subscriptionExpiresAt || null;
    this.monthlyFee = data.monthlyFee || 0;
    this.commissionRate = data.commissionRate || 0;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Validatie methoden
  validate() {
    const errors = [];

    if (!this.name || this.name.length < 2) {
      errors.push('Bedrijfsnaam is verplicht (minimaal 2 tekens)');
    }

    if (!this.subdomain || !this.isValidSubdomain(this.subdomain)) {
      errors.push('Geldige subdomain is verplicht (alleen letters, cijfers en hyphens)');
    }

    if (!this.email || !this.isValidEmail(this.email)) {
      errors.push('Geldig email adres is verplicht');
    }

    if (!this.phone || !this.isValidPhone(this.phone)) {
      errors.push('Geldig telefoonnummer is verplicht');
    }

    if (!this.address || this.address.length < 5) {
      errors.push('Adres is verplicht');
    }

    if (!this.city || this.city.length < 2) {
      errors.push('Stad is verplicht');
    }

    if (!this.postalCode || !this.isValidPostalCode(this.postalCode)) {
      errors.push('Geldige postcode is verplicht');
    }

    return errors;
  }

  isValidSubdomain(subdomain) {
    const regex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    return regex.test(subdomain) && subdomain.length >= 3 && subdomain.length <= 30;
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPhone(phone) {
    const phoneRegex = /^(\+31|0)[1-9]\d{8}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  isValidPostalCode(postalCode) {
    const regex = /^[1-9][0-9]{3}\s?[a-zA-Z]{2}$/;
    return regex.test(postalCode);
  }

  // Subscription methoden
  isSubscriptionActive() {
    if (!this.subscriptionExpiresAt) return true;
    return new Date() < new Date(this.subscriptionExpiresAt);
  }

  isBasicPlan() {
    return this.subscriptionPlan === 'basic';
  }

  isProfessionalPlan() {
    return this.subscriptionPlan === 'professional';
  }

  isEnterprisePlan() {
    return this.subscriptionPlan === 'enterprise';
  }

  canUseFeature(feature) {
    const planFeatures = {
      basic: ['basic_booking', 'email_notifications', 'basic_reporting'],
      professional: ['basic_booking', 'email_notifications', 'basic_reporting', 'sms_notifications', 'advanced_reporting', 'api_access', 'custom_branding'],
      enterprise: ['basic_booking', 'email_notifications', 'basic_reporting', 'sms_notifications', 'advanced_reporting', 'api_access', 'custom_branding', 'white_label', 'priority_support', 'custom_integrations']
    };

    const allowedFeatures = planFeatures[this.subscriptionPlan] || [];
    return allowedFeatures.includes(feature);
  }

  // Branding methoden
  getBrandingConfig() {
    return {
      name: this.name,
      logo: this.logoUrl,
      primaryColor: this.primaryColor,
      secondaryColor: this.secondaryColor,
      subdomain: this.subdomain,
      customDomain: this.getSetting('customDomain'),
      favicon: this.getSetting('favicon'),
      appleTouchIcon: this.getSetting('appleTouchIcon')
    };
  }

  getAppConfig() {
    return {
      appName: this.name,
      bundleId: `com.${this.subdomain.replace('-', '')}.taxiapp`,
      displayName: this.name,
      primaryColor: this.primaryColor,
      secondaryColor: this.secondaryColor,
      logo: this.logoUrl,
      splashScreen: this.getSetting('splashScreen'),
      features: this.features
    };
  }

  // Settings methoden
  setSetting(key, value) {
    this.settings[key] = value;
    this.updatedAt = new Date();
  }

  getSetting(key, defaultValue = null) {
    return this.settings[key] || defaultValue;
  }

  // Rate card methoden
  setRateCard(rateCard) {
    this.rateCard = {
      baseFare: rateCard.baseFare || 2.50,
      perKm: rateCard.perKm || 1.20,
      perMinute: rateCard.perMinute || 0.35,
      luggageFee: rateCard.luggageFee || 2.00,
      extraStopFee: rateCard.extraStopFee || 3.00,
      bookingFee: rateCard.bookingFee || 1.00,
      cancellationFee: rateCard.cancellationFee || 5.00,
      customerNoShowPenalty: rateCard.customerNoShowPenalty || 15.00,
      driverNoShowPenalty: rateCard.driverNoShowPenalty || 25.00,
      longDistanceDiscount: rateCard.longDistanceDiscount || 0.10,
      discountAfterKm: rateCard.discountAfterKm || 50,
      nightSurcharge: rateCard.nightSurcharge || 0.20,
      nightSurchargeStart: rateCard.nightSurchargeStart || '22:00',
      nightSurchargeEnd: rateCard.nightSurchargeEnd || '06:00',
      ...rateCard
    };
    this.updatedAt = new Date();
  }

  getRateCard() {
    return this.rateCard;
  }

  // URL methoden
  getAppURL() {
    return `https://${this.subdomain}.taxiapp.com`;
  }

  getCustomerAppURL() {
    return `${this.getAppURL()}/customer`;
  }

  getDriverAppURL() {
    return `${this.getAppURL()}/driver`;
  }

  getAdminURL() {
    return `${this.getAppURL()}/admin`;
  }

  // Database methoden
  toDatabase() {
    return {
      id: this.id,
      name: this.name,
      subdomain: this.subdomain,
      email: this.email,
      phone: this.phone,
      address: this.address,
      city: this.city,
      postal_code: this.postalCode,
      country: this.country,
      vat_number: this.vatNumber,
      chamber_of_commerce: this.chamberOfCommerce,
      website: this.website,
      description: this.description,
      logo_url: this.logoUrl,
      primary_color: this.primaryColor,
      secondary_color: this.secondaryColor,
      settings: JSON.stringify(this.settings),
      rate_card: JSON.stringify(this.rateCard),
      features: JSON.stringify(this.features),
      is_active: this.isActive,
      is_verified: this.isVerified,
      subscription_plan: this.subscriptionPlan,
      subscription_expires_at: this.subscriptionExpiresAt,
      monthly_fee: this.monthlyFee,
      commission_rate: this.commissionRate,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  static fromDatabase(row) {
    if (!row) return null;

    return new Company({
      id: row.id,
      name: row.name,
      subdomain: row.subdomain,
      email: row.email,
      phone: row.phone,
      address: row.address,
      city: row.city,
      postalCode: row.postal_code,
      country: row.country,
      vatNumber: row.vat_number,
      chamberOfCommerce: row.chamber_of_commerce,
      website: row.website,
      description: row.description,
      logoUrl: row.logo_url,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      settings: row.settings ? JSON.parse(row.settings) : {},
      rateCard: row.rate_card ? JSON.parse(row.rate_card) : {},
      features: row.features ? JSON.parse(row.features) : [],
      isActive: row.is_active,
      isVerified: row.is_verified,
      subscriptionPlan: row.subscription_plan,
      subscriptionExpiresAt: row.subscription_expires_at,
      monthlyFee: row.monthly_fee,
      commissionRate: row.commission_rate,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  // API response methoden
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      subdomain: this.subdomain,
      email: this.email,
      phone: this.phone,
      address: this.address,
      city: this.city,
      postalCode: this.postalCode,
      country: this.country,
      website: this.website,
      description: this.description,
      logoUrl: this.logoUrl,
      primaryColor: this.primaryColor,
      secondaryColor: this.secondaryColor,
      features: this.features,
      isActive: this.isActive,
      isVerified: this.isVerified,
      subscriptionPlan: this.subscriptionPlan,
      subscriptionExpiresAt: this.subscriptionExpiresAt,
      isSubscriptionActive: this.isSubscriptionActive(),
      appURL: this.getAppURL(),
      createdAt: this.createdAt
    };
  }

  toPublicJSON() {
    return {
      name: this.name,
      subdomain: this.subdomain,
      logoUrl: this.logoUrl,
      primaryColor: this.primaryColor,
      secondaryColor: this.secondaryColor,
      website: this.website,
      description: this.description,
      features: this.features,
      isActive: this.isActive
    };
  }

  toBrandingJSON() {
    return {
      name: this.name,
      logo: this.logoUrl,
      primaryColor: this.primaryColor,
      secondaryColor: this.secondaryColor,
      subdomain: this.subdomain,
      customDomain: this.getSetting('customDomain'),
      favicon: this.getSetting('favicon'),
      appleTouchIcon: this.getSetting('appleTouchIcon')
    };
  }
}

module.exports = Company;