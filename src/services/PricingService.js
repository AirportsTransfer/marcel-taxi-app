const PricingRule = require('../models/PricingRule');
const db = require('../config/database');
const logger = require('../utils/logger');

class PricingService {
  constructor() {
    this.defaultRateCard = {
      baseFare: 2.50,
      perKm: 1.20,
      perMinute: 0.35,
      luggageFee: 2.00,
      extraStopFee: 3.00,
      bookingFee: 1.00,
      longDistanceDiscount: 0.10,
      discountAfterKm: 50,
      nightSurcharge: 0.20,
      nightSurchargeStart: '22:00',
      nightSurchargeEnd: '06:00'
    };
  }

  // Calculate price for a ride
  async calculateRidePrice(rideData) {
    try {
      const {
        pickupLocation,
        dropoffLocation,
        scheduledAt,
        passengers = 1,
        luggage = 0,
        extraStops = [],
        vehicleType = 'sedan',
        estimatedDistance = 0,
        estimatedDuration = 0
      } = rideData;

      // First check for special pricing rules
      const specialPrice = await this.findSpecialPrice({
        fromLocation: pickupLocation,
        toLocation: dropoffLocation,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        vehicleType,
        estimatedDistance
      });

      if (specialPrice) {
        logger.info('Special pricing rule applied', {
          ruleId: specialPrice.rule.id,
          ruleName: specialPrice.rule.name,
          price: specialPrice.price
        });

        return {
          pricing: {
            type: 'fixed',
            ruleId: specialPrice.rule.id,
            ruleName: specialPrice.rule.name,
            baseFare: specialPrice.price,
            distanceFare: 0,
            timeFare: 0,
            extraFees: this.calculateExtraFees(luggage, extraStops, scheduledAt),
            totalFare: specialPrice.price + this.calculateExtraFeesTotal(luggage, extraStops, scheduledAt)
          },
          breakdown: this.createPriceBreakdown('fixed', specialPrice, luggage, extraStops, scheduledAt)
        };
      }

      // Use normal rate calculation
      const normalPricing = this.calculateNormalPrice({
        estimatedDistance,
        estimatedDuration,
        luggage,
        extraStops,
        scheduledAt,
        vehicleType
      });

      return {
        pricing: normalPricing,
        breakdown: this.createPriceBreakdown('normal', normalPricing, luggage, extraStops, scheduledAt)
      };

    } catch (error) {
      logger.error('Calculate ride price failed', { error: error.message });
      throw error;
    }
  }

  // Find special pricing rules
  async findSpecialPrice(routeData) {
    try {
      const rules = await this.getActivePricingRules();
      
      // Sort by priority (highest first)
      const sortedRules = rules.sort((a, b) => b.priority - a.priority);

      for (const rule of sortedRules) {
        if (this.ruleMatches(rule, routeData)) {
          return {
            rule: rule,
            price: rule.fixedPrice
          };
        }
      }

      return null;

    } catch (error) {
      logger.error('Find special price failed', { error: error.message });
      return null;
    }
  }

  // Check if rule matches the route
  ruleMatches(rule, routeData) {
    const { fromLocation, toLocation, scheduledAt, vehicleType, estimatedDistance } = routeData;

    // Check if rule matches route
    if (!rule.matchesRoute(fromLocation, toLocation)) {
      return false;
    }

    // Check time validity
    if (!rule.isValidAtTime(scheduledAt)) {
      return false;
    }

    // Check vehicle type
    if (!rule.isValidForVehicle(vehicleType)) {
      return false;
    }

    // Check distance
    if (!rule.isValidForDistance(estimatedDistance)) {
      return false;
    }

    return true;
  }

  // Get active pricing rules from database
  async getActivePricingRules() {
    try {
      const rows = await db('pricing_rules').where('is_active', true);
      return rows.map(row => PricingRule.fromDatabase(row));
    } catch (error) {
      logger.error('Get active pricing rules failed', { error: error.message });
      return [];
    }
  }

  // Calculate normal price using rate card
  calculateNormalPrice(rideData) {
    const { estimatedDistance, estimatedDuration, luggage, extraStops, scheduledAt, vehicleType } = rideData;

    const baseFare = this.defaultRateCard.baseFare;
    const distanceFare = estimatedDistance * this.defaultRateCard.perKm;
    const timeFare = estimatedDuration * this.defaultRateCard.perMinute;

    // Vehicle type multiplier
    const vehicleMultiplier = this.getVehicleMultiplier(vehicleType);
    const adjustedDistanceFare = distanceFare * vehicleMultiplier;
    const adjustedTimeFare = timeFare * vehicleMultiplier;

    // Calculate extra fees
    const extraFees = this.calculateExtraFees(luggage, extraStops, scheduledAt);
    const extraFeesTotal = this.calculateExtraFeesTotal(luggage, extraStops, scheduledAt);

    // Apply long distance discount
    let discount = 0;
    if (estimatedDistance > this.defaultRateCard.discountAfterKm) {
      discount = (adjustedDistanceFare + adjustedTimeFare) * this.defaultRateCard.longDistanceDiscount;
    }

    const subtotal = baseFare + adjustedDistanceFare + adjustedTimeFare - discount;
    const totalFare = subtotal + extraFeesTotal;

    return {
      type: 'calculated',
      baseFare: baseFare,
      distanceFare: adjustedDistanceFare,
      timeFare: adjustedTimeFare,
      vehicleMultiplier: vehicleMultiplier,
      discount: discount,
      extraFees: extraFees,
      totalFare: Math.max(totalFare, this.defaultRateCard.baseFare) // Minimum fare
    };
  }

  // Calculate extra fees
  calculateExtraFees(luggage, extraStops, scheduledAt) {
    const fees = {};

    if (luggage > 0) {
      fees.luggage = luggage * this.defaultRateCard.luggageFee;
    }

    if (extraStops && extraStops.length > 0) {
      fees.extraStops = extraStops.length * this.defaultRateCard.extraStopFee;
    }

    if (scheduledAt && new Date(scheduledAt) > new Date()) {
      fees.booking = this.defaultRateCard.bookingFee;
    }

    // Night surcharge
    if (this.isNightTime(scheduledAt)) {
      fees.nightSurcharge = this.calculateNightSurcharge();
    }

    return fees;
  }

  calculateExtraFeesTotal(luggage, extraStops, scheduledAt) {
    const fees = this.calculateExtraFees(luggage, extraStops, scheduledAt);
    return Object.values(fees).reduce((sum, fee) => sum + fee, 0);
  }

  // Vehicle type multipliers
  getVehicleMultiplier(vehicleType) {
    const multipliers = {
      'sedan': 1.0,
      'suv': 1.2,
      'van': 1.5,
      'luxury': 1.8
    };
    return multipliers[vehicleType] || 1.0;
  }

  // Night time check
  isNightTime(scheduledAt) {
    if (!scheduledAt) return false;

    const time = new Date(scheduledAt);
    const hours = time.getHours();
    
    // Between 22:00 and 06:00
    return hours >= 22 || hours < 6;
  }

  calculateNightSurcharge() {
    // 20% surcharge on base fare during night hours
    return this.defaultRateCard.baseFare * this.defaultRateCard.nightSurcharge;
  }

  // Create price breakdown for display
  createPriceBreakdown(type, pricingData, luggage, extraStops, scheduledAt) {
    const breakdown = [];

    if (type === 'fixed') {
      breakdown.push({
        description: `Vaste prijs: ${pricingData.rule.name}`,
        amount: pricingData.price
      });
    } else {
      breakdown.push({
        description: 'Basisprijs',
        amount: pricingData.baseFare
      });

      if (pricingData.distanceFare > 0) {
        breakdown.push({
          description: 'Afstand',
          amount: pricingData.distanceFare
        });
      }

      if (pricingData.timeFare > 0) {
        breakdown.push({
          description: 'Tijd',
          amount: pricingData.timeFare
        });
      }

      if (pricingData.vehicleMultiplier !== 1.0) {
        breakdown.push({
          description: `Voertuigtype toeslag (${((pricingData.vehicleMultiplier - 1) * 100).toFixed(0)}%)`,
          amount: (pricingData.distanceFare + pricingData.timeFare) * (pricingData.vehicleMultiplier - 1)
        });
      }

      if (pricingData.discount > 0) {
        breakdown.push({
          description: 'Lange afstand korting',
          amount: -pricingData.discount
        });
      }
    }

    // Add extra fees
    const extraFees = this.calculateExtraFees(luggage, extraStops, scheduledAt);
    Object.entries(extraFees).forEach(([key, amount]) => {
      const descriptions = {
        luggage: `Bagage (${luggage} stuks)`,
        extraStops: `Extra stops (${extraStops?.length || 0})`,
        booking: 'Reserveringskosten',
        nightSurcharge: 'Nachttoeslag'
      };

      breakdown.push({
        description: descriptions[key] || key,
        amount: amount
      });
    });

    return breakdown;
  }

  // Get price estimate for frontend
  async getPriceEstimate(fromLocation, toLocation, options = {}) {
    try {
      const estimatedDistance = this.calculateDistance(
        fromLocation.latitude,
        fromLocation.longitude,
        toLocation.latitude,
        toLocation.longitude
      );

      const estimatedDuration = Math.ceil(estimatedDistance / 30 * 60); // 30 km/h average

      const rideData = {
        pickupLocation: fromLocation,
        dropoffLocation: toLocation,
        estimatedDistance,
        estimatedDuration,
        ...options
      };

      const pricing = await this.calculateRidePrice(rideData);

      return {
        success: true,
        estimatedDistance,
        estimatedDuration,
        pricing: pricing.pricing,
        breakdown: pricing.breakdown,
        currency: 'EUR'
      };

    } catch (error) {
      logger.error('Get price estimate failed', { error: error.message });
      return {
        success: false,
        error: 'Prijsschatting mislukt'
      };
    }
  }

  // Utility method for distance calculation
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

module.exports = new PricingService();