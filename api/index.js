// 1. Importar la librería Express
const multer = require('multer');
const fs = require('fs'); // Módulo para manejar archivos del sistema operativo
const express = require('express');
const path = require('path'); // Módulo nativo para manejar rutas de archivos
const { put, del } = require('@vercel/blob');
const mongoose = require('mongoose');

// 2. Crear una instancia de la aplicación Express
const app = express();
// Nota: en Vercel, PORT no es necesario, pero lo mantenemos para local
const PORT = process.env.PORT || 0;

// --- CONFIGURACIÓN DEL SERVIDOR ---
// Necesario para que las cookies seguras funcionen detrás del proxy de Vercel
app.set('trust proxy', 1);

// 3. Servir archivos estáticos: HTML, CSS, JS e imágenes
// Ajuste de rutas para Vercel: salir de 'api' para buscar 'public'
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Nota: El servidor Express está listo con MongoDB

const bodyParser = require('body-parser'); // Para procesar datos del formulario
const session = require('express-session'); // Para manejar sesiones
const MongoStore = require('connect-mongo').default || require('connect-mongo');


// --- CONFIGURACIÓN DEL SERVIDOR ---

// 1. Configuración de Body Parser para leer JSON y formularios
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 2. Configuración de la Sesión
// 2. Configuración de la Sesión
const sessionConfig = {
    secret: 'CLAVE_SECRETA_DE_PASSWORD_SAS',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
};

// Usar MongoDB Store si hay URI disponible (Recomendado para Producción/Vercel)
if (process.env.MONGODB_URI) {
    try {
        sessionConfig.store = MongoStore.create({
            mongoUrl: process.env.MONGODB_URI,
            collectionName: 'sessions',
            ttl: 24 * 60 * 60 // 1 day
        });
        console.log('🔒 Configurada persistencia de sesiones en MongoDB.');
    } catch (err) {
        console.error('❌ Error configurando MongoStore:', err);
        console.warn('⚠️  Usando MemoryStore (fallback) debido a error en configuración de MongoDB.');
    }
} else {
    console.warn('⚠️  Usando MemoryStore para sesiones (No persistente en Vercel). Configure MONGODB_URI.');
}

app.use(session(sessionConfig));
const storage = multer.memoryStorage();

const upload = multer({ storage: storage });

// 2. Conectar a MongoDB
require('dotenv').config();

// Solo importar MongoMemoryServer en desarrollo/local
let MongoMemoryServer;
// Ajuste: verificar process.env.VERCEL no está definido para comportamiento local estricto si fuera necesario, 
// o simplemente confiar en NODE_ENV
if (process.env.NODE_ENV !== 'production') {
    try {
        MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
    } catch (e) {
        console.log('MongoMemoryServer no encontrado, omitiendo...');
    }
}

const connectDB = async () => {
    let mongoURI = process.env.MONGODB_URI;

    try {
        // Intento 1: Conexión directa a la URI configurada (si existe y no es la default fallida)
        if (mongoURI && !mongoURI.includes('localhost')) {
            await mongoose.connect(mongoURI);
            console.log('✅ Conectado a MongoDB (Remoto/Configurado)');
            return;
        } else {
            if (process.env.NODE_ENV === 'production') {
                console.warn('⚠️ ADVERTENCIA: MONGODB_URI no está definido o es inválido en entorno de producción.');
            }
        }


        // Intento 2: Probar conexión local estándar
        try {
            await mongoose.connect('mongodb://127.0.0.1:27017/password', { serverSelectionTimeoutMS: 2000 });
            console.log('✅ Conectado a MongoDB (Local 127.0.0.1)');
        } catch (localErr) {
            console.log('⚠️ No se encontró MongoDB local.');

            // Fallback: In-Memory Database (SOLO si no estamos en producción)
            if (process.env.NODE_ENV !== 'production' && MongoMemoryServer) {
                console.log('Iniciando base de datos en memoria...');
                const mongod = await MongoMemoryServer.create();
                const uri = mongod.getUri();
                await mongoose.connect(uri);
                console.log('✅ Conectado a MongoDB en Memoria (Datos temporales)');
                console.log('ℹ️  Nota: Los datos se borrarán al detener el servidor.');
            } else {
                console.error('❌ Error CRÍTICO: No se pudo conectar a ninguna base de datos.');
                console.error('   -> En Producción (Vercel), asegúrate de tener la variable MONGODB_URI configurada.');
                console.error('   -> En Local, asegúrate de que MongoDB esté corriendo.');
            }
        }

    } catch (err) {
        console.error('❌ Error fatal conectando a base de datos:', err.message);
    }
};

connectDB();

// 3. Schema y Modelo de Imagen
const imageSchema = new mongoose.Schema({
    url: String,
    blobUrl: String,
    originalName: String,
    uploadedAt: { type: Date, default: Date.now },
    category: { type: String, enum: ['gallery', 'tips'], default: 'gallery' },
    title: String,
    description: String
});

const Image = mongoose.model('Image', imageSchema);

// 4. Datos Fijos de Administrador (EJEMPLO - En un proyecto real usarías una DB)
const ADMIN_USER = 'admin';
const ADMIN_PASS = '12345'; // ¡Nunca uses esto en producción!

// --- RUTAS DE AUTENTICACIÓN ---

// 4. Ruta GET para verificar si está logueado
app.get('/api/check-login', (req, res) => {
    if (req.session.isAdmin) {
        res.status(200).json({ loggedIn: true });
    } else {
        res.status(401).json({ loggedIn: false });
    }
});

// Ruta de salud para verificar que el servidor Vercel responde al menos
app.get('/api/health', (req, res) => {
    res.status(200).send('OK - Server is running');
});

// 5. Ruta POST para manejar el Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        // Credenciales correctas: Establecer la sesión
        req.session.isAdmin = true;
        // Responder con éxito y redirigir al panel de administración
        return res.status(200).json({ success: true, message: 'Login exitoso.' });
    } else {
        // Credenciales incorrectas
        return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' });
    }
});

// 6. Ruta POST para Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Error al cerrar sesión' });
        }
        res.status(200).json({ message: 'Sesión cerrada' });
    });
});

// 6. Función Middleware para proteger rutas (Verificar si el usuario ha iniciado sesión)
function requireAdmin(req, res, next) {
    if (req.session.isAdmin) {
        // Si la sesión está activa, continúa con la siguiente función (next())
        next();
    } else {
        // Si no está logueado, denegar acceso.
        res.status(403).json({ message: 'Acceso denegado. Se requiere iniciar sesión.' });
    }
}



// --- INICIO DEL SERVIDOR ---

// Para Vercel: Exportar la app
module.exports = app;

// Iniciar servidor (fuera del callback de conexión para evitar timeout en Vercel)
if (require.main === module) {
    const server = app.listen(PORT, () => {
        const actualPort = server.address().port;
        // Ajuste en mensaje para claridad
        console.log(`🚀 Servidor de PassWord S.A.S. corriendo en http://localhost:${actualPort}`);
        console.log(`📂 Panel de Administración: http://localhost:${actualPort}/admin.html`);
    });
}

// --- RUTA PROTEGIDA: Carga de Imagen ---
app.post('/api/imagenes/subir', requireAdmin, upload.single('imagen'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No se subió ningún archivo.' });
    }

    try {
        // 1. Subir el archivo a Vercel Blob o Local
        let imageUrl;
        if (process.env.BLOB_READ_WRITE_TOKEN) {
            // 1a. Subir a Vercel Blob (Nube)
            const blob = await put(req.file.originalname, req.file.buffer, {
                access: 'public',
            });
            imageUrl = blob.url;
        } else {
            // 1b. Guardar Localmente (Fallback)
            // Ajustamos path para que guarde en ../uploads
            const filename = `imagen-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(req.file.originalname)}`;
            const filepath = path.join(__dirname, '../uploads', filename);

            // Asegurar que existe la carpeta
            if (!fs.existsSync(path.join(__dirname, '../uploads'))) {
                fs.mkdirSync(path.join(__dirname, '../uploads'));
            }

            fs.writeFileSync(filepath, req.file.buffer);

            // URL Local
            const protocol = req.protocol;
            const host = req.get('host');
            // La ruta es /uploads/... que servimos estáticamente
            imageUrl = `${protocol}://${host}/uploads/${filename}`;
            console.log('⚠️ Blob no configurado. Imagen guardada localmente en:', filepath);
        }

        // 2. Guardar en MongoDB
        const category = req.body.category || 'gallery';
        const title = req.body.title || '';
        const description = req.body.description || '';

        const newImage = new Image({
            url: imageUrl,
            blobUrl: imageUrl,
            originalName: req.file.originalname,
            category,
            title,
            description
        });

        const savedImage = await newImage.save();

        // 3. Responder al Front-end
        res.status(201).json({
            success: true,
            message: 'Imagen subida exitosamente.',
            image: savedImage
        });
    } catch (error) {
        console.error('Error subiendo a Blob/MongoDB:', error.message);
        res.status(500).json({ success: false, message: 'Error al subir la imagen: ' + error.message });
    }
});
// --- RUTA PÚBLICA: Obtener imágenes para la página principal ---
app.get('/api/public/images', async (req, res) => {
    try {
        const images = await Image.find();
        return res.status(200).json({ images });
    } catch (error) {
        console.error('Error obteniendo imágenes públicas:', error);
        res.status(500).json({ message: 'Error al obtener imágenes.' });
    }
});

// --- RUTA PROTEGIDA: Obtener la lista de imágenes ---
app.get('/api/imagenes', requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const totalImages = await Image.countDocuments();
        const paginatedImages = await Image.find().skip(offset).limit(limit);
        const totalPages = Math.ceil(totalImages / limit);

        return res.status(200).json({
            images: paginatedImages,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalImages: totalImages,
                limit: limit
            }
        });
    } catch (error) {
        console.error('Error obteniendo imágenes:', error);
        res.status(500).json({ message: 'Error al obtener imágenes.' });
    }
});
// --- RUTA PROTEGIDA: Eliminar una imagen ---
app.delete('/api/imagenes/:id', requireAdmin, async (req, res) => {
    try {
        const imageId = req.params.id;
        const image = await Image.findById(imageId);

        if (!image) {
            return res.status(404).json({ success: false, message: 'Imagen no encontrada.' });
        }

        // 1. Eliminar archivo (Blob o Local)
        if (image.url.includes('/uploads/')) {
            // Es un archivo local
            const filename = image.url.split('/uploads/')[1];
            // Fix path ../uploads
            const filepath = path.join(__dirname, '../uploads', filename);
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
                console.log('🗑️ Archivo local eliminado:', filepath);
            }
        } else if (image.blobUrl && process.env.BLOB_READ_WRITE_TOKEN) {
            // Es un Blob de Vercel
            await del(image.blobUrl);
        }

        // 2. Eliminar de MongoDB
        await Image.findByIdAndDelete(imageId);

        return res.status(200).json({
            success: true,
            message: `Imagen eliminada exitosamente.`
        });
    } catch (error) {
        console.error('Error al eliminar:', error);
        res.status(500).json({ success: false, message: 'Error al eliminar la imagen.' });
    }
});
