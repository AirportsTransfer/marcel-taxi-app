const db = require('../config/database');
const logger = require('../utils/logger');

// Dashboard overview statistics
const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get ride statistics
    const rideStats = await Promise.all([
      // Today's rides
      db('rides').where('created_at', '>=', todayStart).count('* as count').first(),
      // This week's rides
      db('rides').where('created_at', '>=', weekStart).count('* as count').first(),
      // This month's rides
      db('rides').where('created_at', '>=', monthStart).count('* as count').first(),
      // Total rides
      db('rides').count('* as count').first(),
      // Active rides
      db('rides').whereIn('status', ['assigned', 'picked_up', 'in_progress']).count('* as count').first(),
      // Completed rides today
      db('rides').where('status', 'completed').where('created_at', '>=', todayStart).count('* as count').first()
    ]);

    // Get revenue statistics
    const revenueStats = await Promise.all([
      // Today's revenue
      db('payments').where('status', 'completed').where('created_at', '>=', todayStart).sum('amount as total').first(),
      // This week's revenue
      db('payments').where('status', 'completed').where('created_at', '>=', weekStart).sum('amount as total').first(),
      // This month's revenue
      db('payments').where('status', 'completed').where('created_at', '>=', monthStart).sum('amount as total').first(),
      // Total revenue
      db('payments').where('status', 'completed').sum('amount as total').first()
    ]);

    // Get user statistics
    const userStats = await Promise.all([
      // Total customers
      db('users').where('role', 'customer').count('* as count').first(),
      // Total drivers
      db('users').where('role', 'driver').count('* as count').first(),
      // Active drivers (online)
      db('driver_locations').where('status', 'available').count('* as count').first(),
      // New customers this month
      db('users').where('role', 'customer').where('created_at', '>=', monthStart).count('* as count').first()
    ]);

    // Get driver status breakdown
    const driverStatusStats = await db('driver_locations')
      .select('status')
      .count('* as count')
      .groupBy('status');

    // Get ride status breakdown
    const rideStatusStats = await db('rides')
      .select('status')
      .count('* as count')
      .groupBy('status');

    // Get payment method breakdown
    const paymentMethodStats = await db('payments')
      .select('payment_method')
      .count('* as count')
      .sum('amount as total')
      .groupBy('payment_method');

    // Get top performing drivers
    const topDrivers = await db('rides')
      .join('users', 'rides.driver_id', 'users.id')
      .select('users.name', 'users.id')
      .count('rides.id as ride_count')
      .sum('rides.total_fare as total_earnings')
      .where('rides.status', 'completed')
      .where('rides.created_at', '>=', monthStart)
      .groupBy('users.id', 'users.name')
      .orderBy('ride_count', 'desc')
      .limit(5);

    // Get recent activities
    const recentActivities = await db('rides')
      .join('users as customers', 'rides.customer_id', 'customers.id')
      .leftJoin('users as drivers', 'rides.driver_id', 'drivers.id')
      .select(
        'rides.id',
        'rides.status',
        'rides.created_at',
        'rides.pickup_address',
        'rides.destination_address',
        'customers.name as customer_name',
        'drivers.name as driver_name'
      )
      .orderBy('rides.created_at', 'desc')
      .limit(10);

    res.json({
      success: true,
      data: {
        rides: {
          today: parseInt(rideStats[0].count),
          thisWeek: parseInt(rideStats[1].count),
          thisMonth: parseInt(rideStats[2].count),
          total: parseInt(rideStats[3].count),
          active: parseInt(rideStats[4].count),
          completedToday: parseInt(rideStats[5].count)
        },
        revenue: {
          today: parseFloat(revenueStats[0].total || 0),
          thisWeek: parseFloat(revenueStats[1].total || 0),
          thisMonth: parseFloat(revenueStats[2].total || 0),
          total: parseFloat(revenueStats[3].total || 0)
        },
        users: {
          totalCustomers: parseInt(userStats[0].count),
          totalDrivers: parseInt(userStats[1].count),
          activeDrivers: parseInt(userStats[2].count),
          newCustomersThisMonth: parseInt(userStats[3].count)
        },
        driverStatus: driverStatusStats.reduce((acc, stat) => {
          acc[stat.status] = parseInt(stat.count);
          return acc;
        }, {}),
        rideStatus: rideStatusStats.reduce((acc, stat) => {
          acc[stat.status] = parseInt(stat.count);
          return acc;
        }, {}),
        paymentMethods: paymentMethodStats.map(stat => ({
          method: stat.payment_method,
          count: parseInt(stat.count),
          total: parseFloat(stat.total)
        })),
        topDrivers: topDrivers.map(driver => ({
          id: driver.id,
          name: driver.name,
          rideCount: parseInt(driver.ride_count),
          totalEarnings: parseFloat(driver.total_earnings)
        })),
        recentActivities: recentActivities.map(activity => ({
          id: activity.id,
          status: activity.status,
          createdAt: activity.created_at,
          pickup: activity.pickup_address,
          destination: activity.destination_address,
          customer: activity.customer_name,
          driver: activity.driver_name
        }))
      }
    });

  } catch (error) {
    logger.error('Get dashboard stats failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Dashboard statistieken ophalen mislukt'
    });
  }
};

// Get rides with filters and pagination
const getRides = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      dateFrom,
      dateTo,
      customerId,
      driverId,
      search
    } = req.query;

    let query = db('rides')
      .join('users as customers', 'rides.customer_id', 'customers.id')
      .leftJoin('users as drivers', 'rides.driver_id', 'drivers.id')
      .select(
        'rides.*',
        'customers.name as customer_name',
        'customers.phone as customer_phone',
        'drivers.name as driver_name',
        'drivers.phone as driver_phone'
      );

    // Apply filters
    if (status) {
      query = query.where('rides.status', status);
    }

    if (dateFrom) {
      query = query.where('rides.created_at', '>=', new Date(dateFrom));
    }

    if (dateTo) {
      query = query.where('rides.created_at', '<=', new Date(dateTo));
    }

    if (customerId) {
      query = query.where('rides.customer_id', customerId);
    }

    if (driverId) {
      query = query.where('rides.driver_id', driverId);
    }

    if (search) {
      query = query.where(function() {
        this.where('customers.name', 'ilike', `%${search}%`)
          .orWhere('drivers.name', 'ilike', `%${search}%`)
          .orWhere('rides.pickup_address', 'ilike', `%${search}%`)
          .orWhere('rides.destination_address', 'ilike', `%${search}%`);
      });
    }

    // Get total count
    const totalQuery = query.clone();
    const totalResult = await totalQuery.count('* as count').first();
    const total = parseInt(totalResult.count);

    // Apply pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.offset(offset).limit(parseInt(limit));

    // Order by created_at desc
    query = query.orderBy('rides.created_at', 'desc');

    const rides = await query;

    res.json({
      success: true,
      data: {
        rides: rides,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Get rides failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Ritten ophalen mislukt'
    });
  }
};

// Get users with filters and pagination
const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      status,
      search
    } = req.query;

    let query = db('users')
      .select(
        'id',
        'name',
        'email',
        'phone',
        'role',
        'is_active',
        'created_at',
        'updated_at'
      );

    // Apply filters
    if (role) {
      query = query.where('role', role);
    }

    if (status === 'active') {
      query = query.where('is_active', true);
    } else if (status === 'inactive') {
      query = query.where('is_active', false);
    }

    if (search) {
      query = query.where(function() {
        this.where('name', 'ilike', `%${search}%`)
          .orWhere('email', 'ilike', `%${search}%`)
          .orWhere('phone', 'ilike', `%${search}%`);
      });
    }

    // Get total count
    const totalQuery = query.clone();
    const totalResult = await totalQuery.count('* as count').first();
    const total = parseInt(totalResult.count);

    // Apply pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.offset(offset).limit(parseInt(limit));

    // Order by created_at desc
    query = query.orderBy('created_at', 'desc');

    const users = await query;

    res.json({
      success: true,
      data: {
        users: users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Get users failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Gebruikers ophalen mislukt'
    });
  }
};

// Get financial reports
const getFinancialReport = async (req, res) => {
  try {
    const { dateFrom, dateTo, groupBy = 'day' } = req.query;

    const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateTo ? new Date(dateTo) : new Date();

    // Revenue by period
    let dateFormat;
    switch (groupBy) {
      case 'hour':
        dateFormat = 'YYYY-MM-DD HH24:00:00';
        break;
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'week':
        dateFormat = 'YYYY-WW';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
    }

    const revenueData = await db('payments')
      .select(db.raw(`TO_CHAR(created_at, '${dateFormat}') as period`))
      .sum('amount as total')
      .count('* as count')
      .where('status', 'completed')
      .where('created_at', '>=', startDate)
      .where('created_at', '<=', endDate)
      .groupBy(db.raw(`TO_CHAR(created_at, '${dateFormat}')`))
      .orderBy('period');

    // Payment method breakdown
    const paymentMethodData = await db('payments')
      .select('payment_method')
      .sum('amount as total')
      .count('* as count')
      .where('status', 'completed')
      .where('created_at', '>=', startDate)
      .where('created_at', '<=', endDate)
      .groupBy('payment_method');

    // Driver earnings
    const driverEarnings = await db('rides')
      .join('users', 'rides.driver_id', 'users.id')
      .select('users.name', 'users.id')
      .sum('rides.total_fare as total_earnings')
      .count('rides.id as ride_count')
      .where('rides.status', 'completed')
      .where('rides.created_at', '>=', startDate)
      .where('rides.created_at', '<=', endDate)
      .groupBy('users.id', 'users.name')
      .orderBy('total_earnings', 'desc');

    // Summary statistics
    const summary = await db('payments')
      .select(
        db.raw('SUM(amount) as total_revenue'),
        db.raw('COUNT(*) as total_transactions'),
        db.raw('AVG(amount) as avg_transaction')
      )
      .where('status', 'completed')
      .where('created_at', '>=', startDate)
      .where('created_at', '<=', endDate)
      .first();

    res.json({
      success: true,
      data: {
        summary: {
          totalRevenue: parseFloat(summary.total_revenue || 0),
          totalTransactions: parseInt(summary.total_transactions || 0),
          avgTransaction: parseFloat(summary.avg_transaction || 0)
        },
        revenueByPeriod: revenueData.map(item => ({
          period: item.period,
          total: parseFloat(item.total),
          count: parseInt(item.count)
        })),
        paymentMethods: paymentMethodData.map(item => ({
          method: item.payment_method,
          total: parseFloat(item.total),
          count: parseInt(item.count)
        })),
        driverEarnings: driverEarnings.map(item => ({
          driverId: item.id,
          name: item.name,
          totalEarnings: parseFloat(item.total_earnings),
          rideCount: parseInt(item.ride_count)
        }))
      }
    });

  } catch (error) {
    logger.error('Get financial report failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Financieel rapport ophalen mislukt'
    });
  }
};

// Update user status
const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive moet een boolean zijn'
      });
    }

    const updated = await db('users')
      .where('id', userId)
      .update({
        is_active: isActive,
        updated_at: new Date()
      });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Gebruiker niet gevonden'
      });
    }

    res.json({
      success: true,
      message: `Gebruiker ${isActive ? 'geactiveerd' : 'gedeactiveerd'}`
    });

  } catch (error) {
    logger.error('Update user status failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Gebruiker status bijwerken mislukt'
    });
  }
};

// Get system logs
const getSystemLogs = async (req, res) => {
  try {
    const { level = 'info', limit = 100 } = req.query;

    // This is a placeholder - in production, you'd read from actual log files
    // or a centralized logging system
    const logs = [
      {
        timestamp: new Date(),
        level: 'info',
        message: 'System logs feature in development',
        metadata: {}
      }
    ];

    res.json({
      success: true,
      data: {
        logs: logs,
        message: 'Log systeem nog in ontwikkeling'
      }
    });

  } catch (error) {
    logger.error('Get system logs failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Systeem logs ophalen mislukt'
    });
  }
};

module.exports = {
  getDashboardStats,
  getRides,
  getUsers,
  getFinancialReport,
  updateUserStatus,
  getSystemLogs
};