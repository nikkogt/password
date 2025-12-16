// api/verify.js
const jwt = require('jsonwebtoken');

const { JWT_SECRET } = process.env;

// Función Serverless Handler para Verificar Token
module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Método no permitido. Solo GET.' });
    }
    
    // El token se espera en el header 'Authorization'
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // 1. Verificar y decodificar el token usando la clave secreta
        const decoded = jwt.verify(token, JWT_SECRET);

        // 2. Si es exitoso, el token es válido
        // NOTA: No es necesario verificar en la BD a menos que se quiera comprobar 
        // si el usuario fue eliminado o baneado (simplificamos para este proyecto).
        
        return res.status(200).json({ 
            message: 'Token válido',
            user: { id: decoded.id, username: decoded.username }
        });

    } catch (error) {
        // Si jwt.verify falla (token expirado, incorrecto, etc.)
        console.error('Verificación de token fallida:', error.message);
        return res.status(401).json({ message: 'Token inválido o expirado.', error: error.message });
    }
};