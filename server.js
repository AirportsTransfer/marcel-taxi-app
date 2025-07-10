const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const nodemailer = require('nodemailer');
require('dotenv').config();

const logger = require('./src/utils/logger');
const errorHandler = require('./src/middleware/errorHandler');
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const rideRoutes = require('./src/routes/rides');
const driverRoutes = require('./src/routes/drivers');
const companyRoutes = require('./src/routes/companies');
const adminRoutes = require('./src/routes/admin');
const paymentRoutes = require('./src/routes/payments');
const pricingRoutes = require('./src/routes/pricing');
const partnershipRoutes = require('./src/routes/partnerships');
const trackingRoutes = require('./src/routes/tracking');
const webhookRoutes = require('./src/routes/webhooks');
const notificationRoutes = require('./src/routes/notifications');

const TrackingService = require('./src/services/TrackingService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://yourdomain.com'] 
      : ['http://localhost:3000', 'http://localhost:8081'],
    credentials: true
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "'unsafe-eval'",
        "https://maps.googleapis.com",
        "https://maps.gstatic.com"
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://maps.googleapis.com"]
    }
  }
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000', 'http://localhost:8081'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (frontend)
app.use(express.static('public'));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Initialize tracking service
const trackingService = new TrackingService(io);
app.set('trackingService', trackingService);

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/rides', rideRoutes);
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/companies', companyRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/pricing', pricingRoutes);
app.use('/api/v1/partnerships', partnershipRoutes);
app.use('/api/v1/tracking', trackingRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Email booking confirmation endpoint
app.post('/api/send-booking-email', async (req, res) => {
  try {
    const { emailSettings, emailTemplate, templateType, ...booking } = req.body;
    logger.info(`📧 Email request received for booking: ${booking.bookingId}, type: ${templateType || 'pending'}`);
    
    // Use email settings from admin panel
    const smtpConfig = {
      host: emailSettings?.smtpHost || 'smtp.gmail.com',
      port: parseInt(emailSettings?.smtpPort) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: emailSettings?.smtpUsername || 'info@airporttransfer.be',
        pass: emailSettings?.smtpPassword || ''
      }
    };

    // Create transporter
    const transporter = nodemailer.createTransport(smtpConfig);

    // Determine template type and get appropriate template data
    const emailType = templateType || booking.status || 'pending';
    
    // Create email content using admin template
    const tripType = booking.trip?.tripType || 'heen';
    const direction = tripType === 'terug' ? 'Terug reis' : 'Heen reis';
    
    // Use template data from admin panel - fallback to emailTemplate if specific type not found
    const template = emailTemplate || {};
    
    // Template-specific defaults based on email type
    let defaultWelcomeMessage, defaultStatusMessage, headerColor, statusBadgeColor, titleText;
    
    switch(emailType) {
      case 'confirmed':
        defaultWelcomeMessage = 'Uw boeking bij Marcel\'s Taxi is bevestigd!\n\nWe kijken ernaar uit u te mogen vervoeren. Hieronder vindt u de bevestigde details van uw reis.';
        defaultStatusMessage = '✅ BEVESTIGD\n\nUw boeking is bevestigd! U ontvangt binnenkort meer details over uw chauffeur en voertuig.\n\nWe nemen 1 dag voor vertrek contact met u op voor de definitieve details.';
        headerColor = '#28a745';
        statusBadgeColor = '#28a745';
        titleText = 'Booking Bevestigd';
        break;
      case 'cancelled':
        defaultWelcomeMessage = 'Uw boeking bij Marcel\'s Taxi is geannuleerd.\n\nWe hebben uw annuleringsverzoek verwerkt. Hieronder vindt u de details van de geannuleerde reis.';
        defaultStatusMessage = '❌ GEANNULEERD\n\nUw boeking is geannuleerd conform uw verzoek.\n\nEventuele terugbetalingen worden volgens onze voorwaarden verwerkt.';
        headerColor = '#dc3545';
        statusBadgeColor = '#dc3545';
        titleText = 'Booking Geannuleerd';
        break;
      default: // pending
        defaultWelcomeMessage = 'Bedankt voor uw boeking bij Marcel\'s Taxi!\n\nWe hebben uw reservering ontvangen en bevestigen deze graag. Hieronder vindt u de details van uw reis.';
        defaultStatusMessage = '🔄 WACHT OP BEVESTIGING\n\nUw boeking wordt binnen 24 uur door ons team bevestigd. U ontvangt een definitieve bevestiging per email of telefoon.\n\nVoor urgente boekingen kunt u ons direct bellen.';
        headerColor = '#ffc107';
        statusBadgeColor = '#ffc107';
        titleText = 'Booking Ontvangen';
    }
    
    const companyName = template.companyName || 'Marcel\'s Taxi';
    const welcomeMessage = template.welcomeMessage || defaultWelcomeMessage;
    const statusMessage = template.statusMessage || defaultStatusMessage;
    const contactPhone = template.phone || '+32 xxx xx xx xx';
    const contactWhatsApp = template.whatsApp || '+32 xxx xx xx xx';
    const contactEmail = template.email || 'info@airporttransfer.be';
    const contactInfo = template.contactInfo || 'Voor vragen of wijzigingen kunt u ons bereiken via bovenstaande contactgegevens.\n\nBij no-show of annulering binnen 2 uur voor vertrek kunnen kosten in rekening worden gebracht.';
    const website = template.website || 'www.airporttransfer.be';
    const footer = template.footer || 'Marcel\'s Taxi - Professioneel vervoer\nBetrouwbaar • Comfortabel • Op tijd\n\nBedankt voor het kiezen van onze service!';
    
    // Generate modification link for confirmed bookings
    const modificationDeadline = template.modificationDeadlineHours || '24';
    const modificationLink = emailType === 'confirmed' ? 
      `${req.protocol}://${req.get('host')}/modify-booking.html?id=${booking.bookingId}&token=${Buffer.from(booking.bookingId + booking.customer?.email).toString('base64')}` : '';
    
    const emailHTML = `
    <!DOCTYPE html>
    <html lang="nl">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${titleText}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body { 
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                line-height: 1.6; 
                color: #2c3e50; 
                margin: 0; 
                padding: 0;
                background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                min-height: 100vh;
            }
            
            .email-wrapper {
                width: 100%;
                padding: 40px 20px;
                background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            }
            
            .container { 
                max-width: 650px; 
                margin: 0 auto; 
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            
            .header { 
                background: linear-gradient(135deg, ${headerColor} 0%, ${headerColor}dd 100%);
                color: white; 
                padding: 40px 30px; 
                text-align: center;
                position: relative;
                overflow: hidden;
            }
            
            .header::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1" fill="white" opacity="0.1"/><circle cx="80" cy="40" r="1" fill="white" opacity="0.1"/><circle cx="40" cy="80" r="1" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
                opacity: 0.3;
            }
            
            .header h1 { 
                font-size: 32px; 
                font-weight: 700; 
                margin-bottom: 8px;
                position: relative;
                z-index: 2;
            }
            
            .header h2 { 
                font-size: 18px; 
                font-weight: 400; 
                opacity: 0.9;
                position: relative;
                z-index: 2;
            }
            
            .content { 
                padding: 40px 30px;
                background: white;
            }
            
            .greeting {
                font-size: 18px;
                font-weight: 500;
                color: #2c3e50;
                margin-bottom: 25px;
            }
            
            .welcome-message {
                font-size: 16px;
                color: #5a6c7d;
                margin-bottom: 30px;
                line-height: 1.7;
            }
            
            .status-badge { 
                background: linear-gradient(135deg, ${statusBadgeColor} 0%, ${statusBadgeColor}dd 100%);
                color: white; 
                padding: 12px 24px; 
                border-radius: 25px; 
                font-weight: 600; 
                display: inline-block; 
                margin: 20px 0 30px 0;
                font-size: 14px;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }
            
            .booking-card {
                background: linear-gradient(135deg, #f8f9ff 0%, #f1f3ff 100%);
                border: 1px solid #e1e8ff;
                border-radius: 16px;
                padding: 25px;
                margin: 25px 0;
                border-left: 4px solid ${headerColor};
                box-shadow: 0 4px 20px rgba(0,0,0,0.05);
            }
            
            .booking-card h4 {
                color: ${headerColor};
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .detail-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 0;
                border-bottom: 1px solid #e8ecf0;
            }
            
            .detail-row:last-child {
                border-bottom: none;
            }
            
            .detail-label {
                font-weight: 500;
                color: #5a6c7d;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .detail-value {
                font-weight: 600;
                color: #2c3e50;
                text-align: right;
                max-width: 60%;
            }
            
            .price-highlight {
                background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                color: white !important;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: 700;
                font-size: 16px;
            }
            
            .modification-section {
                background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
                border: 1px solid #ffd93d;
                border-radius: 16px;
                padding: 25px;
                margin: 25px 0;
                text-align: center;
            }
            
            .modification-title {
                color: #856404;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 15px;
            }
            
            .modification-text {
                color: #856404;
                margin-bottom: 20px;
                line-height: 1.6;
            }
            
            .modify-button {
                display: inline-block;
                background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
                color: white;
                text-decoration: none;
                padding: 14px 30px;
                border-radius: 25px;
                font-weight: 600;
                font-size: 16px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(0,123,255,0.3);
            }
            
            .modify-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0,123,255,0.4);
            }
            
            .contact-card {
                background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
                border-radius: 16px;
                padding: 25px;
                margin: 25px 0;
                border-left: 4px solid #2196f3;
            }
            
            .contact-card h4 {
                color: #1565c0;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .contact-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-bottom: 20px;
            }
            
            .contact-item {
                background: white;
                padding: 15px;
                border-radius: 12px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            }
            
            .contact-label {
                font-weight: 500;
                color: #1565c0;
                font-size: 14px;
                margin-bottom: 5px;
            }
            
            .contact-value {
                font-weight: 600;
                color: #2c3e50;
                font-size: 15px;
            }
            
            .contact-info-text {
                color: #1565c0;
                line-height: 1.6;
                font-size: 14px;
            }
            
            .footer { 
                text-align: center; 
                padding: 40px 30px; 
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                border-top: 1px solid #dee2e6;
            }
            
            .footer-logo {
                font-size: 24px;
                font-weight: 700;
                color: ${headerColor};
                margin-bottom: 10px;
            }
            
            .footer-website {
                color: #6c757d;
                font-size: 16px;
                margin-bottom: 20px;
            }
            
            .footer-text {
                color: #6c757d;
                font-size: 14px;
                line-height: 1.6;
            }
            
            .divider {
                height: 1px;
                background: linear-gradient(90deg, transparent 0%, #dee2e6 50%, transparent 100%);
                margin: 30px 0;
            }
            
            /* Mobile responsiveness */
            @media (max-width: 600px) {
                .email-wrapper { padding: 20px 10px; }
                .container { border-radius: 12px; }
                .header { padding: 30px 20px; }
                .content { padding: 30px 20px; }
                .footer { padding: 30px 20px; }
                .booking-card, .contact-card, .modification-section { padding: 20px; }
                .contact-grid { grid-template-columns: 1fr; }
            }
        </style>
    </head>
    <body>
        <div class="email-wrapper">
            <div class="container">
                <div class="header">
                    <h1>🚗 ${companyName}</h1>
                    <h2>${titleText}</h2>
                </div>
                
                <div class="content">
                    <div class="greeting">
                        Beste ${booking.customer?.firstName || ''} ${booking.customer?.lastName || ''},
                    </div>
                    
                    <div class="welcome-message">
                        ${welcomeMessage.replace(/\n/g, '<br>')}
                    </div>
                    
                    <div class="status-badge">
                        ${statusMessage.split('\n')[0]}
                    </div>
                    
                    <div class="booking-card">
                        <h4>🎫 ${direction} - Booking ${booking.bookingId}</h4>
                        
                        <div class="detail-row">
                            <span class="detail-label">📍 Van</span>
                            <span class="detail-value">${booking.trip?.fromLocation || 'Niet gespecificeerd'}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="detail-label">📍 Naar</span>
                            <span class="detail-value">${booking.trip?.toLocation || 'Niet gespecificeerd'}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="detail-label">📅 Datum</span>
                            <span class="detail-value">${booking.trip?.travelDate || 'Niet gespecificeerd'}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="detail-label">🕐 Tijd</span>
                            <span class="detail-value">${booking.trip?.travelHour || ''}:${booking.trip?.travelMinute || ''}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="detail-label">🚗 Voertuig</span>
                            <span class="detail-value">${booking.vehicle?.vehicle?.name || 'Niet gespecificeerd'}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="detail-label">💰 Prijs</span>
                            <span class="detail-value price-highlight">€${booking.vehicle?.pricing?.minimumPrice || 'TBD'}</span>
                        </div>
                    </div>
                    
                    <div class="booking-card">
                        <h4>👤 Klant Informatie</h4>
                        
                        <div class="detail-row">
                            <span class="detail-label">📧 Email</span>
                            <span class="detail-value">${booking.customer?.email || ''}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="detail-label">📱 Telefoon</span>
                            <span class="detail-value">${booking.customer?.phone || ''}</span>
                        </div>
                        
                        ${booking.customer?.passengers ? `
                        <div class="detail-row">
                            <span class="detail-label">👥 Aantal passagiers</span>
                            <span class="detail-value">${booking.customer.passengers}</span>
                        </div>
                        ` : ''}
                        
                        ${booking.customer?.specialRequests ? `
                        <div class="detail-row">
                            <span class="detail-label">📝 Bijzondere verzoeken</span>
                            <span class="detail-value">${booking.customer.specialRequests}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    ${emailType === 'confirmed' && modificationLink ? `
                    <div class="modification-section">
                        <div class="modification-title">
                            ✏️ Wijzigingen mogelijk
                        </div>
                        <div class="modification-text">
                            U kunt uw boeking nog wijzigen tot ${modificationDeadline} uur voor uw vertrek.<br>
                            Klik op de knop hieronder om uw reservering aan te passen.
                        </div>
                        <a href="${modificationLink}" class="modify-button">
                            Boeking Wijzigen
                        </a>
                    </div>
                    ` : ''}
                    
                    <div class="divider"></div>
                    
                    <div style="margin: 25px 0; padding: 20px; background: #f8f9fa; border-radius: 12px; border-left: 4px solid ${headerColor};">
                        ${statusMessage.replace(/\n/g, '<br>')}
                    </div>
                    
                    <div class="contact-card">
                        <h4>📞 Contact Informatie</h4>
                        
                        <div class="contact-grid">
                            <div class="contact-item">
                                <div class="contact-label">Telefoon</div>
                                <div class="contact-value">${contactPhone}</div>
                            </div>
                            
                            <div class="contact-item">
                                <div class="contact-label">WhatsApp</div>
                                <div class="contact-value">${contactWhatsApp}</div>
                            </div>
                            
                            <div class="contact-item">
                                <div class="contact-label">Email</div>
                                <div class="contact-value">${contactEmail}</div>
                            </div>
                        </div>
                        
                        <div class="contact-info-text">
                            ${contactInfo.replace(/\n/g, '<br>')}
                        </div>
                    </div>
                </div>
                
                <div class="footer">
                    <div class="footer-logo">${companyName}</div>
                    <div class="footer-website">${website}</div>
                    <div class="footer-text">
                        ${footer.replace(/\n/g, '<br>')}
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    // Send email to customer
    const customerMailOptions = {
      from: `"${emailSettings?.fromName || 'Marcel\'s Taxi'}" <${emailSettings?.fromEmail || smtpConfig.auth.user}>`,
      to: booking.customer?.email,
      subject: `${titleText} - ${booking.bookingId} (${direction})`,
      html: emailHTML
    };

    // Send email to admin
    const adminSubjectPrefix = emailType === 'pending' ? 'Nieuwe Booking' : 
                               emailType === 'confirmed' ? 'Bevestigde Booking' : 
                               'Geannuleerde Booking';
    const adminMailOptions = {
      from: `"${emailSettings?.fromName || 'Marcel\'s Taxi'} System" <${emailSettings?.fromEmail || smtpConfig.auth.user}>`,
      to: 'marceltataev@gmail.com',
      subject: `${adminSubjectPrefix} - ${booking.bookingId} (${direction})`,
      html: emailHTML
    };

    // Send both emails
    await transporter.sendMail(customerMailOptions);
    await transporter.sendMail(adminMailOptions);
    
    res.json({
      success: true,
      message: 'Booking emails sent successfully',
      bookingId: booking.bookingId
    });
    
    logger.info(`✅ Booking emails sent for: ${booking.bookingId}`);
  } catch (error) {
    logger.error('❌ Email sending failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send booking email: ' + error.message
    });
  }
});

// Email test endpoint
app.post('/api/send-test-email', async (req, res) => {
  try {
    const { testEmail, fromName, fromEmail, smtpHost, smtpPort, smtpUsername, smtpPassword } = req.body;
    logger.info(`📧 Test email request for: ${testEmail}`);
    logger.info(`📧 Nodemailer version: ${require('nodemailer/package.json').version}`);
    logger.info(`📧 Using createTransport method: ${typeof nodemailer.createTransport}`);
    
    // Create transporter with admin panel settings
    const emailSettings = {
      host: smtpHost || 'smtp.gmail.com',
      port: parseInt(smtpPort) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: smtpUsername,
        pass: smtpPassword
      }
    };

    const transporter = nodemailer.createTransport(emailSettings);

    // Test email content
    const testEmailHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Test Email</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✅ Test Email</h1>
                <h2>Marcel's Taxi Email System</h2>
            </div>
            <div class="content">
                <h3>Gefeliciteerd!</h3>
                <p>Je email configuratie werkt correct.</p>
                <p><strong>Van:</strong> ${fromName} &lt;${fromEmail}&gt;</p>
                <p><strong>SMTP Host:</strong> ${smtpHost}</p>
                <p><strong>Tijd:</strong> ${new Date().toLocaleString('nl-NL')}</p>
                <p>Je kunt nu booking bevestigingen versturen naar klanten!</p>
            </div>
            <div class="footer">
                <p>© Marcel's Taxi Service - Email Test</p>
            </div>
        </div>
    </body>
    </html>
    `;

    // Send test email
    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: testEmail,
      subject: '✅ Test Email - Marcel\'s Taxi System',
      html: testEmailHTML
    };

    await transporter.sendMail(mailOptions);
    
    res.json({
      success: true,
      message: `Test email sent successfully to ${testEmail}`,
      details: `From: ${fromName} <${fromEmail}>`
    });
    
    logger.info(`✅ Test email sent successfully to: ${testEmail}`);
  } catch (error) {
    logger.error('❌ Test email failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test email: ' + error.message
    });
  }
});

// Booking status change endpoint - automatically sends appropriate email template
app.post('/api/update-booking-status', async (req, res) => {
  try {
    const { bookingId, newStatus, emailSettings } = req.body;
    logger.info(`📋 Status change request for booking: ${bookingId} to ${newStatus}`);
    
    // Get the booking from unconfirmed bookings
    let unconfirmedBookings = JSON.parse(req.body.unconfirmedBookings || '[]');
    const bookingIndex = unconfirmedBookings.findIndex(b => b.bookingId === bookingId);
    
    if (bookingIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }
    
    const booking = unconfirmedBookings[bookingIndex];
    const oldStatus = booking.status;
    
    // Update booking status
    booking.status = newStatus;
    booking.lastUpdated = new Date().toISOString();
    
    // Move booking to appropriate list based on new status
    if (newStatus === 'confirmed') {
      // Move to confirmed bookings
      let confirmedBookings = JSON.parse(req.body.confirmedBookings || '[]');
      confirmedBookings.unshift(booking);
      unconfirmedBookings.splice(bookingIndex, 1);
      
      // Send confirmation email
      try {
        const emailResponse = await fetch(`${req.protocol}://${req.get('host')}/api/send-booking-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...booking,
            templateType: 'confirmed',
            emailSettings: emailSettings
          })
        });
        
        if (!emailResponse.ok) {
          logger.warn('⚠️ Confirmation email failed to send');
        }
      } catch (emailError) {
        logger.error('❌ Confirmation email error:', emailError);
      }
      
    } else if (newStatus === 'cancelled') {
      // Move to cancelled bookings 
      let cancelledBookings = JSON.parse(req.body.cancelledBookings || '[]');
      cancelledBookings.unshift(booking);
      unconfirmedBookings.splice(bookingIndex, 1);
      
      // Send cancellation email
      try {
        const emailResponse = await fetch(`${req.protocol}://${req.get('host')}/api/send-booking-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...booking,
            templateType: 'cancelled',
            emailSettings: emailSettings
          })
        });
        
        if (!emailResponse.ok) {
          logger.warn('⚠️ Cancellation email failed to send');
        }
      } catch (emailError) {
        logger.error('❌ Cancellation email error:', emailError);
      }
    }
    
    res.json({
      success: true,
      message: `Booking ${bookingId} status changed from ${oldStatus} to ${newStatus}`,
      booking: booking,
      unconfirmedBookings: unconfirmedBookings
    });
    
    logger.info(`✅ Booking ${bookingId} status updated: ${oldStatus} → ${newStatus}`);
  } catch (error) {
    logger.error('❌ Status update failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update booking status: ' + error.message
    });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`New client connected: ${socket.id}`);
  
  // Driver connection
  socket.on('join-driver', (data) => {
    const { driverId, token } = data;
    // TODO: Verify JWT token
    socket.join(`driver-${driverId}`);
    socket.join('drivers-room');
    trackingService.addDriverConnection(driverId, socket);
    logger.info(`Driver ${driverId} joined tracking`);
  });
  
  // Customer connection for ride tracking
  socket.on('join-ride', (data) => {
    const { rideId, customerId, token } = data;
    // TODO: Verify JWT token and ride ownership
    socket.join(`ride-${rideId}`);
    trackingService.addRideTracking(rideId, null, customerId, socket);
    logger.info(`Customer ${customerId} joined ride tracking: ${rideId}`);
  });
  
  // Admin dashboard connection
  socket.on('join-admin', (data) => {
    const { adminId, token } = data;
    // TODO: Verify JWT token and admin role
    socket.join('admin-room');
    logger.info(`Admin ${adminId} joined dashboard`);
  });
  
  // Legacy support for direct location updates
  socket.on('driver-location', (data) => {
    socket.to(`ride-${data.rideId}`).emit('location-update', data);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes
app.set('io', io);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

module.exports = app;