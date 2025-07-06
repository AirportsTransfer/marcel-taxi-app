// Modulaire Class Structuur voor Marcel's Taxi App
// Kleine classes voor alles zodat uitbreidingen gemakkelijk zijn

// Base Class voor alle entiteiten
class BaseEntity {
    constructor(id = null) {
        this.id = id || this.generateId();
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    update() {
        this.updatedAt = new Date();
    }

    validate() {
        return true; // Override in subclasses
    }

    toJSON() {
        return {
            id: this.id,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

// Auto/Voertuig Class
class Vehicle extends BaseEntity {
    constructor(type, passengers, largeBags, smallBags, basePrice, hasChildSeats = false) {
        super();
        this.type = type;
        this.passengers = passengers;
        this.largeBags = largeBags;
        this.smallBags = smallBags;
        this.basePrice = basePrice;
        this.hasChildSeats = hasChildSeats;
        this.isActive = true;
    }

    validate() {
        return this.type && this.passengers > 0 && this.basePrice > 0;
    }

    canAccommodate(passengers, largeBags, smallBags) {
        return this.passengers >= passengers && 
               this.largeBags >= largeBags && 
               this.smallBags >= smallBags;
    }

    calculatePrice(distance, time, surcharges = {}) {
        let price = this.basePrice;
        
        // Add distance/time costs
        if (distance) price += distance * 1.20; // €1.20 per km
        if (time) price += time * 0.35; // €0.35 per minute
        
        // Apply surcharges
        if (surcharges.night) price *= 1.25;
        if (surcharges.holiday) price *= 1.50;
        
        return Math.max(price, 5.00); // Minimum fare €5.00
    }

    toJSON() {
        return {
            ...super.toJSON(),
            type: this.type,
            passengers: this.passengers,
            largeBags: this.largeBags,
            smallBags: this.smallBags,
            basePrice: this.basePrice,
            hasChildSeats: this.hasChildSeats,
            isActive: this.isActive
        };
    }
}

// Email Class
class Email extends BaseEntity {
    constructor(to, subject, template, data = {}) {
        super();
        this.to = to;
        this.subject = subject;
        this.template = template;
        this.data = data;
        this.status = 'pending';
        this.sentAt = null;
        this.attempts = 0;
    }

    validate() {
        return this.to && this.subject && this.template;
    }

    send() {
        this.attempts++;
        // In real app, integrate with email service
        console.log(`Sending email to ${this.to}: ${this.subject}`);
        this.status = 'sent';
        this.sentAt = new Date();
        this.update();
        return true;
    }

    generateModificationLink(bookingId, token) {
        return `https://marcelstaxi.nl/modify-booking.html?id=${bookingId}&token=${token}`;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            to: this.to,
            subject: this.subject,
            template: this.template,
            data: this.data,
            status: this.status,
            sentAt: this.sentAt,
            attempts: this.attempts
        };
    }
}

// Klant Class
class Customer extends BaseEntity {
    constructor(name, email, phone, address = null) {
        super();
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.address = address;
        this.totalBookings = 0;
        this.noShowCount = 0;
        this.isBlocked = false;
        this.loyaltyPoints = 0;
    }

    validate() {
        return this.name && this.email && this.phone;
    }

    addNoShow() {
        this.noShowCount++;
        if (this.noShowCount >= 3) {
            this.isBlocked = true;
        }
        this.update();
    }

    addLoyaltyPoints(points) {
        this.loyaltyPoints += points;
        this.update();
    }

    canBook() {
        return !this.isBlocked;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            name: this.name,
            email: this.email,
            phone: this.phone,
            address: this.address,
            totalBookings: this.totalBookings,
            noShowCount: this.noShowCount,
            isBlocked: this.isBlocked,
            loyaltyPoints: this.loyaltyPoints
        };
    }
}

// Boeking Class
class Booking extends BaseEntity {
    constructor(customer, fromAddress, toAddress, dateTime, vehicle) {
        super();
        this.customer = customer;
        this.fromAddress = fromAddress;
        this.toAddress = toAddress;
        this.dateTime = dateTime;
        this.vehicle = vehicle;
        this.extraStops = [];
        this.status = 'pending';
        this.price = 0;
        this.paymentMethod = null;
        this.paymentStatus = 'pending';
        this.modificationToken = this.generateModificationToken();
        this.canModifyUntil = new Date(dateTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours before
    }

    validate() {
        return this.customer && this.fromAddress && this.toAddress && this.dateTime && this.vehicle;
    }

    generateModificationToken() {
        return 'mod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
    }

    addExtraStop(address) {
        this.extraStops.push(address);
        this.update();
    }

    canModify() {
        return new Date() < this.canModifyUntil && this.status === 'confirmed';
    }

    modify(newDateTime, reason = null) {
        if (!this.canModify()) {
            throw new Error('Modificatie niet meer mogelijk');
        }

        const oldDateTime = this.dateTime;
        this.dateTime = newDateTime;
        this.canModifyUntil = new Date(newDateTime.getTime() - 24 * 60 * 60 * 1000);
        
        // Calculate modification fee
        const hoursUntilDeparture = (oldDateTime - new Date()) / (1000 * 60 * 60);
        let modificationFee = 0;
        
        if (hoursUntilDeparture <= 24) {
            modificationFee = hoursUntilDeparture > 0 ? 5.00 : this.price; // Full price if too late
        }
        
        this.update();
        
        return {
            success: true,
            modificationFee: modificationFee,
            oldDateTime: oldDateTime,
            newDateTime: newDateTime,
            reason: reason
        };
    }

    markAsNoShow() {
        this.status = 'no-show';
        this.customer.addNoShow();
        this.update();
    }

    cancel() {
        const hoursUntilDeparture = (this.dateTime - new Date()) / (1000 * 60 * 60);
        let cancellationFee = 0;
        
        if (hoursUntilDeparture <= 24) {
            cancellationFee = hoursUntilDeparture > 0 ? 3.00 : this.price; // Full price if too late
        }
        
        this.status = 'cancelled';
        this.update();
        
        return {
            success: true,
            cancellationFee: cancellationFee
        };
    }

    toJSON() {
        return {
            ...super.toJSON(),
            customer: this.customer.toJSON(),
            fromAddress: this.fromAddress,
            toAddress: this.toAddress,
            dateTime: this.dateTime,
            vehicle: this.vehicle.toJSON(),
            extraStops: this.extraStops,
            status: this.status,
            price: this.price,
            paymentMethod: this.paymentMethod,
            paymentStatus: this.paymentStatus,
            modificationToken: this.modificationToken,
            canModifyUntil: this.canModifyUntil
        };
    }
}

// Chauffeur Class
class Driver extends BaseEntity {
    constructor(name, email, phone, licenseNumber) {
        super();
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.licenseNumber = licenseNumber;
        this.isActive = true;
        this.currentLocation = null;
        this.isAvailable = true;
        this.totalRides = 0;
        this.rating = 5.0;
        this.earnings = 0;
    }

    validate() {
        return this.name && this.email && this.phone && this.licenseNumber;
    }

    updateLocation(latitude, longitude) {
        this.currentLocation = { latitude, longitude, timestamp: new Date() };
        this.update();
    }

    setAvailable(available) {
        this.isAvailable = available;
        this.update();
    }

    completeRide(earnings) {
        this.totalRides++;
        this.earnings += earnings;
        this.update();
    }

    toJSON() {
        return {
            ...super.toJSON(),
            name: this.name,
            email: this.email,
            phone: this.phone,
            licenseNumber: this.licenseNumber,
            isActive: this.isActive,
            currentLocation: this.currentLocation,
            isAvailable: this.isAvailable,
            totalRides: this.totalRides,
            rating: this.rating,
            earnings: this.earnings
        };
    }
}

// Betaling Class
class Payment extends BaseEntity {
    constructor(booking, method, amount) {
        super();
        this.booking = booking;
        this.method = method; // 'cash', 'card', 'bank_transfer', 'online'
        this.amount = amount;
        this.status = 'pending';
        this.processedAt = null;
        this.transactionId = null;
        this.securityDeposit = method === 'cash' || method === 'card_in_taxi' ? 25.00 : 0;
    }

    validate() {
        return this.booking && this.method && this.amount > 0;
    }

    process() {
        // In real app, integrate with payment provider
        this.status = 'completed';
        this.processedAt = new Date();
        this.transactionId = 'txn_' + Date.now();
        this.update();
        return true;
    }

    refund(amount = null) {
        const refundAmount = amount || this.amount;
        // In real app, process refund through payment provider
        this.status = 'refunded';
        this.update();
        return { success: true, refundAmount };
    }

    toJSON() {
        return {
            ...super.toJSON(),
            booking: this.booking.id,
            method: this.method,
            amount: this.amount,
            status: this.status,
            processedAt: this.processedAt,
            transactionId: this.transactionId,
            securityDeposit: this.securityDeposit
        };
    }
}

// Bedrijf Class voor Partnership
class Company extends BaseEntity {
    constructor(name, email, phone, address) {
        super();
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.address = address;
        this.isActive = true;
        this.partnerCompanies = [];
        this.commissionRate = 0.15; // 15% commission
        this.totalRides = 0;
        this.totalEarnings = 0;
    }

    validate() {
        return this.name && this.email && this.phone;
    }

    addPartner(companyId, commissionRate = 0.10) {
        this.partnerCompanies.push({
            companyId: companyId,
            commissionRate: commissionRate,
            addedAt: new Date()
        });
        this.update();
    }

    removePartner(companyId) {
        this.partnerCompanies = this.partnerCompanies.filter(p => p.companyId !== companyId);
        this.update();
    }

    calculateCommission(ridePrice, isPartnerRide = false) {
        const rate = isPartnerRide ? 0.10 : this.commissionRate;
        return ridePrice * rate;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            name: this.name,
            email: this.email,
            phone: this.phone,
            address: this.address,
            isActive: this.isActive,
            partnerCompanies: this.partnerCompanies,
            commissionRate: this.commissionRate,
            totalRides: this.totalRides,
            totalEarnings: this.totalEarnings
        };
    }
}

// Tracking Class voor GPS
class LocationTracking extends BaseEntity {
    constructor(bookingId, driverId) {
        super();
        this.bookingId = bookingId;
        this.driverId = driverId;
        this.trackingPoints = [];
        this.isActive = false;
        this.estimatedArrival = null;
    }

    startTracking() {
        this.isActive = true;
        this.update();
    }

    stopTracking() {
        this.isActive = false;
        this.update();
    }

    addTrackingPoint(latitude, longitude, speed = 0) {
        this.trackingPoints.push({
            latitude: latitude,
            longitude: longitude,
            speed: speed,
            timestamp: new Date()
        });
        this.update();
    }

    updateEstimatedArrival(minutes) {
        this.estimatedArrival = new Date(Date.now() + minutes * 60 * 1000);
        this.update();
    }

    getCurrentLocation() {
        return this.trackingPoints.length > 0 ? 
               this.trackingPoints[this.trackingPoints.length - 1] : null;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            bookingId: this.bookingId,
            driverId: this.driverId,
            trackingPoints: this.trackingPoints,
            isActive: this.isActive,
            estimatedArrival: this.estimatedArrival
        };
    }
}

// Export all classes
module.exports = {
    BaseEntity,
    Vehicle,
    Email,
    Customer,
    Booking,
    Driver,
    Payment,
    Company,
    LocationTracking
};