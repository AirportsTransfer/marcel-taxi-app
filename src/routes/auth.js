const express = require('express');
const { 
  register, 
  login, 
  getMe, 
  updateProfile, 
  changePassword, 
  logout 
} = require('../controllers/authController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/me', auth, getMe);
router.put('/profile', auth, updateProfile);
router.put('/password', auth, changePassword);
router.post('/logout', auth, logout);

module.exports = router;