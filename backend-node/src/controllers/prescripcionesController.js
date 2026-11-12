const prisma = require('../config/prisma');
const {
    isPositiveInteger,
    isNonEmptyString,
    isValidDate
} = require('../utils/validators');

// RF-13: Validar prescripción médica por código o número
const validarPrescripcion = async (req, res) => {
    try {
        const { codigo } = req.params;
        if (!isNonEmptyString(codigo)) {
            return res.status(400).json({
                valido: false,
                mensaje: 'Debe proporcionar un código de prescripción válido.'
            });
        }

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

        if (prescripcion.estado === 'Vencida' || prescripcion.estado === 'Utilizada' || prescripcion.estado === 'ANULADA') {
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
        const { search, estado } = req.query;
        const whereClause = {};

        if (estado) {
            whereClause.estado = estado.toUpperCase();
        }

        if (search) {
            whereClause.OR = [
                { numero: { contains: search } },
                { cliente: { contains: search } },
                { veterinario: { contains: search } },
                { observaciones: { contains: search } }
            ];
        }

        const prescripciones = await prisma.prescripcion.findMany({
            where: whereClause,
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

        if (!isNonEmptyString(numero)) {
            return res.status(400).json({ message: 'El código / número de receta es obligatorio y no puede estar vacío.' });
        }

        if (!isNonEmptyString(cliente)) {
            return res.status(400).json({ message: 'El nombre del cliente / tutor es obligatorio.' });
        }

        if (!isNonEmptyString(veterinario)) {
            return res.status(400).json({ message: 'El nombre del veterinario emisor es obligatorio.' });
        }

        if (fecha && !isValidDate(fecha)) {
            return res.status(400).json({ message: 'La fecha de la prescripción no es válida.' });
        }

        const existe = await prisma.prescripcion.findUnique({ where: { numero: numero.trim() } });
        if (existe) {
            return res.status(400).json({ message: 'Ya existe una prescripción registrada con este código.' });
        }

        let detallesValidados = [];
        if (detalles && Array.isArray(detalles) && detalles.length > 0) {
            for (let i = 0; i < detalles.length; i++) {
                const d = detalles[i];
                const fila = i + 1;

                if (!isPositiveInteger(d.idProducto)) {
                    return res.status(400).json({ message: `Medicamento ${fila}: ID de producto inválido.` });
                }

                if (!isPositiveInteger(d.cantidad)) {
                    return res.status(400).json({ message: `Medicamento ${fila}: La cantidad prescrita debe ser un número entero mayor a 0 (no se permite 0, -0 ni valores negativos).` });
                }

                detallesValidados.push({
                    idProducto: parseInt(d.idProducto),
                    cantidad: parseInt(d.cantidad),
                    indicaciones: d.indicaciones ? d.indicaciones.trim() : ''
                });
            }
        }

        const nueva = await prisma.prescripcion.create({
            data: {
                numero: numero.trim(),
                fecha: fecha ? new Date(fecha) : new Date(),
                cliente: cliente.trim(),
                veterinario: veterinario.trim(),
                observaciones: observaciones ? observaciones.trim() : '',
                estado: 'Activa',
                detalles: detallesValidados.length > 0 ? {
                    create: detallesValidados
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
        if (!isPositiveInteger(id)) {
            return res.status(400).json({ message: 'ID de prescripción inválido' });
        }

        const { cliente, veterinario, observaciones, estado } = req.body;
        const dataUpdate = {};

        if (cliente !== undefined) {
            if (!isNonEmptyString(cliente)) {
                return res.status(400).json({ message: 'El cliente no puede estar vacío.' });
            }
            dataUpdate.cliente = cliente.trim();
        }

        if (veterinario !== undefined) {
            if (!isNonEmptyString(veterinario)) {
                return res.status(400).json({ message: 'El veterinario no puede estar vacío.' });
            }
            dataUpdate.veterinario = veterinario.trim();
        }

        if (observaciones !== undefined) {
            dataUpdate.observaciones = observaciones ? observaciones.trim() : '';
        }

        if (estado !== undefined) {
            if (!isNonEmptyString(estado)) {
                return res.status(400).json({ message: 'El estado no puede estar vacío.' });
            }
            dataUpdate.estado = estado.trim();
        }

        const actualizada = await prisma.prescripcion.update({
            where: { id },
            data: dataUpdate
        });

        res.json({ message: 'Prescripción actualizada exitosamente', prescripcion: actualizada });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deletePrescripcion = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!isPositiveInteger(id)) {
            return res.status(400).json({ message: 'ID de prescripción inválido' });
        }

        await prisma.prescripcion.delete({ where: { id } });
        res.json({ message: 'Prescripción eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const obtenerPrescripcionesPorMascota = async (req, res) => {
    try {
        const { mascotaId } = req.params;
        if (!isPositiveInteger(mascotaId)) {
            return res.status(400).json({ message: 'ID de mascota inválido' });
        }

        const prescripciones = await prisma.prescripcion.findMany({
            where: { mascotaId: parseInt(mascotaId) }
        });
        return res.status(200).json(prescripciones);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

const obtenerPrescripcionesPorEstado = async (req, res) => {
    try {
        const { estado } = req.params;
        if (!isNonEmptyString(estado)) {
            return res.status(400).json({ message: 'Estado inválido' });
        }

        const prescripciones = await prisma.prescripcion.findMany({
            where: { estado: estado.toUpperCase().trim() }
        });
        return res.status(200).json(prescripciones);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

const anularPrescripcion = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isPositiveInteger(id)) {
            return res.status(400).json({ message: 'ID de prescripción inválido' });
        }

        const prescripcionAnulada = await prisma.prescripcion.update({
            where: { id: parseInt(id) },
            data: { estado: 'ANULADA' }
        });
        return res.status(200).json({ 
            message: 'Prescripción anulada con éxito', 
            prescripcion: prescripcionAnulada 
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

module.exports = {
    validarPrescripcion,
    getPrescripciones,
    createPrescripcion,
    updatePrescripcion,
    deletePrescripcion,
    obtenerPrescripcionesPorMascota,
    obtenerPrescripcionesPorEstado,
    anularPrescripcion
};
