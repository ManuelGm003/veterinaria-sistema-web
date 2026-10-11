const prisma = require('../config/prisma');

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

        const config = await prisma.configuracion.findFirst();
        let actualizado;

        if (config) {
            actualizado = await prisma.configuracion.update({
                where: { id: config.id },
                data: {
                    nombreVeterinaria,
                    ruc,
                    telefono,
                    email,
                    direccion,
                    monedaSimbolo,
                    stockMinimoAlerta: parseInt(stockMinimoAlerta) || 5,
                    diasAlertaVencimiento: parseInt(diasAlertaVencimiento) || 30
                }
            });
        } else {
            actualizado = await prisma.configuracion.create({
                data: {
                    nombreVeterinaria,
                    ruc,
                    telefono,
                    email,
                    direccion,
                    monedaSimbolo,
                    stockMinimoAlerta: parseInt(stockMinimoAlerta) || 5,
                    diasAlertaVencimiento: parseInt(diasAlertaVencimiento) || 30
                }
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
