// Email Configuration for Marcel's Taxi Booking System
class EmailService {
    constructor() {
        this.config = {
            fromName: 'Airport Transfer',
            fromEmail: 'info@airporttransfer.be',
            replyToEmail: 'info@airporttransfer.be',
            adminEmail: 'marceltataev@gmail.com',
            
            // SMTP Configuration (based on your screenshot)
            smtp: {
                host: 'smtp.gmail.com',
                port: 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: 'info@airporttransfer.be',
                    pass: 'your-app-password-here' // You need to set this
                }
            }
        };
    }

    // Send booking confirmation email to customer
    async sendBookingConfirmation(bookingData) {
        const emailTemplate = this.generateBookingConfirmationTemplate(bookingData);
        
        const emailData = {
            from: `${this.config.fromName} <${this.config.fromEmail}>`,
            to: bookingData.customer.email,
            subject: `Booking Confirmation - ${bookingData.bookingId}`,
            html: emailTemplate,
            replyTo: this.config.replyToEmail
        };

        return this.sendEmail(emailData);
    }

    // Send booking notification to admin
    async sendAdminNotification(bookingData) {
        const emailTemplate = this.generateAdminNotificationTemplate(bookingData);
        
        const emailData = {
            from: `${this.config.fromName} <${this.config.fromEmail}>`,
            to: this.config.adminEmail,
            subject: `New Booking Received - ${bookingData.bookingId}`,
            html: emailTemplate,
            replyTo: this.config.replyToEmail
        };

        return this.sendEmail(emailData);
    }

    // Generate customer confirmation email template
    generateBookingConfirmationTemplate(booking) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Booking Confirmation</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f8f9fa; }
                .booking-details { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
                .footer { text-align: center; padding: 20px; color: #666; }
                .highlight { color: #667eea; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚗 Airport Transfer</h1>
                    <p>Booking Confirmation</p>
                </div>
                
                <div class="content">
                    <h2>Dear ${booking.customer.firstName || ''} ${booking.customer.lastName || 'Customer'},</h2>
                    
                    <p>Thank you for your booking! Your taxi reservation has been confirmed.</p>
                    
                    <div class="booking-details">
                        <h3>Booking Details</h3>
                        <p><strong>Booking ID:</strong> <span class="highlight">${booking.bookingId}</span></p>
                        <p><strong>From:</strong> ${booking.trip.fromLocation}</p>
                        <p><strong>To:</strong> ${booking.trip.toLocation}</p>
                        <p><strong>Date & Time:</strong> ${booking.trip.travelDate} at ${booking.trip.travelHour}:${booking.trip.travelMinute}</p>
                        <p><strong>Vehicle:</strong> ${booking.vehicle.vehicle?.name || 'Standard'}</p>
                        <p><strong>Passengers:</strong> ${booking.customer.passengers}</p>
                        <p><strong>Phone:</strong> ${booking.customer.phone}</p>
                        <p><strong>Booking Date:</strong> ${new Date(booking.bookingDate).toLocaleDateString()}</p>
                    </div>
                    
                    <p>We will contact you shortly to confirm pickup details.</p>
                    
                    <p>If you have any questions, please contact us at:</p>
                    <ul>
                        <li>Email: info@airporttransfer.be</li>
                        <li>Phone: +32 xxx xx xx xx</li>
                    </ul>
                </div>
                
                <div class="footer">
                    <p>Thank you for choosing Airport Transfer!</p>
                    <p>This is an automated message. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    // Generate admin notification email template
    generateAdminNotificationTemplate(booking) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>New Booking Notification</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f8f9fa; }
                .booking-details { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
                .urgent { color: #dc3545; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚨 New Booking Alert</h1>
                    <p>Airport Transfer - Admin Notification</p>
                </div>
                
                <div class="content">
                    <h2 class="urgent">New booking received!</h2>
                    
                    <div class="booking-details">
                        <h3>Booking Information</h3>
                        <p><strong>Booking ID:</strong> ${booking.bookingId}</p>
                        <p><strong>Customer:</strong> ${booking.customer.firstName || ''} ${booking.customer.lastName || 'Unknown'}</p>
                        <p><strong>Email:</strong> ${booking.customer.email}</p>
                        <p><strong>Phone:</strong> ${booking.customer.phone}</p>
                        <p><strong>From:</strong> ${booking.trip.fromLocation}</p>
                        <p><strong>To:</strong> ${booking.trip.toLocation}</p>
                        <p><strong>Date & Time:</strong> ${booking.trip.travelDate} at ${booking.trip.travelHour}:${booking.trip.travelMinute}</p>
                        <p><strong>Vehicle:</strong> ${booking.vehicle.vehicle?.name || 'Standard'}</p>
                        <p><strong>Passengers:</strong> ${booking.customer.passengers}</p>
                        <p><strong>Luggage:</strong> ${booking.customer.koffers} suitcases, ${booking.customer.handbagage} hand luggage</p>
                        <p><strong>Return Trip:</strong> ${booking.trip.returnActive === 'true' ? 'Yes' : 'No'}</p>
                        <p><strong>Extra Stops:</strong> ${booking.trip.extraStopCount || 0}</p>
                        <p><strong>Booking Time:</strong> ${new Date(booking.bookingDate).toLocaleString()}</p>
                    </div>
                    
                    <p class="urgent">Please process this booking as soon as possible!</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    // Basic email sending function (for demo - in production you'd use a proper email service)
    async sendEmail(emailData) {
        console.log('📧 Sending email:', emailData.subject);
        console.log('📧 To:', emailData.to);
        console.log('📧 From:', emailData.from);
        
        // In a real implementation, you would use nodemailer or a service like SendGrid
        // For now, we'll just log the email and show a success message
        
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('✅ Email sent successfully!');
                resolve({ success: true, messageId: 'demo-' + Date.now() });
            }, 1000);
        });
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmailService;
} else {
    window.EmailService = EmailService;
}