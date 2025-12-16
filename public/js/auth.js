// api/auth.js
const mongoose = require('mongoose');
const User = require('../models/User'); // Importa el modelo User
const jwt = require('jsonwebtoken');

const { MONGODB_URI, JWT_SECRET } = process.env;

// Función Serverless Handler para Iniciar Sesión
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método no permitido. Solo POST.' });
    }

    try {
        // 1. Conexión a MongoDB
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(MONGODB_URI);
        }

        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Se requieren usuario y contraseña.' });
        }

        // 2. Buscar y verificar usuario
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        // 3. Usar el método comparePassword definido en el modelo User (usando bcrypt)
        const isMatch = await user.comparePassword(password);
        
        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        // 4. Generar JWT (expira en 1 hora)
        const token = jwt.sign(
            { id: user._id, username: user.username }, 
            JWT_SECRET, 
            { expiresIn: '1h' } 
        );

        // 5. Respuesta exitosa
        return res.status(200).json({ 
            message: 'Autenticación exitosa', 
            token
        });

    } catch (error) {
        console.error('Error de autenticación:', error);
        return res.status(500).json({ message: 'Error interno del servidor durante la autenticación.' });
    }
};