const twilio = require('twilio');
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    // Initialize Twilio client
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendSMS(to, message) {
    try {
      if (!this.twilioClient) {
        logger.warn('Twilio niet geconfigureerd - SMS wordt niet verstuurd');
        return { success: false, error: 'SMS service niet beschikbaar' };
      }

      const result = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to
      });

      logger.info('SMS verstuurd', { to, messageId: result.sid });
      return { success: true, messageId: result.sid };
    } catch (error) {
      logger.error('SMS verzenden mislukt', { to, error: error.message });
      return { success: false, error: error.message };
    }
  }

  async sendEmail(to, subject, html, text = null) {
    try {
      if (!this.emailTransporter) {
        logger.warn('Email transporter niet geconfigureerd');
        return { success: false, error: 'Email service niet beschikbaar' };
      }

      const mailOptions = {
        from: `"${process.env.COMPANY_NAME || 'Taxi Service'}" <${process.env.SMTP_FROM}>`,
        to: to,
        subject: subject,
        html: html,
        text: text || this.htmlToText(html)
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      logger.info('Email verstuurd', { to, subject, messageId: result.messageId });
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Email verzenden mislukt', { to, subject, error: error.message });
      return { success: false, error: error.message };
    }
  }

  // Ride notification methods
  async sendRideConfirmation(ride, customer) {
    const message = this.createRideConfirmationMessage(ride, customer);
    const emailTemplate = this.createRideConfirmationEmail(ride, customer);
    
    const results = await Promise.allSettled([
      this.sendSMS(customer.phone, message),
      this.sendEmail(customer.email, 'Rit Bevestiging', emailTemplate)
    ]);

    return this.processNotificationResults(results);
  }

  async sendRideAssigned(ride, customer, driver) {
    const message = this.createRideAssignedMessage(ride, customer, driver);
    const emailTemplate = this.createRideAssignedEmail(ride, customer, driver);
    
    const results = await Promise.allSettled([
      this.sendSMS(customer.phone, message),
      this.sendEmail(customer.email, 'Chauffeur Toegewezen', emailTemplate)
    ]);

    return this.processNotificationResults(results);
  }

  async sendRideArrived(ride, customer, driver) {
    const message = `Uw chauffeur ${driver.name} is gearriveerd! Voertuig: ${driver.vehicle_brand} ${driver.vehicle_model}, kenteken: ${driver.vehicle_license_plate}`;
    
    const results = await Promise.allSettled([
      this.sendSMS(customer.phone, message)
    ]);

    return this.processNotificationResults(results);
  }

  async sendRideStarted(ride, customer, driver) {
    const message = `Uw rit is gestart! Verwachte aankomst: ${ride.estimated_arrival}. Volg uw rit via de app.`;
    
    const results = await Promise.allSettled([
      this.sendSMS(customer.phone, message)
    ]);

    return this.processNotificationResults(results);
  }

  async sendRideCompleted(ride, customer, payment) {
    const message = this.createRideCompletedMessage(ride, customer, payment);
    const emailTemplate = this.createRideCompletedEmail(ride, customer, payment);
    
    const results = await Promise.allSettled([
      this.sendSMS(customer.phone, message),
      this.sendEmail(customer.email, 'Rit Voltooid', emailTemplate)
    ]);

    return this.processNotificationResults(results);
  }

  async sendRideCancellation(ride, customer, reason) {
    const message = `Uw rit van ${ride.pickup_address} naar ${ride.destination_address} is geannuleerd. Reden: ${reason}`;
    
    const results = await Promise.allSettled([
      this.sendSMS(customer.phone, message)
    ]);

    return this.processNotificationResults(results);
  }

  async sendNoShowNotification(ride, customer) {
    const message = `U was niet aanwezig voor uw rit. Er worden no-show kosten in rekening gebracht. Contact ons voor vragen.`;
    
    const results = await Promise.allSettled([
      this.sendSMS(customer.phone, message)
    ]);

    return this.processNotificationResults(results);
  }

  // Driver notifications
  async sendNewRideAssignment(ride, driver) {
    const message = `Nieuwe rit toegewezen! Van: ${ride.pickup_address} naar: ${ride.destination_address}. Ophalen om: ${ride.pickup_time}`;
    
    const results = await Promise.allSettled([
      this.sendSMS(driver.phone, message)
    ]);

    return this.processNotificationResults(results);
  }

  async sendRideModification(ride, customer, changes) {
    const message = this.createRideModificationMessage(ride, customer, changes);
    const emailTemplate = this.createRideModificationEmail(ride, customer, changes);
    
    const results = await Promise.allSettled([
      this.sendSMS(customer.phone, message),
      this.sendEmail(customer.email, 'Rit Aangepast', emailTemplate)
    ]);

    return this.processNotificationResults(results);
  }

  // Message templates
  createRideConfirmationMessage(ride, customer) {
    return `Rit bevestigd! Van: ${ride.pickup_address} naar: ${ride.destination_address}. Datum: ${ride.pickup_date}, Tijd: ${ride.pickup_time}. Prijs: €${ride.total_fare}. Bekijk details in uw account.`;
  }

  createRideAssignedMessage(ride, customer, driver) {
    return `Chauffeur toegewezen! ${driver.name} komt u ophalen. Voertuig: ${driver.vehicle_brand} ${driver.vehicle_model}. Tel: ${driver.phone}`;
  }

  createRideCompletedMessage(ride, customer, payment) {
    return `Rit voltooid! Totaal: €${ride.total_fare}. Betaald via: ${payment.payment_method}. Bedankt voor uw vertrouwen!`;
  }

  createRideModificationMessage(ride, customer, changes) {
    let message = 'Uw rit is aangepast: ';
    if (changes.pickup_date) message += `Nieuwe datum: ${changes.pickup_date}. `;
    if (changes.pickup_time) message += `Nieuwe tijd: ${changes.pickup_time}. `;
    return message + 'Bekijk details in uw account.';
  }

  // Email templates
  createRideConfirmationEmail(ride, customer) {
    const accountUrl = `${process.env.FRONTEND_URL}/account/rides/${ride.id}`;
    
    return `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Rit Bevestiging</h2>
          <p>Beste ${customer.name},</p>
          <p>Uw rit is succesvol geboekt!</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Rit Details</h3>
            <p><strong>Van:</strong> ${ride.pickup_address}</p>
            <p><strong>Naar:</strong> ${ride.destination_address}</p>
            <p><strong>Datum:</strong> ${ride.pickup_date}</p>
            <p><strong>Tijd:</strong> ${ride.pickup_time}</p>
            <p><strong>Prijs:</strong> €${ride.total_fare}</p>
            <p><strong>Betalingsmethode:</strong> ${ride.payment_method}</p>
          </div>
          
          <p><strong>Belangrijke informatie:</strong></p>
          <ul>
            <li>U kunt uw rit aanpassen tot 24 uur voor vertrek</li>
            <li>Na 24 uur wordt het volledige bedrag in rekening gebracht</li>
            <li>Bij cash betaling is een bankkaartwaarborg vereist</li>
          </ul>
          
          <p>
            <a href="${accountUrl}" style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Beheer Uw Rit
            </a>
          </p>
          
          <p>Met vriendelijke groet,<br>
          ${process.env.COMPANY_NAME || 'Taxi Service'}</p>
        </body>
      </html>
    `;
  }

  createRideAssignedEmail(ride, customer, driver) {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Chauffeur Toegewezen</h2>
          <p>Beste ${customer.name},</p>
          <p>Er is een chauffeur toegewezen aan uw rit!</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Chauffeur Informatie</h3>
            <p><strong>Naam:</strong> ${driver.name}</p>
            <p><strong>Telefoon:</strong> ${driver.phone}</p>
            <p><strong>Voertuig:</strong> ${driver.vehicle_brand} ${driver.vehicle_model}</p>
            <p><strong>Kenteken:</strong> ${driver.vehicle_license_plate}</p>
          </div>
          
          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Rit Details</h3>
            <p><strong>Ophalen:</strong> ${ride.pickup_address}</p>
            <p><strong>Tijd:</strong> ${ride.pickup_time}</p>
            <p><strong>Bestemming:</strong> ${ride.destination_address}</p>
          </div>
          
          <p>Uw chauffeur neemt contact met u op voordat vertrek. U kunt uw rit live volgen via de app.</p>
          
          <p>Met vriendelijke groet,<br>
          ${process.env.COMPANY_NAME || 'Taxi Service'}</p>
        </body>
      </html>
    `;
  }

  createRideCompletedEmail(ride, customer, payment) {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Rit Voltooid</h2>
          <p>Beste ${customer.name},</p>
          <p>Uw rit is succesvol voltooid!</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Rit Samenvatting</h3>
            <p><strong>Van:</strong> ${ride.pickup_address}</p>
            <p><strong>Naar:</strong> ${ride.destination_address}</p>
            <p><strong>Datum:</strong> ${ride.pickup_date}</p>
            <p><strong>Totale prijs:</strong> €${ride.total_fare}</p>
            <p><strong>Betaald via:</strong> ${payment.payment_method}</p>
            ${payment.payment_method === 'cash' ? '<p><strong>Waarborg:</strong> Vrijgegeven</p>' : ''}
          </div>
          
          <p>Bedankt voor uw vertrouwen in onze service!</p>
          
          <p>Met vriendelijke groet,<br>
          ${process.env.COMPANY_NAME || 'Taxi Service'}</p>
        </body>
      </html>
    `;
  }

  createRideModificationEmail(ride, customer, changes) {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Rit Aangepast</h2>
          <p>Beste ${customer.name},</p>
          <p>Uw rit is succesvol aangepast!</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Nieuwe Rit Details</h3>
            <p><strong>Van:</strong> ${ride.pickup_address}</p>
            <p><strong>Naar:</strong> ${ride.destination_address}</p>
            <p><strong>Datum:</strong> ${changes.pickup_date || ride.pickup_date}</p>
            <p><strong>Tijd:</strong> ${changes.pickup_time || ride.pickup_time}</p>
            <p><strong>Prijs:</strong> €${ride.total_fare}</p>
          </div>
          
          <p>Uw wijzigingen zijn verwerkt. U ontvangt een nieuwe bevestiging als er een chauffeur wordt toegewezen.</p>
          
          <p>Met vriendelijke groet,<br>
          ${process.env.COMPANY_NAME || 'Taxi Service'}</p>
        </body>
      </html>
    `;
  }

  // Utility methods
  htmlToText(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  processNotificationResults(results) {
    const success = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;
    
    return {
      success: success > 0,
      sent: success,
      failed: failed,
      total: results.length
    };
  }

  // Batch notifications
  async sendBatchNotifications(notifications) {
    const results = await Promise.allSettled(
      notifications.map(async (notification) => {
        const { type, to, data } = notification;
        
        switch (type) {
          case 'ride_confirmation':
            return this.sendRideConfirmation(data.ride, data.customer);
          case 'ride_assigned':
            return this.sendRideAssigned(data.ride, data.customer, data.driver);
          case 'ride_arrived':
            return this.sendRideArrived(data.ride, data.customer, data.driver);
          case 'ride_started':
            return this.sendRideStarted(data.ride, data.customer, data.driver);
          case 'ride_completed':
            return this.sendRideCompleted(data.ride, data.customer, data.payment);
          case 'ride_cancelled':
            return this.sendRideCancellation(data.ride, data.customer, data.reason);
          case 'no_show':
            return this.sendNoShowNotification(data.ride, data.customer);
          default:
            throw new Error(`Unknown notification type: ${type}`);
        }
      })
    );

    return this.processNotificationResults(results);
  }
}

module.exports = NotificationService;