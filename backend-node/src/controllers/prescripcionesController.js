const prisma = require('../config/prisma');

// RF-13: Validar prescripción médica por código o número
const validarPrescripcion = async (req, res) => {
    try {
        const { codigo } = req.params;
        const prescripcion = await prisma.prescripcion.findFirst({
            where: {
                numero: {
                    equals: codigo.trim()
                }
            },
            include: {
                detalles: {
                    include: { producto: true }
                }
            }
        });

        if (!prescripcion) {
            return res.status(404).json({
                valido: false,
                mensaje: `La prescripción médica "${codigo}" no existe en el sistema.`
            });
        }

        if (prescripcion.estado === 'Vencida' || prescripcion.estado === 'Utilizada') {
            return res.status(400).json({
                valido: false,
                mensaje: `La prescripción médica "${codigo}" se encuentra en estado: ${prescripcion.estado}.`,
                prescripcion
            });
        }

        res.json({
            valido: true,
            mensaje: 'Prescripción médica válida y autorizada',
            prescripcion
        });
    } catch (error) {
        console.error('Error validando prescripción:', error);
        res.status(500).json({ error: error.message });
    }
};

const getPrescripciones = async (req, res) => {
    try {
        const prescripciones = await prisma.prescripcion.findMany({
            include: {
                detalles: {
                    include: { producto: true }
                },
                ventas: {
                    select: { id: true, total: true, fecha: true }
                }
            },
            orderBy: { fecha: 'desc' }
        });
        res.json(prescripciones);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createPrescripcion = async (req, res) => {
    try {
        const { numero, fecha, cliente, veterinario, observaciones, detalles } = req.body;

        if (!numero || !cliente || !veterinario) {
            return res.status(400).json({ message: 'Número de receta, cliente y veterinario son requeridos' });
        }

        const existe = await prisma.prescripcion.findUnique({ where: { numero } });
        if (existe) {
            return res.status(400).json({ message: 'Ya existe una prescripción con este código' });
        }

        const nueva = await prisma.prescripcion.create({
            data: {
                numero: numero.trim(),
                fecha: fecha ? new Date(fecha) : new Date(),
                cliente,
                veterinario,
                observaciones: observaciones || '',
                estado: 'Activa',
                detalles: detalles && detalles.length > 0 ? {
                    create: detalles.map(d => ({
                        idProducto: parseInt(d.idProducto),
                        cantidad: parseInt(d.cantidad || 1),
                        indicaciones: d.indicaciones || ''
                    }))
                } : undefined
            },
            include: {
                detalles: {
                    include: { producto: true }
                }
            }
        });

        res.status(201).json({
            message: 'Prescripción médica registrada exitosamente',
            prescripcion: nueva
        });
    } catch (error) {
        console.error('Error creando prescripción:', error);
        res.status(500).json({ error: error.message });
    }
};

const updatePrescripcion = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { cliente, veterinario, observaciones, estado } = req.body;

        const actualizada = await prisma.prescripcion.update({
            where: { id },
            data: {
                cliente,
                veterinario,
                observaciones,
                estado
            }
        });

        res.json({ message: 'Prescripción actualizada', prescripcion: actualizada });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deletePrescripcion = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await prisma.prescripcion.delete({ where: { id } });
        res.json({ message: 'Prescripción eliminada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    crearPrescripcion,
    obtenerPrescripcionesPorMascota,
    obtenerPrescripcionesPorEstado,
    actualizarPrescripcion,
    anularPrescripcion,
    updatePrescripcion,
    deletePrescripcion
};