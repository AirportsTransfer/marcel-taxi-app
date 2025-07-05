const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.templates = {};
    this.initializeTransporter();
    this.loadTemplates();
  }

  initializeTransporter() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  loadTemplates() {
    this.templates = {
      rideConfirmation: {
        subject: 'Rit bevestigd - #{rideId}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Rit Bevestiging</h2>
            <p>Beste #{customerName},</p>
            <p>Uw rit is bevestigd!</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Rit Details:</h3>
              <p><strong>Rit ID:</strong> #{rideId}</p>
              <p><strong>Datum:</strong> #{date}</p>
              <p><strong>Tijd:</strong> #{time}</p>
              <p><strong>Van:</strong> #{pickupLocation}</p>
              <p><strong>Naar:</strong> #{dropoffLocation}</p>
              <p><strong>Chauffeur:</strong> #{driverName}</p>
              <p><strong>Voertuig:</strong> #{vehicleInfo}</p>
              <p><strong>Prijs:</strong> €#{price}</p>
            </div>
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>Rit beheren</h3>
              <p>Log in op uw account om de datum/tijd te wijzigen of uw rit te annuleren:</p>
              <p><a href="#{accountLink}" style="background: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Mijn Account</a></p>
              <p><small>Gratis annuleren tot 24 uur voor uw vertrektijd. Daarna wordt het volledige bedrag in rekening gebracht.</small></p>
            </div>
            <p>U ontvangt een melding wanneer de chauffeur onderweg is.</p>
            <p>Met vriendelijke groet,<br>Het Taxi Team</p>
          </div>
        `
      },
      driverAssigned: {
        subject: 'Nieuwe rit toegewezen - #{rideId}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Nieuwe Rit Toegewezen</h2>
            <p>Beste #{driverName},</p>
            <p>U heeft een nieuwe rit toegewezen gekregen!</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Rit Details:</h3>
              <p><strong>Rit ID:</strong> #{rideId}</p>
              <p><strong>Klant:</strong> #{customerName}</p>
              <p><strong>Datum:</strong> #{date}</p>
              <p><strong>Tijd:</strong> #{time}</p>
              <p><strong>Ophaallocatie:</strong> #{pickupLocation}</p>
              <p><strong>Bestemming:</strong> #{dropoffLocation}</p>
              <p><strong>Afstand:</strong> #{distance} km</p>
              <p><strong>Geschatte tijd:</strong> #{estimatedTime} min</p>
            </div>
            <p>Log in op de app om deze rit te accepteren.</p>
            <p>Met vriendelijke groet,<br>Het Taxi Team</p>
          </div>
        `
      },
      rideCompleted: {
        subject: 'Rit voltooid - #{rideId}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Rit Voltooid</h2>
            <p>Beste #{customerName},</p>
            <p>Uw rit is succesvol voltooid!</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Rit Samenvatting:</h3>
              <p><strong>Rit ID:</strong> #{rideId}</p>
              <p><strong>Chauffeur:</strong> #{driverName}</p>
              <p><strong>Totale prijs:</strong> €#{totalPrice}</p>
              <p><strong>Afstand:</strong> #{distance} km</p>
              <p><strong>Duur:</strong> #{duration} min</p>
            </div>
            <p>Dank u voor het gebruik van onze diensten!</p>
            <p>#{reviewRequest}</p>
            <p>Met vriendelijke groet,<br>Het Taxi Team</p>
          </div>
        `
      },
      paymentConfirmation: {
        subject: 'Betaling bevestigd - #{rideId}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Betaling Bevestigd</h2>
            <p>Beste #{customerName},</p>
            <p>Uw betaling is succesvol verwerkt.</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Betalingsdetails:</h3>
              <p><strong>Rit ID:</strong> #{rideId}</p>
              <p><strong>Bedrag:</strong> €#{amount}</p>
              <p><strong>Betalingsmethode:</strong> #{paymentMethod}</p>
              <p><strong>Transactie ID:</strong> #{transactionId}</p>
              <p><strong>Datum:</strong> #{date}</p>
            </div>
            <p>Deze email dient als uw betalingsbewijs.</p>
            <p>Met vriendelijke groet,<br>Het Taxi Team</p>
          </div>
        `
      }
    };
  }

  async sendEmail(template, to, data, options = {}) {
    try {
      if (!this.templates[template]) {
        throw new Error(`Template '${template}' not found`);
      }

      const templateData = this.templates[template];
      const subject = this.replaceVariables(templateData.subject, data);
      const html = this.replaceVariables(templateData.html, data);

      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: to,
        subject: subject,
        html: html,
        ...options
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info(`Email sent successfully to ${to}`, {
        template,
        messageId: result.messageId,
        to
      });

      return {
        success: true,
        messageId: result.messageId
      };

    } catch (error) {
      logger.error('Failed to send email', {
        template,
        to,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  replaceVariables(template, data) {
    let result = template;
    
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`#{${key}}`, 'g');
      result = result.replace(regex, data[key] || '');
    });

    return result;
  }

  async sendRideConfirmation(customerEmail, rideData) {
    return await this.sendEmail('rideConfirmation', customerEmail, rideData);
  }

  async sendDriverAssignment(driverEmail, rideData) {
    return await this.sendEmail('driverAssigned', driverEmail, rideData);
  }

  async sendRideCompleted(customerEmail, rideData) {
    return await this.sendEmail('rideCompleted', customerEmail, rideData);
  }

  async sendPaymentConfirmation(customerEmail, paymentData) {
    return await this.sendEmail('paymentConfirmation', customerEmail, paymentData);
  }

  async sendCustomEmail(to, subject, html, options = {}) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: to,
        subject: subject,
        html: html,
        ...options
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info(`Custom email sent successfully to ${to}`, {
        messageId: result.messageId,
        to
      });

      return {
        success: true,
        messageId: result.messageId
      };

    } catch (error) {
      logger.error('Failed to send custom email', {
        to,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  async testConnection() {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection failed', { error: error.message });
      return false;
    }
  }
}

module.exports = new EmailService();