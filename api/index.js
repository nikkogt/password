// 1. Import Packages
const express = require('express');
const path = require('path');
const { put, list, del } = require('@vercel/blob');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

// 2. Setup App
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'CLAVE_SECRETA_DE_PASSWORD_SAS'; // In production use process.env.JWT_SECRET
const ADMIN_USER = 'admin';
const ADMIN_PASS = '12345';

// Trust Proxy for Vercel (Required for Secure Cookies)
app.set('trust proxy', 1);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 3. BlobDB Helper (Serverless Database)
const DB_FILENAME = 'database.json';

class BlobDB {
    // Helper to find the DB URL
    static async getDbUrl() {
        if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
        const { blobs } = await list();
        const dbBlob = blobs.find(b => b.pathname === DB_FILENAME);
        return dbBlob ? dbBlob.url : null;
    }

    // Load all images
    static async getImages() {
        try {
            const url = await this.getDbUrl();
            if (!url) return []; // No DB exists yet
            const response = await fetch(url);
            if (!response.ok) return [];
            return await response.json();
        } catch (e) {
            console.error('Error reading DB:', e);
            return [];
        }
    }

    // Add an image
    static async addImage(image) {
        let images = await this.getImages();
        // Add ID if missing (simple timestamp id)
        image._id = Date.now().toString();
        image.uploadedAt = new Date();
        images.push(image);
        await this.save(images);
        return image;
    }

    // Delete an image
    static async deleteImage(id) {
        let images = await this.getImages();
        const initialLength = images.length;
        images = images.filter(img => img._id !== id);
        if (images.length !== initialLength) {
            await this.save(images);
            return true;
        }
        return false;
    }

    // Save the entire array back to Blob
    static async save(data) {
        await put(DB_FILENAME, JSON.stringify(data), {
            access: 'public',
            addRandomSuffix: false // Overwrite the file
        });
    }
}

// 4. Auth Middleware
const requireAdmin = (req, res, next) => {
    const token = req.cookies.admin_token;
    if (!token) return res.status(403).json({ message: 'No token provided' });

    try {
        jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

const upload = multer({ storage: multer.memoryStorage() });

// --- ROUTES ---

// Health Check
app.get('/api/health', (req, res) => {
    res.status(200).send('OK - Serverless Mode');
});

// Login (JWT)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }
});

// Check Login
app.get('/api/check-login', (req, res) => {
    const token = req.cookies.admin_token;
    if (!token) return res.status(401).json({ loggedIn: false });
    try {
        jwt.verify(token, JWT_SECRET);
        res.json({ loggedIn: true });
    } catch {
        res.status(401).json({ loggedIn: false });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.json({ message: 'Logged out' });
});

// Public Images
app.get('/api/public/images', async (req, res) => {
    const images = await BlobDB.getImages();
    res.json({ images });
});

// Admin Images List
app.get('/api/imagenes', requireAdmin, async (req, res) => {
    const images = await BlobDB.getImages();
    // Simple pagination mock
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const paginated = images.slice(startIndex, endIndex);

    res.json({
        images: paginated,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(images.length / limit),
            totalImages: images.length,
            limit
        }
    });
});

// Upload Image
app.post('/api/imagenes/subir', requireAdmin, upload.single('imagen'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file' });

    try {
        // 1. Upload file
        let imageUrl;
        if (process.env.BLOB_READ_WRITE_TOKEN) {
            const blob = await put(req.file.originalname, req.file.buffer, { access: 'public' });
            imageUrl = blob.url;
        } else {
            // Local fallback (Warning: Vercel FS is read-only in endpoints, this is strictly for dev)
            const fs = require('fs');
            // ... (Simple local save logic omitted for brevity as goal is Vercel)
            imageUrl = 'https://placehold.co/600x400';
            console.warn('No BLOB_TOKEN, using placeholder');
        }

        // 2. Save Metadata
        const newImage = {
            url: imageUrl,
            blobUrl: imageUrl,
            originalName: req.file.originalname,
            title: req.body.title || '',
            category: req.body.category || 'gallery',
            description: req.body.description || ''
        };

        const saved = await BlobDB.addImage(newImage);
        console.log('Image saved to metadata:', saved);
        return res.status(200).json({
            success: true,
            message: 'Imagen subida exitosamente.',
            image: saved
        });
    } catch (e) {
        console.error('Upload Error:', e); // Detailed logging
        console.error('Stack:', e.stack);
        res.status(500).json({ success: false, message: 'Server error during upload: ' + e.message });
    }
});

// Delete Image
app.delete('/api/imagenes/:id', requireAdmin, async (req, res) => {
    try {
        const images = await BlobDB.getImages();
        const image = images.find(img => img._id === req.params.id);

        if (!image) return res.status(404).json({ message: 'Not found' });

        // Try to delete blob file
        if (image.blobUrl && process.env.BLOB_READ_WRITE_TOKEN) {
            await del(image.blobUrl).catch(e => console.error('Blob delete failed', e));
        }

        await BlobDB.deleteImage(req.params.id);
        res.json({
            success: true,
            message: 'Imagen eliminada exitosamente.'
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Export app
module.exports = app;

if (require.main === module) {
    app.listen(PORT, () => console.log(`Serverless API running on ${PORT}`));
}
