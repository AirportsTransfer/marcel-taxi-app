const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
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
app.use(helmet());
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