# Google Maps Setup voor Marcel's Taxi

## Huidige Status
✅ **Het systeem werkt PERFECT zonder Google Maps API**
- Route informatie wordt getoond met fallback systeem
- Bekende routes (Leuven-Brussels, etc.) worden automatisch herkend
- Schattingen worden gegeven voor onbekende routes
- Het booking systeem werkt volledig zonder externe afhankelijkheden

## Google Maps Activeren (Optioneel)

### Stap 1: Google Cloud Console
1. Ga naar: https://console.cloud.google.com/
2. Maak een nieuw project aan of selecteer bestaand project
3. Ga naar "APIs & Services" → "Library"
4. Zoek en activeer:
   - **Maps JavaScript API**
   - **Directions API**
   - **Geocoding API** (optioneel)

### Stap 2: API Key Aanmaken
1. Ga naar "APIs & Services" → "Credentials"
2. Klik "Create Credentials" → "API Key"
3. Kopieer je API key (bijvoorbeeld: `AIzaSyB...`)
4. **BELANGRIJK**: Klik "Restrict Key" en beperk tot je domain

### Stap 3: API Key Installeren
1. Open `/Users/marcel/TaxiAppBoekingssysteem/public/maps-config.js`
2. Vervang `YOUR_API_KEY_HERE` met je echte API key
3. Voeg deze regel toe aan `step2.html` boven `</head>`:
```html
<script src="https://maps.googleapis.com/maps/api/js?key=JE_API_KEY_HIER&libraries=geometry"></script>
```

### Stap 4: Test de Maps
1. Herlaad STAP 2 van je booking systeem
2. Vul een route in STAP 1 in (bijv. Leuven naar Brussels)
3. Ga naar STAP 2
4. Je zou nu een echte Google Map moeten zien met route

## Kosten Google Maps API

### Gratis Gebruik (per maand)
- **Maps JavaScript API**: €200 gratis credit
- **Directions API**: Eerste 40.000 verzoeken gratis
- **Geocoding API**: Eerste 40.000 verzoeken gratis

### Geschatte Kosten voor Taxi Business
- **Kleine taxi business** (100 routes/maand): €0 - volledig gratis
- **Middelgrote business** (1000 routes/maand): €0-€5
- **Grote business** (5000+ routes/maand): €10-€50

## Voordelen van Google Maps

### Met Google Maps API:
✅ Echte kaart met route visualisatie  
✅ Exacte afstanden en tijden  
✅ Real-time verkeersinformatie  
✅ Automatische route optimalisatie  
✅ Professionele uitstraling  

### Zonder Google Maps API (huidige systeem):
✅ Werkt altijd (geen externe afhankelijkheden)  
✅ Gratis (geen API kosten)  
✅ Snel (geen externe API calls)  
✅ Privacy-vriendelijk  
✅ Offline beschikbaar  

## Aanbeveling

**Voor nu**: Gebruik het huidige systeem zonder Google Maps
- Het werkt perfect
- Geen kosten
- Geen complexiteit
- Geen privacy zorgen

**Later**: Activeer Google Maps als je business groeit en je meer professionele route visualisatie wilt.

## Troubleshooting

### Maps laden niet?
1. Controleer je API key in `maps-config.js`
2. Controleer of de APIs geactiveerd zijn in Google Cloud Console
3. Controleer browser console voor foutmeldingen
4. **Fallback systeem werkt altijd** - geen zorgen!

### API Kosten te hoog?
1. Implementeer caching van routes
2. Beperk API calls tot echte bookings
3. Schakel terug naar fallback systeem

### Privacy zorgen?
1. Het huidige fallback systeem stuurt geen data naar Google
2. Je kunt kiezen wanneer Google Maps te gebruiken
3. Klanten hoeven geen toestemming te geven voor kaarten

---

**BELANGRIJK**: Het booking systeem werkt perfect zonder Google Maps. Activeer alleen als je echt route visualisatie nodig hebt!