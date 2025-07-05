// Eenvoudige demo server met alleen Node.js built-in modules
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Mock database
let users = [
  {
    id: 1,
    name: 'Marcel Admin',
    email: 'marcel@taxi.com',
    phone: '+31612345678',
    role: 'admin',
    is_active: true
  }
];
let rides = [];
let currentUserId = 2;
let currentRideId = 1;

// Helper functions
function generateToken(user) {
  return `mock_token_${user.id}_${Date.now()}`;
}

function verifyToken(token) {
  if (!token || !token.startsWith('mock_token_')) return null;
  const userId = token.split('_')[2];
  return users.find(u => u.id == userId);
}

function getContentType(filePath) {
  const ext = path.extname(filePath);
  const types = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json'
  };
  return types[ext] || 'text/plain';
}

// Server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Serve static files
  if (pathname === '/' || pathname === '/index.html') {
    const filePath = path.join(__dirname, 'public', 'simple.html');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
      return;
    }
  }
  
  if (pathname.startsWith('/') && !pathname.startsWith('/api/')) {
    const filePath = path.join(__dirname, 'public', pathname);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath);
      const contentType = getContentType(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
      return;
    }
  }
  
  // API Routes
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    let data = {};
    try {
      if (body) data = JSON.parse(body);
    } catch (e) {}
    
    // Get auth token
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    const user = verifyToken(token);
    
    res.setHeader('Content-Type', 'application/json');
    
    // Health check
    if (pathname === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'OK',
        message: 'Simple demo server is running!',
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    // Register
    if (pathname === '/api/v1/auth/register' && req.method === 'POST') {
      const { name, email, password, phone, role = 'customer' } = data;
      
      if (users.find(u => u.email === email)) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          error: 'Email already exists'
        }));
        return;
      }
      
      const newUser = {
        id: currentUserId++,
        name,
        email,
        phone,
        role,
        is_active: true,
        created_at: new Date()
      };
      
      users.push(newUser);
      
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        message: 'User registered successfully',
        user: newUser
      }));
      return;
    }
    
    // Login
    if (pathname === '/api/v1/auth/login' && req.method === 'POST') {
      const { email, password } = data;
      
      const foundUser = users.find(u => u.email === email);
      if (!foundUser) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          error: 'Invalid credentials'
        }));
        return;
      }
      
      const token = generateToken(foundUser);
      
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        token,
        user: foundUser
      }));
      return;
    }
    
    // Me
    if (pathname === '/api/v1/auth/me' && req.method === 'GET') {
      if (!user) {
        res.writeHead(401);
        res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
        return;
      }
      
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        user: user
      }));
      return;
    }
    
    // Book ride
    if (pathname === '/api/v1/rides' && req.method === 'POST') {
      if (!user) {
        res.writeHead(401);
        res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
        return;
      }
      
      const { pickupLocation, dropoffLocation, scheduledAt, passengers, paymentMethod } = data;
      
      const distance = Math.random() * 20 + 5;
      const price = (2.50 + (distance * 1.20)).toFixed(2);
      
      const ride = {
        id: currentRideId++,
        customer_id: user.id,
        customer_name: user.name,
        pickup_address: pickupLocation.address,
        destination_address: dropoffLocation.address,
        scheduled_at: scheduledAt,
        passengers,
        payment_method: paymentMethod,
        total_fare: parseFloat(price),
        status: 'pending',
        created_at: new Date()
      };
      
      rides.push(ride);
      
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        message: 'Ride booked successfully',
        data: { ride }
      }));
      return;
    }
    
    // Get rides
    if (pathname === '/api/v1/rides' && req.method === 'GET') {
      if (!user) {
        res.writeHead(401);
        res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
        return;
      }
      
      let userRides = rides;
      if (user.role === 'customer') {
        userRides = rides.filter(r => r.customer_id === user.id);
      } else if (user.role === 'driver') {
        userRides = rides.filter(r => r.driver_id === user.id || r.status === 'pending');
      }
      
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: {
          rides: userRides.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        }
      }));
      return;
    }
    
    // Admin stats
    if (pathname === '/api/v1/admin/dashboard/stats' && req.method === 'GET') {
      if (!user || user.role !== 'admin') {
        res.writeHead(403);
        res.end(JSON.stringify({ success: false, error: 'Admin access required' }));
        return;
      }
      
      const today = new Date().toDateString();
      const todayRides = rides.filter(r => new Date(r.created_at).toDateString() === today);
      
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: {
          rides: {
            today: todayRides.length,
            active: rides.filter(r => ['pending', 'assigned'].includes(r.status)).length,
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
      }));
      return;
    }
    
    // 404
    res.writeHead(404);
    res.end(JSON.stringify({
      success: false,
      error: 'Not found'
    }));
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log('🚗 Marcel\'s Taxi Demo is nu live!');
  console.log(`📱 Open je browser: http://localhost:${PORT}`);
  console.log('✨ Demo gebruikers:');
  console.log('   Admin: marcel@taxi.com (elk wachtwoord werkt)');
  console.log('   Of registreer een nieuwe gebruiker!');
  console.log('');
  console.log('🔥 De app werkt nu volledig in je browser!');
});