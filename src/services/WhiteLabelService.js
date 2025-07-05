const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const logger = require('../utils/logger');
const WhiteLabelDeployment = require('../models/WhiteLabelDeployment');
const Company = require('../models/Company');

class WhiteLabelService {
  constructor() {
    this.deploymentQueue = [];
    this.activeDeployments = new Map();
    this.templatePath = path.join(__dirname, '../templates');
    this.buildPath = path.join(__dirname, '../builds');
    this.deploymentPath = path.join(__dirname, '../deployments');
  }

  // Deployment methoden
  async createDeployment(companyId, deploymentConfig) {
    try {
      const company = await this.getCompany(companyId);
      if (!company) {
        throw new Error('Bedrijf niet gevonden');
      }

      const deployment = new WhiteLabelDeployment({
        companyId: companyId,
        deploymentType: deploymentConfig.type || 'hosted',
        platform: deploymentConfig.platform || 'both',
        appName: deploymentConfig.appName || company.name,
        bundleId: this.generateBundleId(company.subdomain),
        packageName: this.generatePackageName(company.subdomain),
        subdomain: company.subdomain,
        customDomain: deploymentConfig.customDomain || '',
        serverUrl: deploymentConfig.serverUrl || this.getDefaultServerUrl(company.subdomain),
        branding: this.generateBranding(company),
        features: deploymentConfig.features || this.getDefaultFeatures(company),
        apiKeys: deploymentConfig.apiKeys || {}
      });

      const validationErrors = deployment.validate();
      if (validationErrors.length > 0) {
        throw new Error(`Validatie fouten: ${validationErrors.join(', ')}`);
      }

      await this.saveDeployment(deployment);
      
      // Start deployment process
      this.queueDeployment(deployment);

      return deployment;

    } catch (error) {
      logger.error('Failed to create deployment', {
        companyId,
        error: error.message
      });
      throw error;
    }
  }

  async queueDeployment(deployment) {
    this.deploymentQueue.push(deployment.id);
    this.processDeploymentQueue();
  }

  async processDeploymentQueue() {
    if (this.activeDeployments.size >= 3) {
      logger.info('Max concurrent deployments reached, queuing...');
      return;
    }

    const deploymentId = this.deploymentQueue.shift();
    if (!deploymentId) return;

    const deployment = await this.getDeployment(deploymentId);
    if (!deployment) return;

    this.activeDeployments.set(deploymentId, deployment);
    
    try {
      await this.processDeployment(deployment);
    } catch (error) {
      logger.error('Deployment failed', {
        deploymentId,
        error: error.message
      });
      deployment.markAsFailed(error.message);
      await this.saveDeployment(deployment);
    } finally {
      this.activeDeployments.delete(deploymentId);
      // Process next in queue
      setTimeout(() => this.processDeploymentQueue(), 1000);
    }
  }

  async processDeployment(deployment) {
    logger.info('Starting deployment process', { deploymentId: deployment.id });

    // Step 1: Configuration
    deployment.startConfiguration();
    await this.saveDeployment(deployment);
    await this.generateConfiguration(deployment);

    // Step 2: Build
    deployment.startBuild();
    await this.saveDeployment(deployment);
    await this.buildApplication(deployment);

    // Step 3: Testing
    deployment.startTesting();
    await this.saveDeployment(deployment);
    await this.testApplication(deployment);

    // Step 4: Deployment
    deployment.startDeployment();
    await this.saveDeployment(deployment);
    await this.deployApplication(deployment);

    // Step 5: Complete
    deployment.markAsActive();
    await this.saveDeployment(deployment);

    logger.info('Deployment completed successfully', { deploymentId: deployment.id });
  }

  // Configuration methoden
  async generateConfiguration(deployment) {
    const company = await this.getCompany(deployment.companyId);
    const buildConfig = deployment.generateBuildConfig();
    
    const configPath = path.join(this.buildPath, deployment.id, 'config.json');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(buildConfig, null, 2));

    deployment.addLog('deployment', 'Configuration generated');
    
    // Generate app-specific files
    await this.generateAppFiles(deployment, company);
    
    deployment.addLog('deployment', 'App files generated');
  }

  async generateAppFiles(deployment, company) {
    const buildDir = path.join(this.buildPath, deployment.id);
    
    // Generate package.json
    const packageJson = {
      name: deployment.packageName,
      version: deployment.appVersion,
      description: `${company.name} Taxi App`,
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        build: 'npm run build:prod',
        'build:prod': 'NODE_ENV=production webpack --mode production'
      },
      dependencies: {
        // Add all necessary dependencies
      },
      keywords: ['taxi', 'transport', company.name.toLowerCase()],
      author: company.name,
      license: 'PROPRIETARY'
    };

    await fs.writeFile(
      path.join(buildDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Generate app.json for React Native
    const appJson = {
      expo: {
        name: deployment.appName,
        slug: deployment.subdomain,
        version: deployment.appVersion,
        orientation: 'portrait',
        icon: deployment.branding.icon || './assets/icon.png',
        splash: {
          image: deployment.branding.splashScreen || './assets/splash.png',
          resizeMode: 'contain',
          backgroundColor: deployment.branding.primaryColor
        },
        updates: {
          fallbackToCacheTimeout: 0
        },
        assetBundlePatterns: ['**/*'],
        ios: {
          supportsTablet: true,
          bundleIdentifier: deployment.bundleId
        },
        android: {
          package: deployment.packageName,
          versionCode: deployment.buildNumber
        }
      }
    };

    await fs.writeFile(
      path.join(buildDir, 'app.json'),
      JSON.stringify(appJson, null, 2)
    );

    // Generate environment configuration
    const envConfig = `
REACT_APP_NAME=${deployment.appName}
REACT_APP_API_URL=${deployment.serverUrl}
REACT_APP_COMPANY_ID=${deployment.companyId}
REACT_APP_PRIMARY_COLOR=${deployment.branding.primaryColor}
REACT_APP_SECONDARY_COLOR=${deployment.branding.secondaryColor}
REACT_APP_GOOGLE_MAPS_API_KEY=${deployment.apiKeys.googleMaps || ''}
REACT_APP_STRIPE_PUBLIC_KEY=${deployment.apiKeys.stripe || ''}
`;

    await fs.writeFile(path.join(buildDir, '.env'), envConfig);
  }

  // Build methoden
  async buildApplication(deployment) {
    const buildDir = path.join(this.buildPath, deployment.id);
    
    deployment.addLog('build', 'Starting build process');

    try {
      // Copy template files
      await this.copyTemplateFiles(buildDir, deployment);
      
      // Install dependencies
      deployment.addLog('build', 'Installing dependencies');
      await execAsync('npm install', { cwd: buildDir });
      
      // Build application
      deployment.addLog('build', 'Building application');
      
      if (deployment.platform === 'web' || deployment.platform === 'both') {
        await this.buildWebApplication(deployment, buildDir);
      }
      
      if (deployment.platform === 'ios' || deployment.platform === 'both') {
        await this.buildIOSApplication(deployment, buildDir);
      }
      
      if (deployment.platform === 'android' || deployment.platform === 'both') {
        await this.buildAndroidApplication(deployment, buildDir);
      }
      
      deployment.addLog('build', 'Build completed successfully');
      
    } catch (error) {
      deployment.addLog('error', `Build failed: ${error.message}`);
      throw error;
    }
  }

  async buildWebApplication(deployment, buildDir) {
    deployment.addLog('build', 'Building web application');
    
    const { stdout, stderr } = await execAsync('npm run build', { cwd: buildDir });
    
    if (stderr) {
      deployment.addLog('build', `Build warnings: ${stderr}`);
    }
    
    deployment.addLog('build', 'Web build completed');
  }

  async buildIOSApplication(deployment, buildDir) {
    if (process.platform !== 'darwin') {
      deployment.addLog('build', 'iOS build skipped (not on macOS)');
      return;
    }
    
    deployment.addLog('build', 'Building iOS application');
    
    // Build iOS app using Expo or native build tools
    const { stdout, stderr } = await execAsync('expo build:ios', { cwd: buildDir });
    
    deployment.addLog('build', 'iOS build completed');
  }

  async buildAndroidApplication(deployment, buildDir) {
    deployment.addLog('build', 'Building Android application');
    
    // Build Android app using Expo or native build tools
    const { stdout, stderr } = await execAsync('expo build:android', { cwd: buildDir });
    
    deployment.addLog('build', 'Android build completed');
  }

  // Testing methoden
  async testApplication(deployment) {
    deployment.addLog('deployment', 'Starting application tests');
    
    const buildDir = path.join(this.buildPath, deployment.id);
    
    try {
      // Run unit tests
      if (await this.fileExists(path.join(buildDir, 'package.json'))) {
        const packageJson = JSON.parse(await fs.readFile(path.join(buildDir, 'package.json'), 'utf8'));
        if (packageJson.scripts && packageJson.scripts.test) {
          deployment.addLog('deployment', 'Running unit tests');
          await execAsync('npm test', { cwd: buildDir });
        }
      }
      
      // Run integration tests
      await this.runIntegrationTests(deployment);
      
      deployment.addLog('deployment', 'All tests passed');
      
    } catch (error) {
      deployment.addLog('error', `Tests failed: ${error.message}`);
      throw error;
    }
  }

  async runIntegrationTests(deployment) {
    // Test API endpoints
    // Test database connectivity
    // Test third-party integrations
    deployment.addLog('deployment', 'Integration tests completed');
  }

  // Deploy methoden
  async deployApplication(deployment) {
    deployment.addLog('deployment', 'Starting application deployment');
    
    try {
      if (deployment.deploymentType === 'hosted') {
        await this.deployToHostedEnvironment(deployment);
      } else if (deployment.deploymentType === 'self-hosted') {
        await this.generateSelfHostedPackage(deployment);
      } else if (deployment.deploymentType === 'app-store') {
        await this.deployToAppStore(deployment);
      }
      
      deployment.addLog('deployment', 'Application deployed successfully');
      
    } catch (error) {
      deployment.addLog('error', `Deployment failed: ${error.message}`);
      throw error;
    }
  }

  async deployToHostedEnvironment(deployment) {
    // Deploy to our hosting infrastructure
    const deployDir = path.join(this.deploymentPath, deployment.id);
    const buildDir = path.join(this.buildPath, deployment.id, 'build');
    
    await fs.mkdir(deployDir, { recursive: true });
    
    // Copy build files
    await execAsync(`cp -r ${buildDir}/* ${deployDir}/`);
    
    // Setup nginx configuration
    await this.setupNginxConfig(deployment);
    
    // Setup SSL certificate
    await this.setupSSLCertificate(deployment);
    
    deployment.addLog('deployment', 'Hosted deployment completed');
  }

  async generateSelfHostedPackage(deployment) {
    // Generate deployment package for self-hosting
    const packageDir = path.join(this.deploymentPath, deployment.id, 'package');
    await fs.mkdir(packageDir, { recursive: true });
    
    // Copy all necessary files
    const buildDir = path.join(this.buildPath, deployment.id);
    await execAsync(`cp -r ${buildDir}/* ${packageDir}/`);
    
    // Generate deployment scripts
    await this.generateDeploymentScripts(deployment, packageDir);
    
    // Generate documentation
    await this.generateDeploymentDocumentation(deployment, packageDir);
    
    // Create deployment package
    await execAsync(`tar -czf ${deployment.id}.tar.gz -C ${packageDir} .`);
    
    deployment.addLog('deployment', 'Self-hosted package generated');
  }

  // Utility methoden
  generateBundleId(subdomain) {
    return `com.${subdomain.replace('-', '')}.taxiapp`;
  }

  generatePackageName(subdomain) {
    return `com.${subdomain.replace('-', '')}.taxiapp`;
  }

  getDefaultServerUrl(subdomain) {
    return `https://${subdomain}.taxiapp.com/api`;
  }

  generateBranding(company) {
    return {
      appName: company.name,
      primaryColor: company.primaryColor,
      secondaryColor: company.secondaryColor,
      logo: company.logoUrl,
      icon: company.getSetting('appIcon'),
      splashScreen: company.getSetting('splashScreen')
    };
  }

  getDefaultFeatures(company) {
    const features = ['booking', 'tracking', 'payments', 'notifications'];
    
    if (company.canUseFeature('advanced_reporting')) {
      features.push('advanced_reporting');
    }
    
    if (company.canUseFeature('custom_branding')) {
      features.push('custom_branding');
    }
    
    return features;
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async copyTemplateFiles(buildDir, deployment) {
    const templateDir = path.join(this.templatePath, 'taxi-app');
    await execAsync(`cp -r ${templateDir}/* ${buildDir}/`);
  }

  // Database methoden (placeholder - implement with actual database)
  async saveDeployment(deployment) {
    // Save to database
    logger.info('Deployment saved', { deploymentId: deployment.id });
  }

  async getDeployment(deploymentId) {
    // Get from database
    return null;
  }

  async getCompany(companyId) {
    // Get from database
    return null;
  }

  // Management methoden
  async getDeploymentStatus(deploymentId) {
    const deployment = await this.getDeployment(deploymentId);
    if (!deployment) {
      throw new Error('Deployment niet gevonden');
    }

    return {
      id: deployment.id,
      status: deployment.status,
      progress: this.calculateProgress(deployment),
      logs: deployment.getDeploymentLogs(),
      errors: deployment.getErrorLogs()
    };
  }

  calculateProgress(deployment) {
    const statusProgress = {
      'pending': 0,
      'configuring': 20,
      'building': 40,
      'testing': 60,
      'deploying': 80,
      'active': 100,
      'failed': 0
    };

    return statusProgress[deployment.status] || 0;
  }

  async cancelDeployment(deploymentId) {
    const deployment = await this.getDeployment(deploymentId);
    if (!deployment) {
      throw new Error('Deployment niet gevonden');
    }

    if (deployment.isActive()) {
      throw new Error('Actieve deployment kan niet worden geannuleerd');
    }

    deployment.markAsFailed('Deployment geannuleerd door gebruiker');
    await this.saveDeployment(deployment);

    // Remove from queue
    this.deploymentQueue = this.deploymentQueue.filter(id => id !== deploymentId);
    
    return deployment;
  }
}

module.exports = new WhiteLabelService();