const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        const Usuario = result.rows[0];
        const isMatch = await bcrypt.compare(password, Usuario.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Contraseña incorrecta' });
        }
        const token = jwt.sign({ id: Usuario.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({
            message: 'Login exitoso',
            token,
            Usuario: {
                id: Usuario.id,
                nombre: Usuario.nombre,
                email: Usuario.email,
                rol_id: Usuario.rol_id
            }
        })
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}


module.exports = {
    login
};
