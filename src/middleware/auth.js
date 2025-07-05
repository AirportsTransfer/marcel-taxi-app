const jwt = require('jsonwebtoken');
const User = require('../models/User');
const db = require('../config/database');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Toegang geweigerd. Geen token verstrekt.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userRow = await db('users').where('id', decoded.userId).first();
    
    if (!userRow) {
      return res.status(401).json({ error: 'Token is niet geldig.' });
    }

    const user = User.fromDatabase(userRow);
    
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is gedeactiveerd.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token is niet geldig.' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Niet geautoriseerd.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Onvoldoende rechten.' });
    }

    next();
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userRow = await db('users').where('id', decoded.userId).first();
      
      if (userRow) {
        const user = User.fromDatabase(userRow);
        if (user.isActive) {
          req.user = user;
        }
      }
    }
    
    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};

module.exports = {
  auth,
  requireRole,
  optionalAuth
};