const Payment = require('../models/Payment');
const Ride = require('../models/Ride');
const db = require('../config/database');
const logger = require('../utils/logger');

// Create payment for ride
const createPayment = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { method, bankDetails } = req.body;

    // Validate payment method
    if (!['cash', 'bank_transfer', 'card_in_taxi', 'online_card'].includes(method)) {
      return res.status(400).json({
        success: false,
        error: 'Ongeldige betalingsmethode'
      });
    }

    // Get ride details
    const rideRow = await db('rides').where('id', rideId).first();
    if (!rideRow) {
      return res.status(404).json({
        success: false,
        error: 'Rit niet gevonden'
      });
    }

    const ride = Ride.fromDatabase(rideRow);

    // Check if user owns this ride
    if (ride.customerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Geen toegang tot deze rit'
      });
    }

    // Check if payment already exists
    const existingPayment = await db('payments').where('ride_id', rideId).first();
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        error: 'Er bestaat al een betaling voor deze rit'
      });
    }

    // Create payment
    const payment = new Payment({
      rideId: rideId,
      customerId: req.user.id,
      amount: ride.totalFare,
      method: method
    });

    // Validate bank details if required
    if (payment.requiresBankDetails()) {
      if (!bankDetails || !bankDetails.cardNumber || !bankDetails.expiryDate || !bankDetails.cardHolderName) {
        return res.status(400).json({
          success: false,
          error: 'Bankgegevens zijn verplicht als waarborg'
        });
      }

      payment.setBankDetails(bankDetails);
    }

    // Validate payment
    const validationErrors = payment.validate();
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: validationErrors.join(', ')
      });
    }

    // For cash and card_in_taxi, authorize with bank details as warranty
    if (payment.requiresPreAuthorization()) {
      // In real app, this would create a small authorization (€1) on the card
      payment.authorize(`AUTH_${Date.now()}`, bankDetails);
    }

    // For online payments, process immediately
    if (method === 'online_card') {
      // In real app, integrate with Stripe/Mollie here
      payment.markAsPaid(`TXN_${Date.now()}`);
    }

    // Save payment
    await db('payments').insert(payment.toDatabase());

    // Update ride payment status
    await db('rides').where('id', rideId).update({
      payment_status: payment.status,
      payment_method: payment.method,
      updated_at: new Date()
    });

    logger.info('Payment created', {
      paymentId: payment.id,
      rideId: rideId,
      method: payment.method,
      amount: payment.amount,
      status: payment.status
    });

    res.status(201).json({
      success: true,
      payment: payment.toJSON(),
      message: getPaymentMessage(payment)
    });

  } catch (error) {
    logger.error('Create payment failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Betaling aanmaken mislukt'
    });
  }
};

// Get payment details
const getPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const paymentRow = await db('payments').where('id', paymentId).first();
    if (!paymentRow) {
      return res.status(404).json({
        success: false,
        error: 'Betaling niet gevonden'
      });
    }

    const payment = Payment.fromDatabase(paymentRow);

    // Check if user has access
    if (payment.customerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Geen toegang tot deze betaling'
      });
    }

    res.json({
      success: true,
      payment: payment.toJSON()
    });

  } catch (error) {
    logger.error('Get payment failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Betaling ophalen mislukt'
    });
  }
};

// Update payment status (for cash/card_in_taxi completion)
const updatePaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status, transactionId } = req.body;

    const paymentRow = await db('payments').where('id', paymentId).first();
    if (!paymentRow) {
      return res.status(404).json({
        success: false,
        error: 'Betaling niet gevonden'
      });
    }

    const payment = Payment.fromDatabase(paymentRow);

    // Only admin or the customer can update payment status
    if (payment.customerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Geen toegang tot deze betaling'
      });
    }

    // Update payment status
    if (status === 'paid') {
      payment.markAsPaid(transactionId || `MANUAL_${Date.now()}`);
    } else if (status === 'failed') {
      payment.markAsFailed('Betaling mislukt');
    }

    // Save updated payment
    await db('payments').where('id', paymentId).update({
      status: payment.status,
      transaction_id: payment.transactionId,
      processed_at: payment.processedAt,
      failure_reason: payment.failureReason,
      updated_at: payment.updatedAt
    });

    // Update ride payment status
    await db('rides').where('id', payment.rideId).update({
      payment_status: payment.status,
      updated_at: new Date()
    });

    logger.info('Payment status updated', {
      paymentId: payment.id,
      newStatus: payment.status,
      transactionId: payment.transactionId
    });

    res.json({
      success: true,
      payment: payment.toJSON(),
      message: `Betaling ${payment.status === 'paid' ? 'voltooid' : 'bijgewerkt'}`
    });

  } catch (error) {
    logger.error('Update payment status failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Betalingsstatus bijwerken mislukt'
    });
  }
};

// Get payment methods with requirements
const getPaymentMethods = async (req, res) => {
  try {
    const methods = [
      {
        method: 'cash',
        displayName: 'Contant betalen',
        description: 'Betaal contant aan de chauffeur',
        requiresBankDetails: true,
        warrantyNote: 'Bankgegevens vereist als waarborg'
      },
      {
        method: 'bank_transfer',
        displayName: 'Bankoverschrijving',
        description: 'Betaal vooraf via bankoverschrijving',
        requiresBankDetails: false,
        processingTime: '1-2 werkdagen'
      },
      {
        method: 'card_in_taxi',
        displayName: 'Pinnen in taxi',
        description: 'Betaal met pin in de taxi',
        requiresBankDetails: true,
        warrantyNote: 'Bankgegevens vereist als waarborg'
      },
      {
        method: 'online_card',
        displayName: 'Online betaling',
        description: 'Betaal nu online met uw bankkaart',
        requiresBankDetails: false,
        processingTime: 'Direct'
      }
    ];

    res.json({
      success: true,
      paymentMethods: methods
    });

  } catch (error) {
    logger.error('Get payment methods failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Betalingsmethoden ophalen mislukt'
    });
  }
};

// Get user's payments
const getUserPayments = async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;

    const paymentRows = await db('payments')
      .where('customer_id', req.user.id)
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    const payments = paymentRows.map(row => {
      const payment = Payment.fromDatabase(row);
      return payment.toPublicJSON();
    });

    const total = await db('payments')
      .where('customer_id', req.user.id)
      .count('* as count')
      .first();

    res.json({
      success: true,
      payments: payments,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: parseInt(total.count)
      }
    });

  } catch (error) {
    logger.error('Get user payments failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Betalingen ophalen mislukt'
    });
  }
};

// Helper functions
const getPaymentMessage = (payment) => {
  switch (payment.method) {
    case 'cash':
      return 'Betaling ingesteld op contant. Uw bankgegevens zijn vastgelegd als waarborg.';
    case 'bank_transfer':
      return 'Bankoverschrijving ingesteld. Maak het bedrag over naar de opgegeven rekening.';
    case 'card_in_taxi':
      return 'Betaling in taxi ingesteld. Uw bankgegevens zijn vastgelegd als waarborg.';
    case 'online_card':
      return 'Online betaling voltooid.';
    default:
      return 'Betaling ingesteld.';
  }
};

module.exports = {
  createPayment,
  getPayment,
  updatePaymentStatus,
  getPaymentMethods,
  getUserPayments
};