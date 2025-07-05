// Demo server die werkt zonder database voor snelle test
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Mock database
let users = [];
let rides = [];
let currentUserId = 1;
let currentRideId = 1;

// Helper functie voor JWT (mock)
function generateToken(user) {
  return `mock_token_${user.id}_${Date.now()}`;
}

function verifyToken(token) {
  if (!token || !token.startsWith('mock_token_')) return null;
  const userId = token.split('_')[2];
  return users.find(u => u.id == userId);
}

// Middleware voor auth
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = verifyToken(token);
  
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  req.user = user;
  next();
}

// API Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Demo server is running!',
    timestamp: new Date().toISOString()
  });
});

// Auth routes
app.post('/api/v1/auth/register', (req, res) => {
  const { name, email, password, phone, role = 'customer' } = req.body;
  
  // Check if user exists
  if (users.find(u => u.email === email)) {
    return res.status(400).json({
      success: false,
      error: 'Email already exists'
    });
  }
  
  const user = {
    id: currentUserId++,
    name,
    email,
    phone,
    role,
    is_active: true,
    created_at: new Date()
  };
  
  users.push(user);
  
  res.json({
    success: true,
    message: 'User registered successfully',
    user: { ...user }
  });
});

app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(400).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
  
  const token = generateToken(user);
  
  res.json({
    success: true,
    token,
    user: { ...user }
  });
});

app.get('/api/v1/auth/me', auth, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Rides routes
app.post('/api/v1/rides', auth, (req, res) => {
  const { pickupLocation, dropoffLocation, scheduledAt, passengers, paymentMethod } = req.body;
  
  // Simple price calculation
  const baseFare = 2.50;
  const distance = Math.random() * 20 + 5; // 5-25 km
  const price = (baseFare + (distance * 1.20)).toFixed(2);
  
  const ride = {
    id: currentRideId++,
    customer_id: req.user.id,
    customer_name: req.user.name,
    pickup_address: pickupLocation.address,
    destination_address: dropoffLocation.address,
    pickup_location: pickupLocation,
    dropoff_location: dropoffLocation,
    scheduled_at: scheduledAt,
    passengers,
    payment_method: paymentMethod,
    total_fare: parseFloat(price),
    status: 'pending',
    created_at: new Date()
  };
  
  rides.push(ride);
  
  res.json({
    success: true,
    message: 'Ride booked successfully',
    data: { ride }
  });
});

app.get('/api/v1/rides', auth, (req, res) => {
  let userRides = rides;
  
  if (req.user.role === 'customer') {
    userRides = rides.filter(r => r.customer_id === req.user.id);
  } else if (req.user.role === 'driver') {
    userRides = rides.filter(r => r.driver_id === req.user.id || r.status === 'pending');
  }
  
  res.json({
    success: true,
    data: {
      rides: userRides.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
  });
});

app.post('/api/v1/rides/:id/accept', auth, (req, res) => {
  const rideId = parseInt(req.params.id);
  const ride = rides.find(r => r.id === rideId);
  
  if (!ride) {
    return res.status(404).json({
      success: false,
      error: 'Ride not found'
    });
  }
  
  if (req.user.role !== 'driver') {
    return res.status(403).json({
      success: false,
      error: 'Only drivers can accept rides'
    });
  }
  
  ride.driver_id = req.user.id;
  ride.driver_name = req.user.name;
  ride.driver_phone = req.user.phone;
  ride.status = 'assigned';
  
  res.json({
    success: true,
    message: 'Ride accepted'
  });
});

// Tracking routes
app.post('/api/v1/tracking/status', auth, (req, res) => {
  const { status } = req.body;
  
  res.json({
    success: true,
    message: `Status updated to ${status}`
  });
});

// Admin routes
app.get('/api/v1/admin/dashboard/stats', auth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
  
  const today = new Date().toDateString();
  const todayRides = rides.filter(r => new Date(r.created_at).toDateString() === today);
  const activeRides = rides.filter(r => ['pending', 'assigned', 'in_progress'].includes(r.status));
  
  res.json({
    success: true,
    data: {
      rides: {
        today: todayRides.length,
        active: activeRides.length,
        total: rides.length
      },
      revenue: {
        today: todayRides.reduce((sum, r) => sum + r.total_fare, 0),
        total: rides.reduce((sum, r) => sum + r.total_fare, 0)
      },
      users: {
        totalCustomers: users.filter(u => u.role === 'customer').length,
        totalDrivers: users.filter(u => u.role === 'driver').length,
        activeDrivers: Math.floor(users.filter(u => u.role === 'driver').length * 0.7)
      }
    }
  });
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join-driver', (data) => {
    socket.join('drivers');
    console.log('Driver joined:', data.driverId);
  });
  
  socket.on('join-admin', (data) => {
    socket.join('admin');
    console.log('Admin joined:', data.adminId);
  });
  
  socket.on('join-ride', (data) => {
    socket.join(`ride-${data.rideId}`);
    console.log('Customer joined ride tracking:', data.rideId);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚗 Marcel's Taxi Demo Server is running on http://localhost:${PORT}`);
  console.log('📱 Open your browser and go to: http://localhost:3000');
  console.log('✨ No database required - this is a demo version!');
  
  // Create some demo users
  users.push({
    id: 999,
    name: 'Marcel Admin',
    email: 'marcel@taxi.com',
    phone: '+31612345678',
    role: 'admin',
    is_active: true,
    created_at: new Date()
  });
  
  console.log('👤 Demo admin user created: marcel@taxi.com (password: any)');
});