const prisma = require('../config/prisma');
const {
    isPositiveInteger,
    isPositiveNumber,
    isNonEmptyString
} = require('../utils/validators');

// Listar mascotas con filtros opcionales
const getMascotas = async (req, res) => {
    try {
        const { search } = req.query;
        const whereClause = { estado: true };

        if (search) {
            whereClause.OR = [
                { nombre: { contains: search } },
                { propietario: { contains: search } },
                { especie: { contains: search } },
                { raza: { contains: search } }
            ];
        }

        const mascotas = await prisma.mascota.findMany({
            where: whereClause,
            include: {
                historiales: {
                    orderBy: { fecha: 'desc' },
                    take: 5
                },
                prescripciones: {
                    orderBy: { fecha: 'desc' },
                    take: 5
                }
            },
            orderBy: { id: 'desc' }
        });

        res.json(mascotas);
    } catch (error) {
        console.error('Error al listar mascotas:', error);
        res.status(500).json({ error: error.message });
    }
};

// Obtener mascota por ID con su historial clínico completo y prescripciones asociadas
const getMascotaById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!isPositiveInteger(id)) {
            return res.status(400).json({ message: 'ID de mascota inválido' });
        }

        const mascota = await prisma.mascota.findUnique({
            where: { id },
            include: {
                historiales: {
                    orderBy: { fecha: 'desc' }
                },
                prescripciones: {
                    include: {
                        detalles: {
                            include: { producto: true }
                        }
                    },
                    orderBy: { fecha: 'desc' }
                }
            }
        });

        if (!mascota) {
            return res.status(404).json({ message: 'Mascota no encontrada' });
        }

        res.json(mascota);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Registrar una nueva mascota paciente
const createMascota = async (req, res) => {
    try {
        const { nombre, especie, raza, edad, sexo, peso, propietario, telefono } = req.body;

        if (!isNonEmptyString(nombre)) {
            return res.status(400).json({ message: 'El nombre de la mascota es obligatorio y no puede estar vacío.' });
        }

        if (!isNonEmptyString(especie)) {
            return res.status(400).json({ message: 'La especie de la mascota es obligatoria (ej: Canino, Felino).' });
        }

        if (!isNonEmptyString(propietario)) {
            return res.status(400).json({ message: 'El nombre del propietario/tutor es obligatorio.' });
        }

        if (edad !== undefined && edad !== null && edad !== '') {
            if (!isPositiveInteger(edad)) {
                return res.status(400).json({ message: 'La edad debe ser un número entero mayor a 0.' });
            }
        }

        if (peso !== undefined && peso !== null && peso !== '') {
            if (!isPositiveNumber(peso)) {
                return res.status(400).json({ message: 'El peso debe ser un número mayor a 0.' });
            }
        }

        const nuevaMascota = await prisma.mascota.create({
            data: {
                nombre: nombre.trim(),
                especie: especie.trim(),
                raza: raza ? raza.trim() : null,
                edad: edad ? parseInt(edad) : null,
                sexo: sexo ? sexo.trim() : null,
                peso: peso ? parseFloat(peso) : null,
                propietario: propietario.trim(),
                telefono: telefono ? telefono.trim() : null,
                estado: true
            }
        });

        res.status(201).json({
            message: 'Mascota registrada exitosamente',
            mascota: nuevaMascota
        });
    } catch (error) {
        console.error('Error al registrar mascota:', error);
        res.status(500).json({ error: error.message });
    }
};

// Actualizar datos de la mascota
const updateMascota = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!isPositiveInteger(id)) {
            return res.status(400).json({ message: 'ID de mascota inválido' });
        }

        const { nombre, especie, raza, edad, sexo, peso, propietario, telefono, estado } = req.body;
        const dataUpdate = {};

        if (nombre !== undefined) {
            if (!isNonEmptyString(nombre)) return res.status(400).json({ message: 'El nombre no puede estar vacío.' });
            dataUpdate.nombre = nombre.trim();
        }

        if (especie !== undefined) {
            if (!isNonEmptyString(especie)) return res.status(400).json({ message: 'La especie no puede estar vacía.' });
            dataUpdate.especie = especie.trim();
        }

        if (raza !== undefined) dataUpdate.raza = raza ? raza.trim() : null;

        if (edad !== undefined) {
            if (edad !== null && edad !== '' && !isPositiveInteger(edad)) {
                return res.status(400).json({ message: 'La edad debe ser un número entero mayor a 0.' });
            }
            dataUpdate.edad = edad ? parseInt(edad) : null;
        }

        if (sexo !== undefined) dataUpdate.sexo = sexo ? sexo.trim() : null;

        if (peso !== undefined) {
            if (peso !== null && peso !== '' && !isPositiveNumber(peso)) {
                return res.status(400).json({ message: 'El peso debe ser mayor a 0.' });
            }
            dataUpdate.peso = peso ? parseFloat(peso) : null;
        }

        if (propietario !== undefined) {
            if (!isNonEmptyString(propietario)) return res.status(400).json({ message: 'El propietario no puede estar vacío.' });
            dataUpdate.propietario = propietario.trim();
        }

        if (telefono !== undefined) dataUpdate.telefono = telefono ? telefono.trim() : null;
        if (typeof estado === 'boolean') dataUpdate.estado = estado;

        const actualizada = await prisma.mascota.update({
            where: { id },
            data: dataUpdate
        });

        res.json({
            message: 'Mascota actualizada correctamente',
            mascota: actualizada
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getMascotas,
    getMascotaById,
    createMascota,
    updateMascota
};

