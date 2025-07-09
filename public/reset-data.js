// Clear all localStorage items
console.log('🗑️ Clearing localStorage...');
localStorage.removeItem('bookingSurchargeItems');
localStorage.removeItem('surchargeItems');
localStorage.removeItem('taxiVehicles');
localStorage.removeItem('vehiclePricing');
console.log('✅ localStorage cleared\!');

// Reload the page
window.location.reload();
EOF < /dev/null
