const prisma = require('../config/prisma');
const {
    isPositiveInteger,
    isNonEmptyString,
    isValidEmail
} = require('../utils/validators');

const getConfiguracion = async (req, res) => {
    try {
        let config = await prisma.configuracion.findFirst();
        if (!config) {
            config = await prisma.configuracion.create({
                data: {
                    nombreVeterinaria: 'VetSalud Veterinaria',
                    ruc: 'J0310000248811',
                    telefono: '+505 2244-8899',
                    email: 'contacto@vetsalud.com',
                    direccion: 'Semáforos de Villa Fontana 2c al lago, Managua',
                    monedaSimbolo: 'C$',
                    stockMinimoAlerta: 5,
                    diasAlertaVencimiento: 30
                }
            });
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateConfiguracion = async (req, res) => {
    try {
        const {
            nombreVeterinaria, ruc, telefono, email, direccion,
            monedaSimbolo, stockMinimoAlerta, diasAlertaVencimiento
        } = req.body;

        if (!isNonEmptyString(nombreVeterinaria)) {
            return res.status(400).json({ message: 'El nombre de la veterinaria no puede estar vacío.' });
        }

        if (email && isNonEmptyString(email) && !isValidEmail(email)) {
            return res.status(400).json({ message: 'El correo electrónico de configuración no es válido.' });
        }

        if (!isPositiveInteger(stockMinimoAlerta)) {
            return res.status(400).json({ message: 'El stock mínimo de alerta general debe ser un número entero mayor a 0 (mínimo 1).' });
        }

        if (!isPositiveInteger(diasAlertaVencimiento)) {
            return res.status(400).json({ message: 'Los días de alerta de vencimiento deben ser un número entero mayor a 0 (mínimo 1).' });
        }

        const config = await prisma.configuracion.findFirst();
        const dataSave = {
            nombreVeterinaria: nombreVeterinaria.trim(),
            ruc: ruc ? ruc.trim() : null,
            telefono: telefono ? telefono.trim() : null,
            email: email && isNonEmptyString(email) ? email.trim() : null,
            direccion: direccion ? direccion.trim() : null,
            monedaSimbolo: isNonEmptyString(monedaSimbolo) ? monedaSimbolo.trim() : 'C$',
            stockMinimoAlerta: parseInt(stockMinimoAlerta),
            diasAlertaVencimiento: parseInt(diasAlertaVencimiento)
        };

        let actualizado;
        if (config) {
            actualizado = await prisma.configuracion.update({
                where: { id: config.id },
                data: dataSave
            });
        } else {
            actualizado = await prisma.configuracion.create({
                data: dataSave
            });
        }

        res.json({ message: 'Configuración actualizada con éxito', config: actualizado });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getConfiguracion,
    updateConfiguracion
};
