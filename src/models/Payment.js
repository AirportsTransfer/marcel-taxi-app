const { v4: uuidv4 } = require('uuid');

class Payment {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.rideId = data.rideId || null;
    this.customerId = data.customerId || null;
    this.amount = data.amount || 0;
    this.method = data.method || 'cash'; // cash, bank_transfer, card_in_taxi, online_card
    this.status = data.status || 'pending'; // pending, authorized, paid, failed, refunded
    this.authorizationId = data.authorizationId || null;
    this.transactionId = data.transactionId || null;
    this.bankDetails = data.bankDetails || null; // Required for ALL methods except bank_transfer
    this.notes = data.notes || '';
    this.processedAt = data.processedAt || null;
    this.authorizedAt = data.authorizedAt || null;
    this.failureReason = data.failureReason || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Validatie methoden
  validate() {
    const errors = [];

    if (!this.rideId) {
      errors.push('Rit ID is verplicht');
    }

    if (!this.customerId) {
      errors.push('Klant ID is verplicht');
    }

    if (this.amount <= 0) {
      errors.push('Bedrag moet groter zijn dan 0');
    }

    if (!['cash', 'bank_transfer', 'card_in_taxi', 'online_card'].includes(this.method)) {
      errors.push('Ongeldige betalingsmethode');
    }

    // Bank details required for all methods except bank_transfer (as security/warranty)
    if (this.method !== 'bank_transfer' && !this.bankDetails) {
      errors.push('Bankgegevens zijn verplicht als waarborg');
    }

    return errors;
  }

  // Payment method checks
  isCash() {
    return this.method === 'cash';
  }

  isBankTransfer() {
    return this.method === 'bank_transfer';
  }

  isCardInTaxi() {
    return this.method === 'card_in_taxi';
  }

  isOnlineCard() {
    return this.method === 'online_card';
  }

  requiresPreAuthorization() {
    return ['cash', 'card_in_taxi'].includes(this.method);
  }

  requiresPrePayment() {
    return ['bank_transfer', 'online_card'].includes(this.method);
  }

  requiresBankDetails() {
    return this.method !== 'bank_transfer'; // All except bank transfer need warranty
  }

  // Status methoden
  isPending() {
    return this.status === 'pending';
  }

  isAuthorized() {
    return this.status === 'authorized';
  }

  isPaid() {
    return this.status === 'paid';
  }

  isFailed() {
    return this.status === 'failed';
  }

  isRefunded() {
    return this.status === 'refunded';
  }

  // Status updates
  authorize(authorizationId, bankDetails = null) {
    this.status = 'authorized';
    this.authorizationId = authorizationId;
    this.authorizedAt = new Date();
    this.updatedAt = new Date();
    
    if (bankDetails) {
      this.setBankDetails(bankDetails);
    }
  }

  markAsPaid(transactionId) {
    this.status = 'paid';
    this.transactionId = transactionId;
    this.processedAt = new Date();
    this.updatedAt = new Date();
  }

  markAsFailed(reason) {
    this.status = 'failed';
    this.failureReason = reason;
    this.updatedAt = new Date();
  }

  refund(reason) {
    this.status = 'refunded';
    this.notes = reason;
    this.updatedAt = new Date();
  }

  // Bank details methoden
  setBankDetails(bankDetails) {
    this.bankDetails = {
      cardNumber: this.maskCardNumber(bankDetails.cardNumber),
      expiryDate: bankDetails.expiryDate,
      cardHolderName: bankDetails.cardHolderName,
      bankName: bankDetails.bankName || '',
      iban: this.maskIban(bankDetails.iban || ''),
      // Store masked/encrypted versions for security
      encryptedData: bankDetails.encryptedData || null
    };
    this.updatedAt = new Date();
  }

  maskCardNumber(cardNumber) {
    if (!cardNumber) return '';
    const cleaned = cardNumber.replace(/\s/g, '');
    return cleaned.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '****-****-****-$4');
  }

  maskIban(iban) {
    if (!iban) return '';
    const cleaned = iban.replace(/\s/g, '');
    if (cleaned.length > 8) {
      return cleaned.substring(0, 4) + '****' + cleaned.substring(cleaned.length - 4);
    }
    return iban;
  }

  // Payment instructions
  getPaymentInstructions() {
    switch (this.method) {
      case 'cash':
        return {
          title: 'Contant betalen',
          description: 'Betaal contant aan de chauffeur na afloop van de rit',
          amount: this.amount,
          currency: 'EUR',
          warranty: 'Uw bankgegevens zijn vastgelegd als waarborg'
        };

      case 'bank_transfer':
        return {
          title: 'Bankoverschrijving',
          description: 'Maak het bedrag over naar onderstaande rekening',
          amount: this.amount,
          currency: 'EUR',
          bankDetails: {
            iban: 'NL12 RABO 0123 4567 89',
            bic: 'RABONL2U',
            accountName: 'Marcel Taxi Service',
            reference: `RIT-${this.rideId}`
          }
        };

      case 'card_in_taxi':
        return {
          title: 'Pinnen in de taxi',
          description: 'Betaal met pin of contactloos in de taxi',
          amount: this.amount,
          currency: 'EUR',
          warranty: 'Uw bankgegevens zijn vastgelegd als waarborg'
        };

      case 'online_card':
        return {
          title: 'Online betalen',
          description: 'Betaal nu online met uw bankkaart',
          amount: this.amount,
          currency: 'EUR'
        };

      default:
        return null;
    }
  }

  // Receipt methoden
  generateReceipt() {
    return {
      paymentId: this.id,
      rideId: this.rideId,
      amount: this.amount,
      method: this.getMethodDisplayName(),
      status: this.status,
      transactionId: this.transactionId,
      processedAt: this.processedAt,
      createdAt: this.createdAt
    };
  }

  getMethodDisplayName() {
    const methodNames = {
      'cash': 'Contant',
      'bank_transfer': 'Bankoverschrijving',
      'card_in_taxi': 'Pin in taxi',
      'online_card': 'Online betaling'
    };
    return methodNames[this.method] || this.method;
  }

  // Database methoden
  toDatabase() {
    return {
      id: this.id,
      ride_id: this.rideId,
      customer_id: this.customerId,
      amount: this.amount,
      method: this.method,
      status: this.status,
      authorization_id: this.authorizationId,
      transaction_id: this.transactionId,
      bank_details: this.bankDetails ? JSON.stringify(this.bankDetails) : null,
      notes: this.notes,
      processed_at: this.processedAt,
      authorized_at: this.authorizedAt,
      failure_reason: this.failureReason,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  static fromDatabase(row) {
    if (!row) return null;

    return new Payment({
      id: row.id,
      rideId: row.ride_id,
      customerId: row.customer_id,
      amount: parseFloat(row.amount),
      method: row.method,
      status: row.status,
      authorizationId: row.authorization_id,
      transactionId: row.transaction_id,
      bankDetails: row.bank_details ? JSON.parse(row.bank_details) : null,
      notes: row.notes,
      processedAt: row.processed_at,
      authorizedAt: row.authorized_at,
      failureReason: row.failure_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  // API response methoden
  toJSON() {
    return {
      id: this.id,
      rideId: this.rideId,
      amount: this.amount,
      method: this.method,
      methodDisplayName: this.getMethodDisplayName(),
      status: this.status,
      authorizationId: this.authorizationId,
      transactionId: this.transactionId,
      bankDetails: this.bankDetails, // Already masked
      processedAt: this.processedAt,
      authorizedAt: this.authorizedAt,
      paymentInstructions: this.getPaymentInstructions(),
      requiresBankDetails: this.requiresBankDetails(),
      createdAt: this.createdAt
    };
  }

  toPublicJSON() {
    return {
      id: this.id,
      amount: this.amount,
      method: this.getMethodDisplayName(),
      status: this.status,
      processedAt: this.processedAt,
      paymentInstructions: this.getPaymentInstructions()
    };
  }

  toReceiptJSON() {
    return this.generateReceipt();
  }
}

module.exports = Payment;