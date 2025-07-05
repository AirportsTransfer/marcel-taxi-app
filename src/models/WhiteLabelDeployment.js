const { v4: uuidv4 } = require('uuid');

class WhiteLabelDeployment {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.companyId = data.companyId || null;
    this.deploymentType = data.deploymentType || 'hosted'; // hosted, self-hosted, app-store
    this.status = data.status || 'pending'; // pending, configuring, building, testing, deploying, active, failed
    this.platform = data.platform || 'both'; // ios, android, both, web
    this.appName = data.appName || '';
    this.bundleId = data.bundleId || '';
    this.packageName = data.packageName || '';
    this.appVersion = data.appVersion || '1.0.0';
    this.buildNumber = data.buildNumber || 1;
    this.customDomain = data.customDomain || '';
    this.subdomain = data.subdomain || '';
    this.serverUrl = data.serverUrl || '';
    this.databaseUrl = data.databaseUrl || '';
    this.apiKeys = data.apiKeys || {};
    this.branding = data.branding || {};
    this.features = data.features || [];
    this.configurations = data.configurations || {};
    this.buildLogs = data.buildLogs || [];
    this.deploymentLogs = data.deploymentLogs || [];
    this.errorLogs = data.errorLogs || [];
    this.deployedAt = data.deployedAt || null;
    this.lastUpdateAt = data.lastUpdateAt || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Validatie methoden
  validate() {
    const errors = [];

    if (!this.companyId) {
      errors.push('Bedrijf ID is verplicht');
    }

    if (!this.appName || this.appName.length < 2) {
      errors.push('App naam is verplicht');
    }

    if (!['hosted', 'self-hosted', 'app-store'].includes(this.deploymentType)) {
      errors.push('Ongeldig deployment type');
    }

    if (!['ios', 'android', 'both', 'web'].includes(this.platform)) {
      errors.push('Ongeldig platform');
    }

    if (this.deploymentType === 'app-store' && !this.bundleId) {
      errors.push('Bundle ID is verplicht voor App Store deployment');
    }

    if (this.deploymentType === 'self-hosted' && !this.serverUrl) {
      errors.push('Server URL is verplicht voor self-hosted deployment');
    }

    return errors;
  }

  // Status methoden
  isPending() {
    return this.status === 'pending';
  }

  isConfiguring() {
    return this.status === 'configuring';
  }

  isBuilding() {
    return this.status === 'building';
  }

  isTesting() {
    return this.status === 'testing';
  }

  isDeploying() {
    return this.status === 'deploying';
  }

  isActive() {
    return this.status === 'active';
  }

  isFailed() {
    return this.status === 'failed';
  }

  canRedeploy() {
    return ['failed', 'active'].includes(this.status);
  }

  // Deployment methoden
  startConfiguration() {
    this.status = 'configuring';
    this.addLog('deployment', 'Started configuration process');
    this.updatedAt = new Date();
  }

  startBuild() {
    this.status = 'building';
    this.addLog('build', 'Started build process');
    this.updatedAt = new Date();
  }

  startTesting() {
    this.status = 'testing';
    this.addLog('deployment', 'Started testing process');
    this.updatedAt = new Date();
  }

  startDeployment() {
    this.status = 'deploying';
    this.addLog('deployment', 'Started deployment process');
    this.updatedAt = new Date();
  }

  markAsActive() {
    this.status = 'active';
    this.deployedAt = new Date();
    this.addLog('deployment', 'Deployment completed successfully');
    this.updatedAt = new Date();
  }

  markAsFailed(error) {
    this.status = 'failed';
    this.addLog('error', `Deployment failed: ${error}`);
    this.updatedAt = new Date();
  }

  // Configuration methoden
  setConfiguration(key, value) {
    this.configurations[key] = value;
    this.updatedAt = new Date();
  }

  getConfiguration(key, defaultValue = null) {
    return this.configurations[key] || defaultValue;
  }

  setBranding(branding) {
    this.branding = {
      appName: branding.appName || this.appName,
      primaryColor: branding.primaryColor || '#1976d2',
      secondaryColor: branding.secondaryColor || '#ffffff',
      logo: branding.logo || '',
      splashScreen: branding.splashScreen || '',
      icon: branding.icon || '',
      favicon: branding.favicon || '',
      ...branding
    };
    this.updatedAt = new Date();
  }

  setApiKeys(apiKeys) {
    this.apiKeys = {
      googleMaps: apiKeys.googleMaps || '',
      stripe: apiKeys.stripe || '',
      mollie: apiKeys.mollie || '',
      twilio: apiKeys.twilio || '',
      firebase: apiKeys.firebase || '',
      ...apiKeys
    };
    this.updatedAt = new Date();
  }

  // Feature methoden
  enableFeature(feature) {
    if (!this.features.includes(feature)) {
      this.features.push(feature);
      this.updatedAt = new Date();
    }
  }

  disableFeature(feature) {
    this.features = this.features.filter(f => f !== feature);
    this.updatedAt = new Date();
  }

  hasFeature(feature) {
    return this.features.includes(feature);
  }

  // Logging methoden
  addLog(type, message, details = {}) {
    const logEntry = {
      id: uuidv4(),
      type: type,
      message: message,
      details: details,
      timestamp: new Date()
    };

    switch (type) {
      case 'build':
        this.buildLogs.push(logEntry);
        break;
      case 'deployment':
        this.deploymentLogs.push(logEntry);
        break;
      case 'error':
        this.errorLogs.push(logEntry);
        break;
      default:
        this.deploymentLogs.push(logEntry);
    }

    this.updatedAt = new Date();
  }

  getBuildLogs() {
    return this.buildLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  getDeploymentLogs() {
    return this.deploymentLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  getErrorLogs() {
    return this.errorLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  // URL methoden
  getAppURL() {
    if (this.customDomain) {
      return `https://${this.customDomain}`;
    }
    return `https://${this.subdomain}.taxiapp.com`;
  }

  getCustomerAppDownloadURL() {
    return {
      ios: `https://apps.apple.com/app/${this.bundleId}`,
      android: `https://play.google.com/store/apps/details?id=${this.packageName}`,
      web: `${this.getAppURL()}/customer`
    };
  }

  getDriverAppDownloadURL() {
    return {
      ios: `https://apps.apple.com/app/${this.bundleId}-driver`,
      android: `https://play.google.com/store/apps/details?id=${this.packageName}.driver`,
      web: `${this.getAppURL()}/driver`
    };
  }

  // Build configuration methoden
  generateBuildConfig() {
    return {
      app: {
        name: this.appName,
        version: this.appVersion,
        buildNumber: this.buildNumber,
        bundleId: this.bundleId,
        packageName: this.packageName
      },
      branding: this.branding,
      features: this.features,
      api: {
        baseURL: this.serverUrl,
        keys: this.apiKeys
      },
      deployment: {
        type: this.deploymentType,
        platform: this.platform,
        domain: this.customDomain || this.subdomain
      }
    };
  }

  // Database methoden
  toDatabase() {
    return {
      id: this.id,
      company_id: this.companyId,
      deployment_type: this.deploymentType,
      status: this.status,
      platform: this.platform,
      app_name: this.appName,
      bundle_id: this.bundleId,
      package_name: this.packageName,
      app_version: this.appVersion,
      build_number: this.buildNumber,
      custom_domain: this.customDomain,
      subdomain: this.subdomain,
      server_url: this.serverUrl,
      database_url: this.databaseUrl,
      api_keys: JSON.stringify(this.apiKeys),
      branding: JSON.stringify(this.branding),
      features: JSON.stringify(this.features),
      configurations: JSON.stringify(this.configurations),
      build_logs: JSON.stringify(this.buildLogs),
      deployment_logs: JSON.stringify(this.deploymentLogs),
      error_logs: JSON.stringify(this.errorLogs),
      deployed_at: this.deployedAt,
      last_update_at: this.lastUpdateAt,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  static fromDatabase(row) {
    if (!row) return null;

    return new WhiteLabelDeployment({
      id: row.id,
      companyId: row.company_id,
      deploymentType: row.deployment_type,
      status: row.status,
      platform: row.platform,
      appName: row.app_name,
      bundleId: row.bundle_id,
      packageName: row.package_name,
      appVersion: row.app_version,
      buildNumber: row.build_number,
      customDomain: row.custom_domain,
      subdomain: row.subdomain,
      serverUrl: row.server_url,
      databaseUrl: row.database_url,
      apiKeys: row.api_keys ? JSON.parse(row.api_keys) : {},
      branding: row.branding ? JSON.parse(row.branding) : {},
      features: row.features ? JSON.parse(row.features) : [],
      configurations: row.configurations ? JSON.parse(row.configurations) : {},
      buildLogs: row.build_logs ? JSON.parse(row.build_logs) : [],
      deploymentLogs: row.deployment_logs ? JSON.parse(row.deployment_logs) : [],
      errorLogs: row.error_logs ? JSON.parse(row.error_logs) : [],
      deployedAt: row.deployed_at,
      lastUpdateAt: row.last_update_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  // API response methoden
  toJSON() {
    return {
      id: this.id,
      companyId: this.companyId,
      deploymentType: this.deploymentType,
      status: this.status,
      platform: this.platform,
      appName: this.appName,
      bundleId: this.bundleId,
      packageName: this.packageName,
      appVersion: this.appVersion,
      buildNumber: this.buildNumber,
      customDomain: this.customDomain,
      subdomain: this.subdomain,
      branding: this.branding,
      features: this.features,
      appURL: this.getAppURL(),
      downloadURLs: {
        customer: this.getCustomerAppDownloadURL(),
        driver: this.getDriverAppDownloadURL()
      },
      deployedAt: this.deployedAt,
      lastUpdateAt: this.lastUpdateAt,
      createdAt: this.createdAt
    };
  }

  toPublicJSON() {
    return {
      appName: this.appName,
      status: this.status,
      platform: this.platform,
      appVersion: this.appVersion,
      branding: this.branding,
      features: this.features,
      appURL: this.getAppURL(),
      downloadURLs: {
        customer: this.getCustomerAppDownloadURL(),
        driver: this.getDriverAppDownloadURL()
      },
      deployedAt: this.deployedAt
    };
  }
}

module.exports = WhiteLabelDeployment;