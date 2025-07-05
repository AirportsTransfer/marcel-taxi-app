# Taxi Booking System

Een professionele, volwaardige taxi booking applicatie gebouwd voor Marcel's bedrijf met mogelijkheden voor white-label deployment.

## Features

### 🚗 Basis Functionaliteiten
- **Gebruiker Authenticatie**: Klanten, chauffeurs, admin, en dispatcher rollen
- **Rit Booking**: Volledige booking workflow met real-time updates
- **Betalingssysteem**: Meerdere betalingsmethoden (cash, bank transfer, kaart)
- **Real-time Tracking**: GPS tracking van chauffeurs en ritten
- **Notificaties**: SMS en email notificaties voor alle betrokkenen

### 💰 Geavanceerde Pricing
- **Flexible Pricing**: Basis tarief + per km/minuut
- **Fixed Pricing**: Vaste prijzen tussen postcodes en locaties
- **Dynamic Pricing**: Tijd-gebaseerde tarieven (spits, weekend, etc.)
- **Discount System**: Korting voor lange ritten

### 🤝 Partnership Systeem
- **Bedrijfs Partnerships**: Samenwerking tussen taxi bedrijven
- **Rit Sharing**: Automatische verdeling van ritten tussen partners
- **Commissie Systeem**: Configureerbare commissie rates

### 📱 Multi-Platform Support
- **REST API**: Complete backend API
- **Real-time Updates**: Socket.IO voor live updates
- **Mobile Ready**: Voorbereid voor React Native apps
- **Admin Dashboard**: Web-based admin interface

## Technische Stack

### Backend
- **Node.js** + **Express.js**
- **PostgreSQL** database
- **Redis** voor caching
- **Socket.IO** voor real-time communicatie
- **JWT** voor authenticatie

### Services
- **Twilio** voor SMS
- **Nodemailer** voor email
- **Stripe** en **Mollie** voor betalingen
- **Google Maps API** voor locaties

### Development Tools
- **Knex.js** voor database migraties
- **Winston** voor logging
- **Jest** voor testing
- **ESLint** voor code quality

## Installatie

### Prerequisites
- Node.js 16+
- PostgreSQL 12+
- Redis 6+

### Setup
1. Clone de repository
```bash
git clone [repository-url]
cd TaxiAppBoekingssysteem
```

2. Install dependencies
```bash
npm install
```

3. Setup environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Database setup
```bash
npm run db:migrate
npm run db:seed
```

5. Start de server
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Registreer nieuwe gebruiker
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/auth/me` - Huidige gebruiker info

### Rides
- `POST /api/v1/rides` - Nieuwe rit boeken
- `GET /api/v1/rides` - Lijst van ritten
- `GET /api/v1/rides/:id` - Rit details
- `PUT /api/v1/rides/:id` - Rit aanpassen
- `DELETE /api/v1/rides/:id` - Rit annuleren

### Payments
- `POST /api/v1/payments` - Betaling verwerken
- `GET /api/v1/payments/:id` - Betaling status
- `POST /api/v1/payments/webhook` - Payment webhook

### Tracking
- `POST /api/v1/tracking/location` - Locatie update (chauffeur)
- `GET /api/v1/tracking/nearby` - Chauffeurs in de buurt
- `GET /api/v1/tracking/drivers/:id/location` - Chauffeur locatie

### Notifications
- `POST /api/v1/notifications/rides/:id/confirmation` - Bevestiging sturen
- `POST /api/v1/notifications/rides/:id/assignment` - Chauffeur toewijzing
- `POST /api/v1/notifications/test` - Test notificatie

### Admin
- `GET /api/v1/admin/dashboard/stats` - Dashboard statistieken
- `GET /api/v1/admin/rides` - Alle ritten beheren
- `GET /api/v1/admin/users` - Gebruikers beheren
- `GET /api/v1/admin/reports/financial` - Financiële rapporten

## Database Schema

### Core Tables
- `users` - Gebruikers (klanten, chauffeurs, admin)
- `vehicles` - Voertuigen
- `rides` - Ritten
- `payments` - Betalingen
- `driver_locations` - Real-time chauffeur locaties

### Business Logic
- `pricing_rules` - Prijsregels en tarieven
- `company_partnerships` - Bedrijfs partnerships
- `ride_shares` - Gedeelde ritten tussen partners
- `no_shows` - No-show registratie
- `ride_modifications` - Rit aanpassingen

## Features in Detail

### 1. Booking Workflow
1. Klant boekt rit via app/website
2. Systeem berekent prijs o.b.v. regels
3. Klant kiest betalingsmethode
4. Bevestiging via SMS/email
5. Chauffeur wordt toegewezen
6. Real-time tracking tijdens rit
7. Betaling wordt verwerkt
8. Feedback en rating

### 2. Pricing System
- **Base fare**: Vaste startprijs
- **Distance**: Prijs per kilometer
- **Time**: Prijs per minuut
- **Fixed routes**: Vaste prijzen tussen locaties
- **Discounts**: Korting voor lange ritten
- **Surcharges**: Toeslag voor spits/weekend

### 3. No-Show Management
- Automatische detectie van no-shows
- Penalty charges voor herhaalde no-shows
- Grace period voor annulering
- Dispute resolution workflow

### 4. Partnership System
- Bedrijven kunnen samenwerken
- Automatische rit distributie
- Commissie berekening en facturering
- Coverage area management

### 5. Real-time Tracking
- GPS tracking van chauffeurs
- Live updates voor klanten
- Geofencing voor belangrijke locaties
- Route optimization
- Battery monitoring

## Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taxi_booking
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Twilio SMS
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_password
```

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Database Migrations
```bash
# Create new migration
knex migrate:make migration_name

# Run migrations
npm run db:migrate

# Rollback migration
knex migrate:rollback
```

### Adding New Features
1. Create database migration als nodig
2. Update models in `src/models/`
3. Create/update controllers in `src/controllers/`
4. Add routes in `src/routes/`
5. Update tests
6. Update documentation

## Deployment

### Production Setup
1. Setup PostgreSQL en Redis servers
2. Configure environment variables
3. Run database migrations
4. Setup SSL certificates
5. Configure reverse proxy (nginx)
6. Setup monitoring en logging

### White-label Deployment
Het systeem is ontworpen voor white-label deployment:
1. Copy de codebase
2. Update branding en configuratie
3. Setup eigen database
4. Configure payment providers
5. Deploy naar eigen infrastructure

## Security Features

- JWT authentication
- Password hashing met bcrypt
- Rate limiting
- Input validation
- SQL injection protection
- CORS configuratie
- Helmet security headers

## Monitoring

- Winston logging
- Error tracking
- Performance monitoring
- Real-time metrics
- Health checks

## Support

Voor vragen en support:
- Email: [your-email]
- Documentation: [docs-url]
- Issues: [github-issues-url]

## License

ISC License - See LICENSE file for details

---

Built with ❤️ for Marcel's Taxi Business