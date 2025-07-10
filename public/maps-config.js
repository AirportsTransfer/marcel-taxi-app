// Google Maps Configuration
// Om Google Maps te activeren:
// 1. Ga naar https://console.cloud.google.com/
// 2. Maak een nieuw project of selecteer bestaand project
// 3. Activeer de "Maps JavaScript API" en "Directions API"
// 4. Maak een API key aan
// 5. Vervang 'YOUR_API_KEY_HERE' hieronder met je echte API key
// 6. Voeg deze regel toe aan step2.html boven </head>:
//    <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY_HERE&libraries=geometry"></script>
//    <script src="maps-config.js"></script>

const GOOGLE_MAPS_CONFIG = {
    // API Key (vervang met je echte key)
    apiKey: 'AIzaSyBAitd_yXcPjG7VcDkiRrfc6IdgXAD5awk',
    
    // Default instellingen
    center: { lat: 50.8798, lng: 4.7005 }, // België centrum
    zoom: 8,
    
    // Route styling
    routeColor: '#667eea',
    routeWeight: 5,
    
    // Bekende routes voor fallback (als Maps API niet werkt)
    knownRoutes: {
        'leuven-brussels': { distance: '28 km', duration: '35 min' },
        'leuven-willebroek': { distance: '50 km', duration: '45 min' },
        'leuven-zaventem': { distance: '25 km', duration: '30 min' },
        'brussels-zaventem': { distance: '15 km', duration: '20 min' },
        'antwerp-brussels': { distance: '45 km', duration: '50 min' },
        'ghent-brussels': { distance: '55 km', duration: '60 min' },
        'bruges-brussels': { distance: '100 km', duration: '90 min' },
        'leuven-antwerp': { distance: '50 km', duration: '55 min' },
        'brussels-mechelen': { distance: '25 km', duration: '30 min' },
        'leuven-mechelen': { distance: '20 km', duration: '25 min' }
    }
};

// Export voor gebruik in andere bestanden
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GOOGLE_MAPS_CONFIG;
}

console.log('📍 Maps configuration loaded - bekende routes:', Object.keys(GOOGLE_MAPS_CONFIG.knownRoutes).length);