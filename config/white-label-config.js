// White-Label Configuration System
// Voor het verkopen van kopieën aan andere taxi bedrijven

class WhiteLabelConfig {
    constructor() {
        this.companies = new Map();
        this.templates = new Map();
        this.initializeDefaultTemplates();
    }

    // Voeg een nieuw bedrijf toe
    addCompany(companyData) {
        const company = {
            id: this.generateCompanyId(),
            name: companyData.name,
            domain: companyData.domain, // bijv. amsteltaxi.com
            logo: companyData.logo,
            colors: companyData.colors || this.getDefaultColors(),
            contact: companyData.contact,
            features: companyData.features || this.getDefaultFeatures(),
            pricing: companyData.pricing || this.getDefaultPricing(),
            languages: companyData.languages || ['nl'],
            isActive: true,
            createdAt: new Date(),
            licenseType: companyData.licenseType || 'standard', // standard, premium, enterprise
            expiresAt: companyData.expiresAt || null
        };

        this.companies.set(company.id, company);
        return company;
    }

    // Haal bedrijf configuratie op
    getCompanyConfig(companyId) {
        return this.companies.get(companyId);
    }

    // Haal configuratie op basis van domein
    getCompanyByDomain(domain) {
        for (let [id, company] of this.companies) {
            if (company.domain === domain) {
                return company;
            }
        }
        return null;
    }

    // Genereer company ID
    generateCompanyId() {
        return 'company_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    }

    // Default kleuren schema
    getDefaultColors() {
        return {
            primary: '#667eea',
            secondary: '#764ba2',
            accent: '#3498db',
            background: '#f8f9fa',
            text: '#212529',
            success: '#28a745',
            warning: '#ffc107',
            danger: '#dc3545'
        };
    }

    // Default features
    getDefaultFeatures() {
        return {
            realTimeTracking: true,
            onlinePayment: true,
            cashPayment: true,
            bankTransfer: true,
            noShowManagement: true,
            bookingModification: true,
            partnershipSystem: false, // Premium feature
            multiLanguage: false, // Premium feature
            advancedReporting: false, // Premium feature
            api: false, // Enterprise feature
            whiteLabel: false // Enterprise feature
        };
    }

    // Default pricing
    getDefaultPricing() {
        return {
            baseFare: 2.50,
            pricePerKm: 1.20,
            pricePerMinute: 0.35,
            minimumFare: 5.00,
            bookingFee: 1.00,
            cancellationFee: 3.00,
            noShowFee: 15.00,
            modificationFee: 5.00,
            nightSurcharge: 0.25, // 25%
            holidaySurcharge: 0.50 // 50%
        };
    }

    // Initialize default templates
    initializeDefaultTemplates() {
        this.templates.set('booking_confirmation', {
            subject: 'Booking Bevestiging - {{companyName}}',
            html: `
                <h2>Beste {{customerName}},</h2>
                <p>Je taxi boeking is bevestigd!</p>
                <div style="border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
                    <h3>Booking Details:</h3>
                    <p><strong>Booking ID:</strong> {{bookingId}}</p>
                    <p><strong>Van:</strong> {{fromAddress}}</p>
                    <p><strong>Naar:</strong> {{toAddress}}</p>
                    <p><strong>Datum & Tijd:</strong> {{dateTime}}</p>
                    <p><strong>Voertuig:</strong> {{vehicleType}}</p>
                    <p><strong>Prijs:</strong> €{{price}}</p>
                </div>
                <p><a href="{{modificationLink}}" style="background: {{primaryColor}}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Wijzig Boeking</a></p>
                <p>Je kunt je boeking tot 24 uur voor vertrek gratis wijzigen.</p>
                <p>Met vriendelijke groet,<br>{{companyName}}</p>
            `
        });

        this.templates.set('booking_reminder', {
            subject: 'Herinnering: Je taxi komt over 1 uur - {{companyName}}',
            html: `
                <h2>Beste {{customerName}},</h2>
                <p>Dit is een herinnering dat je taxi over ongeveer 1 uur arriveert.</p>
                <div style="border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
                    <h3>Booking Details:</h3>
                    <p><strong>Ophaal tijd:</strong> {{dateTime}}</p>
                    <p><strong>Ophaal adres:</strong> {{fromAddress}}</p>
                    <p><strong>Bestemming:</strong> {{toAddress}}</p>
                    <p><strong>Chauffeur:</strong> {{driverName}}</p>
                    <p><strong>Telefoon:</strong> {{driverPhone}}</p>
                </div>
                <p>Zorg dat je klaar staat op het afgesproken tijd.</p>
                <p>Met vriendelijke groet,<br>{{companyName}}</p>
            `
        });
    }

    // Update company configuratie
    updateCompanyConfig(companyId, updates) {
        const company = this.companies.get(companyId);
        if (!company) {
            throw new Error('Company not found');
        }

        Object.assign(company, updates);
        company.updatedAt = new Date();
        this.companies.set(companyId, company);
        return company;
    }

    // Genereer CSS voor een bedrijf
    generateCustomCSS(companyId) {
        const company = this.companies.get(companyId);
        if (!company) {
            throw new Error('Company not found');
        }

        const colors = company.colors;
        return `
            :root {
                --primary-color: ${colors.primary};
                --secondary-color: ${colors.secondary};
                --accent-color: ${colors.accent};
                --background-color: ${colors.background};
                --text-color: ${colors.text};
                --success-color: ${colors.success};
                --warning-color: ${colors.warning};
                --danger-color: ${colors.danger};
            }

            .header {
                background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%);
            }

            .btn-primary {
                background: ${colors.primary};
            }

            .btn-primary:hover {
                background: ${this.darkenColor(colors.primary, 0.1)};
            }

            .nav-link.active {
                background: ${colors.primary};
            }

            .stat-number {
                color: ${colors.primary};
            }

            .company-logo {
                max-height: 40px;
                width: auto;
            }
        `;
    }

    // Darken color helper
    darkenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent * 100);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    // Genereer HTML voor een bedrijf
    generateCustomHTML(companyId, template) {
        const company = this.companies.get(companyId);
        if (!company) {
            throw new Error('Company not found');
        }

        let html = template;
        
        // Replace company placeholders
        html = html.replace(/{{companyName}}/g, company.name);
        html = html.replace(/{{primaryColor}}/g, company.colors.primary);
        html = html.replace(/{{secondaryColor}}/g, company.colors.secondary);
        html = html.replace(/{{companyLogo}}/g, company.logo || '');
        html = html.replace(/{{companyPhone}}/g, company.contact.phone || '');
        html = html.replace(/{{companyEmail}}/g, company.contact.email || '');
        
        return html;
    }

    // Controleer feature toegang
    hasFeature(companyId, feature) {
        const company = this.companies.get(companyId);
        if (!company) {
            return false;
        }

        return company.features[feature] === true;
    }

    // Controleer licentie
    isLicenseValid(companyId) {
        const company = this.companies.get(companyId);
        if (!company) {
            return false;
        }

        if (!company.isActive) {
            return false;
        }

        if (company.expiresAt && new Date() > company.expiresAt) {
            return false;
        }

        return true;
    }

    // Export company configuratie
    exportCompanyConfig(companyId) {
        const company = this.companies.get(companyId);
        if (!company) {
            throw new Error('Company not found');
        }

        return {
            config: company,
            css: this.generateCustomCSS(companyId),
            templates: this.templates,
            database: this.generateDatabaseConfig(companyId)
        };
    }

    // Genereer database config
    generateDatabaseConfig(companyId) {
        const company = this.companies.get(companyId);
        return {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: `taxi_${companyId}`,
            username: `user_${companyId}`,
            password: this.generatePassword(),
            ssl: process.env.NODE_ENV === 'production'
        };
    }

    // Genereer veilig wachtwoord
    generatePassword(length = 16) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    // Lijst alle bedrijven
    listCompanies() {
        return Array.from(this.companies.values());
    }

    // Deactiveer bedrijf
    deactivateCompany(companyId) {
        const company = this.companies.get(companyId);
        if (company) {
            company.isActive = false;
            company.deactivatedAt = new Date();
            this.companies.set(companyId, company);
        }
    }

    // Activeer bedrijf
    activateCompany(companyId) {
        const company = this.companies.get(companyId);
        if (company) {
            company.isActive = true;
            company.reactivatedAt = new Date();
            this.companies.set(companyId, company);
        }
    }
}

// Export configuratie
module.exports = WhiteLabelConfig;