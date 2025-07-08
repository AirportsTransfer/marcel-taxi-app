# Email Setup Guide for Marcel's Taxi Booking System

## Overview
Your taxi booking system now has professional email functionality integrated! When customers complete bookings, they will automatically receive confirmation emails, and you'll get admin notifications.

## Email Configuration

### Current Setup (Based on Your Screenshot)
- **From Name**: Airport Transfer
- **From Email**: info@airporttransfer.be
- **Reply To Email**: info@airporttransfer.be
- **Admin Email**: marceltataev@gmail.com
- **Connection Type**: SMTP - Your mail server
- **Provider**: Gmail
- **SMTP Host**: smtp.gmail.com
- **SMTP Port**: 587
- **SMTP Username**: info@airporttransfer.be
- **SMTP Security**: TLS (not SSL)

## Setup Steps

### 1. Configure Your Email Server
The SMTP settings are already configured based on your screenshot. You only need to update the password in `email-server.js`:

```javascript
smtp: {
    host: 'smtp.gmail.com',          // ✅ Already configured from your screenshot
    port: 587,                       // ✅ Already configured from your screenshot  
    secure: false,                   // ✅ TLS setting from your screenshot
    auth: {
        user: 'info@airporttransfer.be',  // ✅ Already configured from your screenshot
        pass: 'YOUR_GMAIL_APP_PASSWORD_HERE' // ⚠️ UPDATE THIS with your Gmail App Password
    },
    tls: {
        rejectUnauthorized: false
    }
}
```

**🔑 You need to replace `YOUR_GMAIL_APP_PASSWORD_HERE` with the actual Gmail App Password for info@airporttransfer.be**

### 2. Gmail App Password Setup

Since you're using Gmail SMTP (as shown in your screenshot), you need to create an App Password:

#### Steps to get Gmail App Password:
1. **Go to Google Account Settings**: https://myaccount.google.com/
2. **Security** → **2-Step Verification** (must be enabled first)
3. **App passwords** → **Generate App Password**
4. **Select app**: "Mail" 
5. **Select device**: "Other" → Type "Airport Transfer Booking System"
6. **Copy the 16-character password** (like: `abcd efgh ijkl mnop`)
7. **Use this password** in `email-server.js`

#### Your exact configuration (from screenshot):
```javascript
// This matches your screenshot exactly
smtp: {
    host: 'smtp.gmail.com',               // ✅ From your screenshot
    port: 587,                           // ✅ From your screenshot
    secure: false,                       // ✅ TLS selected (not SSL)
    auth: {
        user: 'info@airporttransfer.be', // ✅ From your screenshot
        pass: 'abcd efgh ijkl mnop'      // ⚠️ Replace with actual App Password
    }
}
```

### 3. Security Notes
- **Never use your regular email password** in the code
- For Gmail: Use "App Passwords" (2FA must be enabled)
- For cPanel: Use the email account password
- Store passwords in environment variables for production

### 4. Start the Email Server

```bash
# Install dependencies (already done)
npm install

# Start the email server
node email-server.js
```

The server will run on port 3001.

### 5. Test Email Functionality

```bash
# Test if email server is working
curl -X POST http://localhost:3001/api/test-email
```

## Email Templates

### Customer Confirmation Email Includes:
- Professional Airport Transfer branding
- Booking ID and reference number
- Complete trip details (from, to, date, time)
- Vehicle information
- Contact information
- Payment method
- Mobile-friendly design

### Admin Notification Email Includes:
- Urgent alert styling
- All booking details
- Customer contact information
- Trip requirements (passengers, luggage)
- Immediate action required notice

## File Structure
```
/TaxiAppBoekingssysteem/
├── email-server.js          # Email server with SMTP config
├── public/step3.html         # Updated with email integration
└── EMAIL_SETUP_GUIDE.md      # This guide
```

## How It Works

1. **Customer completes booking** in Step 3
2. **Booking data is sent** to `/api/send-booking-email`
3. **Two emails are sent simultaneously**:
   - Confirmation email to customer
   - Urgent notification to admin (marceltataev@gmail.com)
4. **Success/failure feedback** shown to customer

## Production Deployment

### Environment Variables
Create a `.env` file:
```env
EMAIL_HOST=mail.airporttransfer.be
EMAIL_PORT=587
EMAIL_USER=info@airporttransfer.be
EMAIL_PASS=your_secure_password
ADMIN_EMAIL=marceltataev@gmail.com
```

### Update email-server.js for production:
```javascript
const emailConfig = {
    smtp: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    }
};
```

## Troubleshooting

### Common Issues:

1. **"Connection refused"**
   - Check SMTP host and port
   - Verify firewall isn't blocking port 587/465

2. **"Authentication failed"**
   - Verify email address and password
   - For Gmail: ensure App Password is used
   - Check if 2FA is required

3. **"Self-signed certificate"**
   - Add `tls: { rejectUnauthorized: false }` to SMTP config

4. **Emails not received**
   - Check spam folders
   - Verify email addresses are correct
   - Test with different email providers

## Testing

### Manual Test:
1. Complete a booking in your system
2. Check customer email for confirmation
3. Check marceltataev@gmail.com for admin notification

### API Test:
```bash
curl -X POST http://localhost:3001/api/test-email \
  -H "Content-Type: application/json"
```

## Support

If you need help configuring your specific email provider:
1. Contact your hosting provider for SMTP settings
2. Check your email provider's documentation
3. Test with a simple email client first

Your email system is ready to go! Just update the SMTP password and you'll have professional booking confirmations working automatically! 📧✅