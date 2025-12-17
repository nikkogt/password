// 1. Core Imports
const express = require('express');
const path = require('path');
const { put, list, del } = require('@vercel/blob');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

// 2. Setup App & Constants
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'CLAVE_SECRETA_DE_PASSWORD_SAS';
const DB_FILENAME = 'database.json';

// Trust Proxy for Vercel (Required for Secure Cookies)
app.set('trust proxy', 1);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// 3. BlobDB: Serverless Database Logic
class BlobDB {
    static async getDbUrl() {
        if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
        const { blobs } = await list();
        const dbBlob = blobs.find(b => b.pathname === DB_FILENAME);
        return dbBlob ? dbBlob.url : null;
    }

    static async getImages() {
        try {
            const url = await this.getDbUrl();
            if (!url) return [];
            // FORCE NO-CACHE: Vercel Blob updates can be slow to propagate if cached
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) return [];
            return await response.json();
        } catch (e) {
            console.error('BlobDB Read Error:', e);
            return [];
        }
    }

    static async save(data) {
        await put(DB_FILENAME, JSON.stringify(data), {
            access: 'public',
            addRandomSuffix: false // Overwrites the file
        });
    }

    static async addImage(image) {
        const images = await this.getImages();
        image._id = Date.now().toString();
        image.uploadedAt = new Date();
        images.push(image);
        await this.save(images);
        return image;
    }

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
}

// 4. Auth Middleware
const requireAdmin = (req, res, next) => {
    const token = req.cookies.admin_token;
    if (!token) return res.status(403).json({ message: 'No token' });
    try {
        jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ message: 'Invalid token' });
    }
};

const upload = multer({ storage: multer.memoryStorage() });

// --- ROUTES ---

// Health Check
app.get('/api/health', (req, res) => res.send('Serverless API OK'));

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // Hardcoded for simplicity as requested, in real app use env vars or DB
    if (username === 'admin' && password === '12345') {
        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 86400000,
            sameSite: 'lax'
        });
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }
});

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

app.post('/api/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.json({ message: 'Logged out' });
});

// PUBLIC IMAGES (The Critical Route)
// Strongly typed caching headers to prevent stale content
app.get('/api/public/images', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const images = await BlobDB.getImages();
    res.json({ images });
});

// ADMIN IMAGES
app.get('/api/imagenes', requireAdmin, async (req, res) => {
    const images = await BlobDB.getImages();
    res.json({ images }); // Simplified, client handles pagination for now or we add it back if list is huge
});

// UPLOAD IMAGE
app.post('/api/imagenes/subir', requireAdmin, upload.single('imagen'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file' });

    try {
        // Upload to Vercel Blob
        const blob = await put(req.file.originalname, req.file.buffer, { access: 'public' });

        // Save Metadata
        const newImage = {
            url: blob.url,
            blobUrl: blob.url,
            originalName: req.file.originalname,
            title: req.body.title || '',
            category: req.body.category || 'gallery', // Default to gallery
            description: req.body.description || ''
        };

        const saved = await BlobDB.addImage(newImage);
        res.json({ success: true, message: 'Imagen subida exitosamente.', image: saved });
    } catch (e) {
        console.error('Upload Error:', e);
        res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
});

// DELETE IMAGE
app.delete('/api/imagenes/:id', requireAdmin, async (req, res) => {
    try {
        const images = await BlobDB.getImages();
        const image = images.find(img => img._id === req.params.id);

        if (image && image.blobUrl) {
            await del(image.blobUrl).catch(e => console.warn('Blob delete failed (non-fatal):', e));
        }

        await BlobDB.deleteImage(req.params.id);
        res.json({ success: true, message: 'Imagen eliminada exitosamente.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Export
module.exports = app;

if (require.main === module) {
    app.listen(PORT, () => console.log(`API running on ${PORT}`));
}
