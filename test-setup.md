# Test Setup Guide

## 1. Database Setup

Eerst PostgreSQL en Redis installeren:

```bash
# PostgreSQL installeren (macOS)
brew install postgresql
brew services start postgresql

# Database aanmaken
createdb taxi_booking

# Redis installeren
brew install redis
brew services start redis
```

## 2. Environment Setup

```bash
# .env bestand aanmaken
cp .env.example .env
```

Minimale .env configuratie voor testing:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taxi_booking
DB_USER=your_username
DB_PASSWORD=your_password

# JWT
JWT_SECRET=test_secret_key_123456789
JWT_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=development

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Company Info
COMPANY_NAME=Marcel's Taxi Service
FRONTEND_URL=http://localhost:3000
```

## 3. Database Migraties

```bash
# Database schema aanmaken
npm run db:migrate
```

## 4. Server Starten

```bash
# Development server
npm run dev
```

## 5. Test API Endpoints

### A. Gebruiker Registratie
```bash
# Admin gebruiker aanmaken
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Marcel Admin",
    "email": "marcel@taxi.com",
    "password": "password123",
    "phone": "+31612345678",
    "role": "admin"
  }'
```

### B. Login
```bash
# Login en JWT token krijgen
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "marcel@taxi.com",
    "password": "password123"
  }'
```

### C. Chauffeur Registratie
```bash
# Chauffeur aanmaken (gebruik JWT token van admin)
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Jan Chauffeur",
    "email": "jan@taxi.com",
    "password": "password123",
    "phone": "+31687654321",
    "role": "driver"
  }'
```

### D. Klant Registratie
```bash
# Klant aanmaken
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Piet Klant",
    "email": "piet@gmail.com",
    "password": "password123",
    "phone": "+31698765432",
    "role": "customer"
  }'
```

### E. Rit Boeken
```bash
# Rit boeken (als klant)
curl -X POST http://localhost:3000/api/v1/rides \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer CUSTOMER_JWT_TOKEN" \
  -d '{
    "pickupLocation": {
      "address": "Dam 1, Amsterdam",
      "latitude": 52.3702,
      "longitude": 4.8952
    },
    "dropoffLocation": {
      "address": "Schiphol Airport, Amsterdam",
      "latitude": 52.3105,
      "longitude": 4.7683
    },
    "scheduledAt": "2024-01-20T10:00:00Z",
    "passengers": 2,
    "paymentMethod": "cash"
  }'
```

### F. Dashboard Stats
```bash
# Admin dashboard (als admin)
curl -X GET http://localhost:3000/api/v1/admin/dashboard/stats \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

## 6. Real-time Testing

### WebSocket Test (Browser Console)
```javascript
// Open browser console op http://localhost:3000
const socket = io('http://localhost:3000');

// Admin aansluiten
socket.emit('join-admin', {
  adminId: 'admin-user-id',
  token: 'your-jwt-token'
});

// Luisteren naar updates
socket.on('driver-location-update', (data) => {
  console.log('Driver location update:', data);
});
```

### Chauffeur Locatie Update
```bash
# Chauffeur locatie bijwerken
curl -X POST http://localhost:3000/api/v1/tracking/location \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer DRIVER_JWT_TOKEN" \
  -d '{
    "latitude": 52.3702,
    "longitude": 4.8952,
    "accuracy": 10,
    "speed": 25,
    "batteryLevel": 85
  }'
```

## 7. Postman Collection

Import deze JSON in Postman voor gemakkelijk testen:

```json
{
  "info": {
    "name": "Taxi Booking API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Register Admin",
          "request": {
            "method": "POST",
            "url": "http://localhost:3000/api/v1/auth/register",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"name\": \"Marcel Admin\",\n  \"email\": \"marcel@taxi.com\",\n  \"password\": \"password123\",\n  \"phone\": \"+31612345678\",\n  \"role\": \"admin\"\n}"
            }
          }
        },
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "url": "http://localhost:3000/api/v1/auth/login",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"marcel@taxi.com\",\n  \"password\": \"password123\"\n}"
            }
          }
        }
      ]
    }
  ]
}
```

## 8. Test Scenarios

### Scenario 1: Complete Booking Flow
1. Registreer admin, chauffeur, klant
2. Klant boekt rit
3. Admin wijst chauffeur toe
4. Chauffeur accepteert rit
5. Real-time tracking
6. Rit voltooien
7. Betaling verwerken

### Scenario 2: Pricing Rules
1. Admin maakt pricing rule aan
2. Test verschillende routes
3. Controleer berekende prijzen

### Scenario 3: Partnership
1. Maak twee bedrijven aan
2. Maak partnership
3. Test rit sharing

## 9. Health Check

```bash
# Server status controleren
curl http://localhost:3000/health
```

## 10. Logs Bekijken

```bash
# Server logs in terminal
tail -f logs/app.log
```

## Database Queries voor Testing

```sql
-- Gebruikers bekijken
SELECT * FROM users;

-- Ritten bekijken
SELECT * FROM rides;

-- Betalingen bekijken
SELECT * FROM payments;

-- Chauffeur locaties
SELECT * FROM driver_locations;
```