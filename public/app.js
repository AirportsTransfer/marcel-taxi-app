// Taxi App Frontend JavaScript
class TaxiApp {
    constructor() {
        this.apiBase = 'http://localhost:3000/api/v1';
        this.token = localStorage.getItem('authToken');
        this.user = null;
        this.socket = null;
        this.currentView = 'landing';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupSocket();
        
        if (this.token) {
            this.loadUserData();
        } else {
            this.showView('landing');
        }
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('loginBtn').addEventListener('click', () => this.showView('login'));
        document.getElementById('registerBtn').addEventListener('click', () => this.showView('register'));
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        
        // Book ride button with error handling
        const bookRideBtn = document.getElementById('bookRideBtn');
        if (bookRideBtn) {
            bookRideBtn.addEventListener('click', () => {
                console.log('Book ride button clicked!');
                this.handleBookingButtonClick();
            });
        } else {
            console.error('Book ride button not found!');
        }

        // Form switches
        document.getElementById('switchToRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.showView('register');
        });
        document.getElementById('switchToLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.showView('login');
        });

        // Forms
        document.getElementById('loginFormElement').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerFormElement').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('bookingFormElement').addEventListener('submit', (e) => this.handleBooking(e));

        // Driver status
        document.getElementById('statusBtn').addEventListener('click', () => this.toggleDriverStatus());

        // Price estimation
        document.getElementById('pickupAddress').addEventListener('input', () => this.estimatePrice());
        document.getElementById('destinationAddress').addEventListener('input', () => this.estimatePrice());
    }

    setupSocket() {
        this.socket = io('http://localhost:3000');
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            if (this.user) {
                this.joinUserRoom();
            }
        });

        this.socket.on('driver-location', (data) => {
            this.updateLiveTracking(data);
        });

        this.socket.on('ride-update', (data) => {
            this.handleRideUpdate(data);
            this.showNotification(`Rit update: ${data.status}`, 'success');
        });

        this.socket.on('notification', (data) => {
            this.showNotification(data.message, data.type || 'info');
        });
    }

    joinUserRoom() {
        if (!this.user || !this.socket) return;

        switch (this.user.role) {
            case 'driver':
                this.socket.emit('join-driver', {
                    driverId: this.user.id,
                    token: this.token
                });
                break;
            case 'admin':
                this.socket.emit('join-admin', {
                    adminId: this.user.id,
                    token: this.token
                });
                break;
        }
    }

    async loadUserData() {
        try {
            const response = await this.apiCall('/auth/me', 'GET');
            if (response.success) {
                this.user = response.user;
                this.updateUIForUser();
                this.showDashboard();
                this.joinUserRoom();
            } else {
                this.logout();
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
            this.logout();
        }
    }

    updateUIForUser() {
        document.getElementById('loginBtn').classList.add('hidden');
        document.getElementById('registerBtn').classList.add('hidden');
        document.getElementById('userMenu').classList.remove('hidden');
        document.getElementById('userName').textContent = this.user.name;
    }

    showView(viewName) {
        // Hide all sections
        const sections = ['landingPage', 'loginForm', 'registerForm', 'bookingForm', 'dashboard', 'liveTracking'];
        sections.forEach(section => {
            document.getElementById(section).classList.add('hidden');
        });

        // Show requested view
        document.getElementById(viewName).classList.remove('hidden');
        this.currentView = viewName;
    }

    showBookingForm() {
        if (!this.user) {
            this.showView('login');
            this.showNotification('Log eerst in om een rit te boeken', 'warning');
            return;
        }
        
        if (this.user.role !== 'customer') {
            this.showNotification('Alleen klanten kunnen ritten boeken', 'error');
            return;
        }

        this.showView('bookingForm');
    }

    // Function to handle booking button click from landing page
    handleBookingButtonClick() {
        if (!this.user) {
            this.showView('register');
            this.showNotification('Registreer eerst als klant om een rit te boeken', 'info');
            // Set role to customer by default
            setTimeout(() => {
                const roleSelect = document.getElementById('registerRole');
                if (roleSelect) {
                    roleSelect.value = 'customer';
                }
            }, 100);
            return;
        }
        this.showBookingForm();
    }

    showDashboard() {
        this.showView('dashboard');
        
        // Hide all dashboard content first
        document.getElementById('customerDashboard').classList.add('hidden');
        document.getElementById('driverDashboard').classList.add('hidden');
        document.getElementById('adminDashboard').classList.add('hidden');

        // Show appropriate dashboard
        switch (this.user.role) {
            case 'customer':
                document.getElementById('customerDashboard').classList.remove('hidden');
                this.loadCustomerData();
                break;
            case 'driver':
                document.getElementById('driverDashboard').classList.remove('hidden');
                this.loadDriverData();
                break;
            case 'admin':
                document.getElementById('adminDashboard').classList.remove('hidden');
                this.loadAdminData();
                break;
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        this.showLoading(true);

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await this.apiCall('/auth/login', 'POST', {
                email,
                password
            });

            if (response.success) {
                this.token = response.token;
                this.user = response.user;
                localStorage.setItem('authToken', this.token);
                
                this.updateUIForUser();
                this.showDashboard();
                this.joinUserRoom();
                this.showNotification('Succesvol ingelogd!', 'success');
            } else {
                this.showNotification(response.error || 'Login mislukt', 'error');
            }
        } catch (error) {
            this.showNotification('Login mislukt: ' + error.message, 'error');
        }

        this.showLoading(false);
    }

    async handleRegister(e) {
        e.preventDefault();
        this.showLoading(true);

        const formData = {
            name: document.getElementById('registerName').value,
            email: document.getElementById('registerEmail').value,
            phone: document.getElementById('registerPhone').value,
            password: document.getElementById('registerPasswordInput').value,
            role: document.getElementById('registerRole').value
        };

        try {
            const response = await this.apiCall('/auth/register', 'POST', formData);

            if (response.success) {
                this.showNotification('Registratie succesvol! U kunt nu inloggen.', 'success');
                this.showView('login');
                document.getElementById('loginEmail').value = formData.email;
            } else {
                this.showNotification(response.error || 'Registratie mislukt', 'error');
            }
        } catch (error) {
            this.showNotification('Registratie mislukt: ' + error.message, 'error');
        }

        this.showLoading(false);
    }

    async handleBooking(e) {
        e.preventDefault();
        this.showLoading(true);

        const bookingData = {
            pickupLocation: {
                address: document.getElementById('pickupAddress').value,
                latitude: 52.3702, // Default Amsterdam coordinates
                longitude: 4.8952
            },
            dropoffLocation: {
                address: document.getElementById('destinationAddress').value,
                latitude: 52.3105, // Default Schiphol coordinates
                longitude: 4.7683
            },
            scheduledAt: document.getElementById('scheduledTime').value || null,
            passengers: parseInt(document.getElementById('passengers').value) || 1,
            paymentMethod: document.getElementById('paymentMethod').value,
            specialRequests: document.getElementById('specialRequests').value
        };

        try {
            const response = await this.apiCall('/rides', 'POST', bookingData);

            if (response.success) {
                this.showNotification('Rit succesvol geboekt!', 'success');
                this.showDashboard();
                this.loadCustomerData(); // Refresh ride list
            } else {
                this.showNotification(response.error || 'Booking mislukt', 'error');
            }
        } catch (error) {
            this.showNotification('Booking mislukt: ' + error.message, 'error');
        }

        this.showLoading(false);
    }

    async loadCustomerData() {
        try {
            const response = await this.apiCall('/rides?limit=10', 'GET');
            if (response.success) {
                this.displayCustomerRides(response.data.rides);
            }
        } catch (error) {
            console.error('Failed to load customer data:', error);
        }
    }

    displayCustomerRides(rides) {
        const activeRides = rides.filter(ride => ['pending', 'assigned', 'picked_up', 'in_progress'].includes(ride.status));
        const recentRides = rides.filter(ride => ['completed', 'cancelled'].includes(ride.status)).slice(0, 5);

        // Display active rides
        const activeContainer = document.getElementById('activeRides');
        if (activeRides.length === 0) {
            activeContainer.innerHTML = '<p>Geen actieve ritten</p>';
        } else {
            activeContainer.innerHTML = activeRides.map(ride => `
                <div class="ride-item">
                    <h4>Van ${ride.pickup_address}</h4>
                    <p>Naar: ${ride.destination_address}</p>
                    <p>Status: <span class="ride-status status-${ride.status}">${this.getStatusText(ride.status)}</span></p>
                    <p>Prijs: €${ride.total_fare}</p>
                    ${ride.status === 'in_progress' ? `<button onclick="app.showLiveTracking('${ride.id}')" class="btn btn-primary">Volg Live</button>` : ''}
                </div>
            `).join('');
        }

        // Display recent rides
        const recentContainer = document.getElementById('recentRides');
        if (recentRides.length === 0) {
            recentContainer.innerHTML = '<p>Geen recente ritten</p>';
        } else {
            recentContainer.innerHTML = recentRides.map(ride => `
                <div class="ride-item">
                    <h4>Van ${ride.pickup_address}</h4>
                    <p>Naar: ${ride.destination_address}</p>
                    <p>Status: <span class="ride-status status-${ride.status}">${this.getStatusText(ride.status)}</span></p>
                    <p>Datum: ${new Date(ride.created_at).toLocaleDateString('nl-NL')}</p>
                    <p>Prijs: €${ride.total_fare}</p>
                </div>
            `).join('');
        }
    }

    async loadDriverData() {
        try {
            const response = await this.apiCall('/rides?driver=true&status=pending', 'GET');
            if (response.success) {
                this.displayAvailableRides(response.data.rides);
            }
        } catch (error) {
            console.error('Failed to load driver data:', error);
        }
    }

    displayAvailableRides(rides) {
        const container = document.getElementById('availableRides');
        if (rides.length === 0) {
            container.innerHTML = '<p>Geen beschikbare ritten</p>';
        } else {
            container.innerHTML = rides.map(ride => `
                <div class="ride-item">
                    <h4>Van ${ride.pickup_address}</h4>
                    <p>Naar: ${ride.destination_address}</p>
                    <p>Klant: ${ride.customer_name}</p>
                    <p>Afstand: ~${this.calculateDistance(ride)} km</p>
                    <p>Prijs: €${ride.total_fare}</p>
                    <button onclick="app.acceptRide('${ride.id}')" class="btn btn-primary">Accepteren</button>
                </div>
            `).join('');
        }
    }

    async loadAdminData() {
        try {
            const response = await this.apiCall('/admin/dashboard/stats', 'GET');
            if (response.success) {
                this.displayAdminStats(response.data);
            }
        } catch (error) {
            console.error('Failed to load admin data:', error);
        }
    }

    displayAdminStats(data) {
        const statsContainer = document.getElementById('adminStats');
        statsContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <h4>Ritten Vandaag</h4>
                    <p class="stat-number">${data.rides.today}</p>
                </div>
                <div class="stat-item">
                    <h4>Actieve Ritten</h4>
                    <p class="stat-number">${data.rides.active}</p>
                </div>
                <div class="stat-item">
                    <h4>Omzet Vandaag</h4>
                    <p class="stat-number">€${data.revenue.today.toFixed(2)}</p>
                </div>
                <div class="stat-item">
                    <h4>Actieve Chauffeurs</h4>
                    <p class="stat-number">${data.users.activeDrivers}</p>
                </div>
            </div>
        `;
    }

    async toggleDriverStatus() {
        try {
            const currentStatus = document.getElementById('currentStatus').textContent;
            const newStatus = currentStatus === 'Offline' ? 'available' : 'offline';
            
            const response = await this.apiCall('/tracking/status', 'POST', {
                status: newStatus
            });

            if (response.success) {
                document.getElementById('currentStatus').textContent = newStatus === 'available' ? 'Online' : 'Offline';
                document.getElementById('statusBtn').textContent = newStatus === 'available' ? 'Offline Gaan' : 'Online Gaan';
                this.showNotification(`Status gewijzigd naar ${newStatus === 'available' ? 'Online' : 'Offline'}`, 'success');
            }
        } catch (error) {
            this.showNotification('Status wijziging mislukt: ' + error.message, 'error');
        }
    }

    async acceptRide(rideId) {
        try {
            const response = await this.apiCall(`/rides/${rideId}/accept`, 'POST');
            if (response.success) {
                this.showNotification('Rit geaccepteerd!', 'success');
                this.loadDriverData(); // Refresh available rides
            } else {
                this.showNotification(response.error || 'Rit accepteren mislukt', 'error');
            }
        } catch (error) {
            this.showNotification('Rit accepteren mislukt: ' + error.message, 'error');
        }
    }

    showLiveTracking(rideId) {
        this.showView('liveTracking');
        this.currentRideId = rideId;
        
        // Join ride tracking room
        this.socket.emit('join-ride', {
            rideId: rideId,
            customerId: this.user.id,
            token: this.token
        });

        this.loadRideTrackingData(rideId);
    }

    async loadRideTrackingData(rideId) {
        try {
            const response = await this.apiCall(`/rides/${rideId}`, 'GET');
            if (response.success) {
                this.displayTrackingInfo(response.data.ride);
            }
        } catch (error) {
            console.error('Failed to load tracking data:', error);
        }
    }

    displayTrackingInfo(ride) {
        document.getElementById('rideDetails').innerHTML = `
            <h3>Rit Details</h3>
            <p><strong>Van:</strong> ${ride.pickup_address}</p>
            <p><strong>Naar:</strong> ${ride.destination_address}</p>
            <p><strong>Status:</strong> ${this.getStatusText(ride.status)}</p>
        `;

        if (ride.driver_name) {
            document.getElementById('driverInfo').innerHTML = `
                <h3>Chauffeur</h3>
                <p><strong>Naam:</strong> ${ride.driver_name}</p>
                <p><strong>Telefoon:</strong> ${ride.driver_phone}</p>
            `;
        }
    }

    updateLiveTracking(data) {
        if (this.currentView === 'liveTracking' && data.rideId === this.currentRideId) {
            document.getElementById('estimatedArrival').innerHTML = `
                <h3>Live Locatie</h3>
                <p>Laatste update: ${new Date(data.timestamp).toLocaleTimeString('nl-NL')}</p>
                <p>Snelheid: ${data.location.speed || 0} km/h</p>
            `;
        }
    }

    handleRideUpdate(data) {
        // Refresh dashboard if user is viewing it
        if (this.currentView === 'dashboard') {
            switch (this.user.role) {
                case 'customer':
                    this.loadCustomerData();
                    break;
                case 'driver':
                    this.loadDriverData();
                    break;
                case 'admin':
                    this.loadAdminData();
                    break;
            }
        }
    }

    async estimatePrice() {
        const pickup = document.getElementById('pickupAddress').value;
        const destination = document.getElementById('destinationAddress').value;

        if (pickup.length > 5 && destination.length > 5) {
            // Simple distance estimation for demo
            const estimatedKm = Math.random() * 20 + 5; // 5-25 km
            const estimatedPrice = (2.50 + (estimatedKm * 1.20)).toFixed(2);
            document.getElementById('estimatedPrice').textContent = estimatedPrice;
        }
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('authToken');
        
        document.getElementById('loginBtn').classList.remove('hidden');
        document.getElementById('registerBtn').classList.remove('hidden');
        document.getElementById('userMenu').classList.add('hidden');
        
        this.showView('landing');
        this.showNotification('Succesvol uitgelogd', 'success');
    }

    async apiCall(endpoint, method = 'GET', data = null) {
        const url = this.apiBase + endpoint;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (this.token) {
            options.headers.Authorization = `Bearer ${this.token}`;
        }

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <p>${message}</p>
            <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; font-size: 18px; cursor: pointer;">&times;</button>
        `;

        document.getElementById('notifications').appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    showLoading(show) {
        document.getElementById('loading').classList.toggle('hidden', !show);
    }

    getStatusText(status) {
        const statusMap = {
            'pending': 'In afwachting',
            'assigned': 'Chauffeur toegewezen',
            'picked_up': 'Opgehaald',
            'in_progress': 'Onderweg',
            'completed': 'Voltooid',
            'cancelled': 'Geannuleerd'
        };
        return statusMap[status] || status;
    }

    calculateDistance(ride) {
        // Simple distance calculation for demo
        return Math.floor(Math.random() * 20 + 5);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TaxiApp();
});