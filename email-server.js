// Email Server for Marcel's Taxi Booking System
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for large bookings with images
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// Email configuration for info@airporttransfer.be (based on your screenshot settings)
const emailConfig = {
    fromName: 'Airport Transfer',
    fromEmail: 'info@airporttransfer.be',
    replyToEmail: 'info@airporttransfer.be',
    adminEmail: 'marceltataev@gmail.com',
    
    // SMTP Configuration (exactly from your screenshot)
    smtp: {
        host: 'smtp.gmail.com',           // SMTP host from your screenshot
        port: 587,                       // SMTP port from your screenshot
        secure: false,                   // TLS selected in your screenshot (not SSL)
        auth: {
            user: 'info@airporttransfer.be',  // SMTP username from your screenshot
            pass: 'YOUR_GMAIL_APP_PASSWORD_HERE' // ⚠️ UPDATE THIS with your Gmail App Password
        },
        tls: {
            rejectUnauthorized: false
        }
    }
};

// Create transporter
const transporter = nodemailer.createTransport({
    host: emailConfig.smtp.host,
    port: emailConfig.smtp.port,
    secure: emailConfig.smtp.secure,
    auth: emailConfig.smtp.auth,
    tls: emailConfig.smtp.tls
});

// Email templates
function generateCustomerConfirmationEmail(booking) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Booking Confirmation</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 30px 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; }
            .header p { margin: 5px 0 0 0; opacity: 0.9; }
            .content { padding: 30px 20px; background: #f8f9fa; }
            .booking-card { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin: 20px 0; }
            .booking-id { background: #667eea; color: white; padding: 10px 15px; border-radius: 6px; display: inline-block; font-weight: bold; margin-bottom: 20px; }
            .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-row:last-child { border-bottom: none; }
            .detail-label { font-weight: 600; color: #666; }
            .detail-value { font-weight: 500; color: #2c3e50; }
            .contact-info { background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
            .important { color: #e74c3c; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚗 Airport Transfer</h1>
                <p>Professional Taxi Service</p>
            </div>
            
            <div class="content">
                <h2>Dear ${booking.customer.firstName} ${booking.customer.lastName},</h2>
                
                <p>Thank you for choosing Airport Transfer! Your booking has been successfully received and is currently <strong>awaiting confirmation</strong>.</p>
                
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; color: #856404;">
                        <strong>⏳ Status: Awaiting Confirmation</strong><br>
                        We will review your booking request and confirm availability shortly. You will receive a confirmation email once your booking is confirmed.
                    </p>
                </div>
                
                <div class="booking-card">
                    <div class="booking-id">Booking ID: ${booking.bookingId}</div>
                    
                    <h3>Trip Details</h3>
                    <div class="detail-row">
                        <span class="detail-label">From:</span>
                        <span class="detail-value">${booking.trip.fromLocation}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">To:</span>
                        <span class="detail-value">${booking.trip.toLocation}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Date & Time:</span>
                        <span class="detail-value">${booking.trip.travelDate} at ${booking.trip.travelHour}:${booking.trip.travelMinute}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Vehicle:</span>
                        <span class="detail-value">${booking.vehicle.vehicle?.name || 'Standard Vehicle'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Passengers:</span>
                        <span class="detail-value">${booking.customer.passengers}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Phone:</span>
                        <span class="detail-value">${booking.customer.phone}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Payment Method:</span>
                        <span class="detail-value">${booking.customer.paymentMethod}</span>
                    </div>
                </div>
                
                <div class="contact-info">
                    <h3>What happens next?</h3>
                    <p>1. We will review your booking request</p>
                    <p>2. You will receive a confirmation email within 30 minutes</p>
                    <p>3. We will contact you 30 minutes before pickup</p>
                    <p style="margin-top: 15px;"><strong>Questions?</strong> Contact us:</p>
                    <p><strong>Email:</strong> info@airporttransfer.be</p>
                    <p><strong>Phone:</strong> +32 xxx xx xx xx</p>
                </div>
            </div>
            
            <div class="footer">
                <p>Thank you for choosing Airport Transfer!</p>
                <p>This is an automated confirmation. Please save this email for your records.</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

function generateAdminNotificationEmail(booking) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>New Booking - ${booking.bookingId}</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background: #e74c3c; color: white; padding: 20px; text-align: center; }
            .urgent { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px; border-radius: 6px; color: #856404; }
            .booking-details { background: white; padding: 20px; margin: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .detail-row { padding: 5px 0; border-bottom: 1px solid #eee; }
            .detail-row:last-child { border-bottom: none; }
            .label { font-weight: bold; color: #2c3e50; }
            .value { color: #34495e; }
            .booking-id { background: #e74c3c; color: white; padding: 8px 12px; border-radius: 4px; display: inline-block; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚨 NEW BOOKING ALERT</h1>
                <p>Airport Transfer - Admin Notification</p>
            </div>
            
            <div class="urgent">
                <strong>⚠️ URGENT:</strong> New taxi booking received - requires immediate attention!
            </div>
            
            <div class="booking-details">
                <h2>Booking Information</h2>
                <div class="booking-id">ID: ${booking.bookingId}</div>
                <br><br>
                
                <div class="detail-row">
                    <span class="label">Customer:</span>
                    <span class="value">${booking.customer.firstName} ${booking.customer.lastName}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Email:</span>
                    <span class="value">${booking.customer.email}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Phone:</span>
                    <span class="value">${booking.customer.phone}</span>
                </div>
                <div class="detail-row">
                    <span class="label">From:</span>
                    <span class="value">${booking.trip.fromLocation}</span>
                </div>
                <div class="detail-row">
                    <span class="label">To:</span>
                    <span class="value">${booking.trip.toLocation}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Date & Time:</span>
                    <span class="value">${booking.trip.travelDate} at ${booking.trip.travelHour}:${booking.trip.travelMinute}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Vehicle:</span>
                    <span class="value">${booking.vehicle.vehicle?.name || 'Standard'}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Passengers:</span>
                    <span class="value">${booking.customer.passengers}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Luggage:</span>
                    <span class="value">${booking.customer.koffers} suitcases, ${booking.customer.handbagage} hand luggage</span>
                </div>
                <div class="detail-row">
                    <span class="label">Payment Method:</span>
                    <span class="value">${booking.customer.paymentMethod}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Return Trip:</span>
                    <span class="value">${booking.trip.returnActive === 'true' ? 'Yes' : 'No'}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Extra Stops:</span>
                    <span class="value">${booking.trip.extraStopCount || 0}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Booking Time:</span>
                    <span class="value">${new Date(booking.bookingDate).toLocaleString()}</span>
                </div>
            </div>
            
            <div style="text-align: center; padding: 20px; background: #fff3cd;">
                <strong>Action Required: Please process this booking ASAP!</strong>
            </div>
        </div>
    </body>
    </html>
    `;
}

// API endpoint to send booking emails
app.post('/api/send-booking-email', async (req, res) => {
    try {
        const booking = req.body;
        
        console.log('📧 Processing booking email for:', booking.bookingId);
        
        // Send customer confirmation email
        const customerEmail = {
            from: `${emailConfig.fromName} <${emailConfig.fromEmail}>`,
            to: booking.customer.email,
            subject: `Booking Received - ${booking.bookingId} | Airport Transfer (Awaiting Confirmation)`,
            html: generateCustomerConfirmationEmail(booking),
            replyTo: emailConfig.replyToEmail
        };
        
        await transporter.sendMail(customerEmail);
        console.log('✅ Customer email sent to:', booking.customer.email);
        
        // Send admin notification email
        const adminEmail = {
            from: `${emailConfig.fromName} <${emailConfig.fromEmail}>`,
            to: emailConfig.adminEmail,
            subject: `🚨 NEW BOOKING: ${booking.bookingId} - ${booking.trip.fromLocation} to ${booking.trip.toLocation}`,
            html: generateAdminNotificationEmail(booking),
            replyTo: emailConfig.replyToEmail
        };
        
        await transporter.sendMail(adminEmail);
        console.log('✅ Admin email sent to:', emailConfig.adminEmail);
        
        res.json({ 
            success: true, 
            message: 'Emails sent successfully',
            customerEmail: booking.customer.email,
            adminEmail: emailConfig.adminEmail
        });
        
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Test email endpoint
app.post('/api/test-email', async (req, res) => {
    try {
        const testEmail = {
            from: `${emailConfig.fromName} <${emailConfig.fromEmail}>`,
            to: emailConfig.adminEmail,
            subject: 'Test Email - Airport Transfer System',
            html: '<h1>Test Email</h1><p>Email system is working correctly!</p>'
        };
        
        await transporter.sendMail(testEmail);
        res.json({ success: true, message: 'Test email sent successfully' });
    } catch (error) {
        console.error('Test email failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`📧 Email server running on port ${PORT}`);
    console.log(`📧 SMTP configured for: ${emailConfig.fromEmail}`);
});

module.exports = app;