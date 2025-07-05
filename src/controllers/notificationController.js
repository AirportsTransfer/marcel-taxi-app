const NotificationService = require('../services/NotificationService');
const db = require('../config/database');
const logger = require('../utils/logger');

const notificationService = new NotificationService();

// Send test notification (Admin only)
const sendTestNotification = async (req, res) => {
  try {
    const { type, phone, email, message } = req.body;

    if (!type || !message) {
      return res.status(400).json({
        success: false,
        error: 'Type en message zijn verplicht'
      });
    }

    const results = [];

    if (phone && type.includes('sms')) {
      const smsResult = await notificationService.sendSMS(phone, message);
      results.push({ type: 'sms', ...smsResult });
    }

    if (email && type.includes('email')) {
      const emailResult = await notificationService.sendEmail(
        email,
        'Test Notificatie',
        `<p>${message}</p>`
      );
      results.push({ type: 'email', ...emailResult });
    }

    res.json({
      success: true,
      results: results
    });

  } catch (error) {
    logger.error('Test notification failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Test notificatie mislukt'
    });
  }
};

// Send ride confirmation notification
const sendRideConfirmation = async (req, res) => {
  try {
    const { rideId } = req.params;

    // Get ride details with customer info
    const ride = await db('rides')
      .join('users', 'rides.customer_id', 'users.id')
      .select(
        'rides.*',
        'users.name as customer_name',
        'users.email as customer_email',
        'users.phone as customer_phone'
      )
      .where('rides.id', rideId)
      .first();

    if (!ride) {
      return res.status(404).json({
        success: false,
        error: 'Rit niet gevonden'
      });
    }

    const customer = {
      name: ride.customer_name,
      email: ride.customer_email,
      phone: ride.customer_phone
    };

    const result = await notificationService.sendRideConfirmation(ride, customer);

    res.json({
      success: true,
      result: result
    });

  } catch (error) {
    logger.error('Send ride confirmation failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Bevestiging notificatie mislukt'
    });
  }
};

// Send driver assignment notification
const sendDriverAssignment = async (req, res) => {
  try {
    const { rideId } = req.params;

    // Get ride details with customer and driver info
    const ride = await db('rides')
      .join('users as customers', 'rides.customer_id', 'customers.id')
      .join('users as drivers', 'rides.driver_id', 'drivers.id')
      .leftJoin('vehicles', 'drivers.id', 'vehicles.driver_id')
      .select(
        'rides.*',
        'customers.name as customer_name',
        'customers.email as customer_email',
        'customers.phone as customer_phone',
        'drivers.name as driver_name',
        'drivers.phone as driver_phone',
        'vehicles.brand as vehicle_brand',
        'vehicles.model as vehicle_model',
        'vehicles.license_plate as vehicle_license_plate'
      )
      .where('rides.id', rideId)
      .first();

    if (!ride) {
      return res.status(404).json({
        success: false,
        error: 'Rit niet gevonden'
      });
    }

    if (!ride.driver_id) {
      return res.status(400).json({
        success: false,
        error: 'Geen chauffeur toegewezen'
      });
    }

    const customer = {
      name: ride.customer_name,
      email: ride.customer_email,
      phone: ride.customer_phone
    };

    const driver = {
      name: ride.driver_name,
      phone: ride.driver_phone,
      vehicle_brand: ride.vehicle_brand,
      vehicle_model: ride.vehicle_model,
      vehicle_license_plate: ride.vehicle_license_plate
    };

    const result = await notificationService.sendRideAssigned(ride, customer, driver);

    res.json({
      success: true,
      result: result
    });

  } catch (error) {
    logger.error('Send driver assignment failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Chauffeur toewijzing notificatie mislukt'
    });
  }
};

// Send ride status update notification
const sendRideStatusUpdate = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { status } = req.body;

    if (!['arrived', 'started', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Ongeldige status'
      });
    }

    // Get ride details
    const ride = await db('rides')
      .join('users as customers', 'rides.customer_id', 'customers.id')
      .leftJoin('users as drivers', 'rides.driver_id', 'drivers.id')
      .leftJoin('vehicles', 'drivers.id', 'vehicles.driver_id')
      .leftJoin('payments', 'rides.id', 'payments.ride_id')
      .select(
        'rides.*',
        'customers.name as customer_name',
        'customers.email as customer_email',
        'customers.phone as customer_phone',
        'drivers.name as driver_name',
        'drivers.phone as driver_phone',
        'vehicles.brand as vehicle_brand',
        'vehicles.model as vehicle_model',
        'vehicles.license_plate as vehicle_license_plate',
        'payments.payment_method',
        'payments.status as payment_status'
      )
      .where('rides.id', rideId)
      .first();

    if (!ride) {
      return res.status(404).json({
        success: false,
        error: 'Rit niet gevonden'
      });
    }

    const customer = {
      name: ride.customer_name,
      email: ride.customer_email,
      phone: ride.customer_phone
    };

    const driver = {
      name: ride.driver_name,
      phone: ride.driver_phone,
      vehicle_brand: ride.vehicle_brand,
      vehicle_model: ride.vehicle_model,
      vehicle_license_plate: ride.vehicle_license_plate
    };

    const payment = {
      payment_method: ride.payment_method,
      status: ride.payment_status
    };

    let result;
    switch (status) {
      case 'arrived':
        result = await notificationService.sendRideArrived(ride, customer, driver);
        break;
      case 'started':
        result = await notificationService.sendRideStarted(ride, customer, driver);
        break;
      case 'completed':
        result = await notificationService.sendRideCompleted(ride, customer, payment);
        break;
      case 'cancelled':
        result = await notificationService.sendRideCancellation(ride, customer, req.body.reason || 'Geen reden opgegeven');
        break;
    }

    res.json({
      success: true,
      result: result
    });

  } catch (error) {
    logger.error('Send ride status update failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Status update notificatie mislukt'
    });
  }
};

// Send ride modification notification
const sendRideModification = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { changes } = req.body;

    if (!changes || Object.keys(changes).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Geen wijzigingen opgegeven'
      });
    }

    // Get ride details
    const ride = await db('rides')
      .join('users', 'rides.customer_id', 'users.id')
      .select(
        'rides.*',
        'users.name as customer_name',
        'users.email as customer_email',
        'users.phone as customer_phone'
      )
      .where('rides.id', rideId)
      .first();

    if (!ride) {
      return res.status(404).json({
        success: false,
        error: 'Rit niet gevonden'
      });
    }

    const customer = {
      name: ride.customer_name,
      email: ride.customer_email,
      phone: ride.customer_phone
    };

    const result = await notificationService.sendRideModification(ride, customer, changes);

    res.json({
      success: true,
      result: result
    });

  } catch (error) {
    logger.error('Send ride modification failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Wijziging notificatie mislukt'
    });
  }
};

// Send no-show notification
const sendNoShowNotification = async (req, res) => {
  try {
    const { rideId } = req.params;

    // Get ride details
    const ride = await db('rides')
      .join('users', 'rides.customer_id', 'users.id')
      .select(
        'rides.*',
        'users.name as customer_name',
        'users.email as customer_email',
        'users.phone as customer_phone'
      )
      .where('rides.id', rideId)
      .first();

    if (!ride) {
      return res.status(404).json({
        success: false,
        error: 'Rit niet gevonden'
      });
    }

    const customer = {
      name: ride.customer_name,
      email: ride.customer_email,
      phone: ride.customer_phone
    };

    const result = await notificationService.sendNoShowNotification(ride, customer);

    res.json({
      success: true,
      result: result
    });

  } catch (error) {
    logger.error('Send no-show notification failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'No-show notificatie mislukt'
    });
  }
};

// Send driver notification
const sendDriverNotification = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { type, rideId, message } = req.body;

    if (!type || !message) {
      return res.status(400).json({
        success: false,
        error: 'Type en message zijn verplicht'
      });
    }

    // Get driver details
    const driver = await db('users')
      .select('phone', 'email', 'name')
      .where('id', driverId)
      .where('role', 'driver')
      .first();

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Chauffeur niet gevonden'
      });
    }

    let result;
    if (type === 'new_ride' && rideId) {
      // Get ride details for new ride assignment
      const ride = await db('rides')
        .select('*')
        .where('id', rideId)
        .first();

      if (ride) {
        result = await notificationService.sendNewRideAssignment(ride, driver);
      } else {
        result = await notificationService.sendSMS(driver.phone, message);
      }
    } else {
      // Send custom message
      result = await notificationService.sendSMS(driver.phone, message);
    }

    res.json({
      success: true,
      result: result
    });

  } catch (error) {
    logger.error('Send driver notification failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Chauffeur notificatie mislukt'
    });
  }
};

// Get notification history (Admin only)
const getNotificationHistory = async (req, res) => {
  try {
    const { limit = 50, offset = 0, type, status } = req.query;

    // This would require a notifications table to store history
    // For now, return a placeholder response
    res.json({
      success: true,
      notifications: [],
      total: 0,
      message: 'Notificatie geschiedenis niet beschikbaar - implementeer notifications tabel'
    });

  } catch (error) {
    logger.error('Get notification history failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Notificatie geschiedenis ophalen mislukt'
    });
  }
};

module.exports = {
  sendTestNotification,
  sendRideConfirmation,
  sendDriverAssignment,
  sendRideStatusUpdate,
  sendRideModification,
  sendNoShowNotification,
  sendDriverNotification,
  getNotificationHistory
};