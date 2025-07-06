const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 3000;

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

    let filePath = path.join(__dirname, 'public', req.url);
    
    // Default to index.html
    if (req.url === '/') {
        filePath = path.join(__dirname, 'public', 'index.html');
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // File not found
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end(`
                    <html>
                    <body>
                        <h1>404 Not Found</h1>
                        <p>File not found: ${req.url}</p>
                        <p><a href="/admin-pro.html">Go to Admin Panel</a></p>
                        <p><a href="/booking-exact.html">Go to Booking System</a></p>
                    </body>
                    </html>
                `);
            } else {
                // Server error
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`);
            }
        } else {
            // Success
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(port, () => {
    console.log(`🚀 Marcel's Taxi Server running at http://localhost:${port}/`);
    console.log(`📱 Admin Panel: http://localhost:${port}/admin-pro.html`);
    console.log(`🎫 Booking System: http://localhost:${port}/booking-exact.html`);
    console.log(`🚗 Vehicle Manager: http://localhost:${port}/vehicle-manager.html`);
    console.log('');
    console.log('✅ Server ready - Vehicle management and booking system synchronized!');
});