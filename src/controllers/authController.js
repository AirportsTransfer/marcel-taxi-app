const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const db = require('../config/database');
const logger = require('../utils/logger');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

// Register new user
const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role = 'customer' } = req.body;

    // Check if user already exists
    const existingUser = await db('users').where('email', email).first();
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Gebruiker met dit email adres bestaat al'
      });
    }

    // Create new user
    const user = new User({
      email,
      firstName,
      lastName,
      phone,
      role
    });

    // Validate user data
    const validationErrors = user.validate();
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: validationErrors.join(', ')
      });
    }

    // Validate and hash password
    const passwordErrors = user.validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: passwordErrors.join(', ')
      });
    }

    await user.hashPassword(password);

    // Save to database
    await db('users').insert(user.toDatabase());

    // Generate token
    const token = generateToken(user.id);

    logger.info('User registered successfully', {
      userId: user.id,
      email: user.email,
      role: user.role
    });

    res.status(201).json({
      success: true,
      token,
      user: user.toAuthJSON()
    });

  } catch (error) {
    logger.error('Registration failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Registratie mislukt'
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email en wachtwoord zijn verplicht'
      });
    }

    // Check if user exists
    const userRow = await db('users').where('email', email).first();
    if (!userRow) {
      return res.status(401).json({
        success: false,
        error: 'Ongeldige inloggegevens'
      });
    }

    const user = User.fromDatabase(userRow);

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is gedeactiveerd'
      });
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Ongeldige inloggegevens'
      });
    }

    // Update last login
    user.updateLastLogin();
    await db('users').where('id', user.id).update({
      last_login_at: user.lastLoginAt
    });

    // Generate token
    const token = generateToken(user.id);

    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      role: user.role
    });

    res.json({
      success: true,
      token,
      user: user.toAuthJSON()
    });

  } catch (error) {
    logger.error('Login failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Inloggen mislukt'
    });
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user.toAuthJSON()
    });
  } catch (error) {
    logger.error('Get user failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Gebruikersgegevens ophalen mislukt'
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, preferences } = req.body;
    const user = req.user;

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };

    user.updatedAt = new Date();

    // Validate updated data
    const validationErrors = user.validate();
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: validationErrors.join(', ')
      });
    }

    // Update in database
    await db('users').where('id', user.id).update({
      first_name: user.firstName,
      last_name: user.lastName,
      phone: user.phone,
      preferences: JSON.stringify(user.preferences),
      updated_at: user.updatedAt
    });

    logger.info('User profile updated', { userId: user.id });

    res.json({
      success: true,
      user: user.toAuthJSON()
    });

  } catch (error) {
    logger.error('Profile update failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Profiel bijwerken mislukt'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Huidig en nieuw wachtwoord zijn verplicht'
      });
    }

    // Verify current password
    const isValidPassword = await user.comparePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: 'Huidig wachtwoord is onjuist'
      });
    }

    // Validate new password
    const passwordErrors = user.validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: passwordErrors.join(', ')
      });
    }

    // Hash new password
    await user.hashPassword(newPassword);
    user.updatedAt = new Date();

    // Update in database
    await db('users').where('id', user.id).update({
      password: user.password,
      updated_at: user.updatedAt
    });

    logger.info('User password changed', { userId: user.id });

    res.json({
      success: true,
      message: 'Wachtwoord succesvol gewijzigd'
    });

  } catch (error) {
    logger.error('Password change failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Wachtwoord wijzigen mislukt'
    });
  }
};

// Logout (mainly for logging purposes)
const logout = async (req, res) => {
  try {
    logger.info('User logged out', { userId: req.user.id });
    
    res.json({
      success: true,
      message: 'Succesvol uitgelogd'
    });
  } catch (error) {
    logger.error('Logout failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Uitloggen mislukt'
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout
};