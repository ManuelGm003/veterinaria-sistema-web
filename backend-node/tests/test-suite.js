/**
 * SUITE DE VALIDACIÓN AUTOMATIZADA - VETSALUD
 * Ejecuta validaciones completas contra la base de datos de pruebas (Aiven MySQL)
 * Cubre: Login, Bloqueo de 3 intentos / 15 min con persistencia, RBAC por roles,
 * Entradas y ajustes de inventario, Ventas (suficiente/insuficiente), Lotes vencidos / de otro producto,
 * Recetas (activas, vencidas, utilizadas), Anulación y devolución de existencias, Anulación repetida,
 * Transacciones con reversión completa (Rollback), Concurrencia de ventas, Filtros de reportes,
 * y Modelos/Rutas de Mascotas e Historial Clínico.
 */

const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const app = require('../src/index');
const prisma = require('../src/config/prisma');

let server;
let baseUrl;
let tokenAdmin = '';
let tokenCajero = '';
let tokenBodeguero = '';

let adminUser, cajeroUser, bodegueroUser;

// Utilidad para peticiones HTTP
async function api(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    const res = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers
    });
    const text = await res.text();
    let body;
    try {
        body = JSON.parse(text);
    } catch {
        body = text;
    }
    return { status: res.status, ok: res.ok, body };
}

// Estadísticas de pruebas
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✓ PASS: ${message}`);
    } else {
        failedTests++;
        console.error(`  ✗ FAIL: ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    }
}

async function runAllTests() {
    console.log('===============================================================');
    console.log('   INICIANDO SUITE DE PRUEBAS AUTOMATIZADAS - SISTEMA VETSALUD');
    console.log('===============================================================\n');

    // Iniciar servidor temporal en puerto dinámico
    await new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}/api`;
            console.log(` Servidor de pruebas activo en: ${baseUrl}\n`);
            resolve();
        });
    });

    try {
        // =========================================================================
        // MÓDULO 1: PRUEBA DE LOGIN Y CONTROL DE ACCESO
        // =========================================================================
        console.log('--- GRUPO 1: Autenticación y Generación de JWT ---');

        // Resetear usuarios a estado limpio para pruebas
        await prisma.usuario.updateMany({
            data: { intentosFallidos: 0, bloqueadoHasta: null }
        });

        const resAdmin = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'admin@veterinaria.com', password: 'admin123' })
        });
        assert(resAdmin.status === 200 && resAdmin.body.token, 'Login exitoso de Administrador genera token JWT');
        tokenAdmin = resAdmin.body.token;
        adminUser = resAdmin.body.usuario;

        const resCajero = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'cajero@veterinaria.com', password: 'cajero123' })
        });
        assert(resCajero.status === 200 && resCajero.body.token, 'Login exitoso de Cajero genera token JWT');
        tokenCajero = resCajero.body.token;
        cajeroUser = resCajero.body.usuario;

        const resBodeguero = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'bodeguero@veterinaria.com', password: 'bodeguero123' })
        });
        assert(resBodeguero.status === 200 && resBodeguero.body.token, 'Login exitoso de Bodeguero genera token JWT');
        tokenBodeguero = resBodeguero.body.token;
        bodegueroUser = resBodeguero.body.usuario;

        // =========================================================================
        // MÓDULO 2: BLOQUEO TRAS 3 INTENTOS FALLIDOS (15 MINUTOS) Y PERSISTENCIA BD
        // =========================================================================
        console.log('\n--- GRUPO 2: Bloqueo de Login tras 3 Intentos Fallidos (Persistente) ---');

        // Usuario para prueba de bloqueo
        const testUserEmail = 'testlockout@veterinaria.com';
        const bcrypt = require('bcryptjs');
        const hashPass = await bcrypt.hash('clave123', 10);
        const uBloqueo = await prisma.usuario.upsert({
            where: { email: testUserEmail },
            update: { intentosFallidos: 0, bloqueadoHasta: null },
            create: {
                nombre: 'Usuario Prueba Bloqueo',
                email: testUserEmail,
                password: hashPass,
                rolId: 2,
                estado: true,
                intentosFallidos: 0
            }
        });

        // Intento 1 fallido
        const f1 = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: testUserEmail, password: 'wrongpassword' })
        });
        assert(f1.status === 401 && f1.body.intentosRestantes === 2, 'Intento fallido 1 retorna 401 y restan 2 intentos');

        // Intento 2 fallido
        const f2 = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: testUserEmail, password: 'wrongpassword' })
        });
        assert(f2.status === 401 && f2.body.intentosRestantes === 1, 'Intento fallido 2 retorna 401 y resta 1 intento');

        // Intento 3 fallido -> Bloqueo
        const f3 = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: testUserEmail, password: 'wrongpassword' })
        });
        assert(f3.status === 429 && f3.body.bloqueado === true, 'Intento fallido 3 activa bloqueo temporal con código HTTP 429');

        // Verificar directamente en la base de datos que se persistió el bloqueo
        const checkDb = await prisma.usuario.findUnique({ where: { email: testUserEmail } });
        assert(checkDb.intentosFallidos >= 3, 'El contador de intentos fallidos (>=3) está persistido en MySQL');
        assert(checkDb.bloqueadoHasta !== null && new Date(checkDb.bloqueadoHasta) > new Date(), 'La fecha de bloqueo (15 minutos en el futuro) está persistida en MySQL');

        // Intento 4 con contraseña CORRECTA mientras está bloqueado -> debe ser RECHAZADO
        const f4 = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: testUserEmail, password: 'clave123' })
        });
        assert(f4.status === 429 && f4.body.bloqueado === true, 'Intento con contraseña correcta mientras está bloqueado es RECHAZADO con 429');

        // Limpiar usuario de prueba de bloqueo
        await prisma.usuario.update({
            where: { email: testUserEmail },
            data: { intentosFallidos: 0, bloqueadoHasta: null }
        });

        // =========================================================================
        // MÓDULO 3: CONTROL DE ACCESO BASADO EN ROLES (RBAC) EN BACKEND
        // =========================================================================
        console.log('\n--- GRUPO 3: Control de Permisos y Roles (RBAC) Backend ---');

        // Cajero intenta acceder a Usuarios -> 403
        const cajeroUsers = await api('/usuarios', {
            headers: { 'Authorization': `Bearer ${tokenCajero}` }
        });
        assert(cajeroUsers.status === 403, 'Cajero tiene prohibido (403) acceder al módulo de Usuarios');

        // Cajero intenta registrar entrada de inventario -> 403
        const cajeroEntrada = await api('/inventario/entradas', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenCajero}` },
            body: JSON.stringify({ productos: [] })
        });
        assert(cajeroEntrada.status === 403, 'Cajero tiene prohibido (403) registrar entradas de inventario');

        // Cajero intenta ver reporte financiero de ventas -> 403
        const cajeroRepVentas = await api('/reportes/ventas', {
            headers: { 'Authorization': `Bearer ${tokenCajero}` }
        });
        assert(cajeroRepVentas.status === 403, 'Cajero tiene prohibido (403) acceder a Reportes Financieros de Ventas');

        // Cajero intenta modificar configuración de la clínica -> 403
        const cajeroConfig = await api('/configuracion', {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${tokenCajero}` },
            body: JSON.stringify({ nombreVeterinaria: 'Hacked' })
        });
        assert(cajeroConfig.status === 403, 'Cajero tiene prohibido (403) actualizar Configuración del sistema');

        // Bodeguero intenta registrar venta POS -> 403
        const bodegueroVenta = await api('/ventas', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenBodeguero}` },
            body: JSON.stringify({ detalles: [] })
        });
        assert(bodegueroVenta.status === 403, 'Bodeguero tiene prohibido (403) registrar ventas en POS');

        // Bodeguero intenta acceder a Usuarios -> 403
        const bodegueroUsers = await api('/usuarios', {
            headers: { 'Authorization': `Bearer ${tokenBodeguero}` }
        });
        assert(bodegueroUsers.status === 403, 'Bodeguero tiene prohibido (403) acceder a Usuarios');

        // Petición anónima sin token -> 401
        const anonReq = await api('/productos');
        assert(anonReq.status === 401, 'Petición sin token de autenticación es rechazada con HTTP 401');

        // Admin tiene acceso permitido a Usuarios
        const adminUsers = await api('/usuarios', {
            headers: { 'Authorization': `Bearer ${tokenAdmin}` }
        });
        assert(adminUsers.status === 200 && Array.isArray(adminUsers.body), 'Administrador tiene acceso total a Usuarios (200 OK)');

        // =========================================================================
        // MÓDULO 4: ENTRADAS Y AJUSTES DE INVENTARIO
        // =========================================================================
        console.log('\n--- GRUPO 4: Entradas y Ajustes de Inventario ---');

        const catGeneral = await prisma.categoria.findFirst();
        const provGeneral = await prisma.proveedor.findFirst();

        // 1. Crear producto base para pruebas de inventario
        const prodTestInv = await prisma.producto.create({
            data: {
                nombre: 'Producto Test Inventario ' + Date.now(),
                tipo: 'Accesorio',
                requierePrescripcion: false,
                idCategoria: catGeneral.id,
                idProveedor: provGeneral.id,
                precioCompra: 50.00,
                precioVenta: 100.00,
                stockMinimo: 5,
                estado: true
            }
        });

        // 2. Registrar Entrada de Inventario (Bodeguero)
        const fechaFutura = new Date();
        fechaFutura.setFullYear(fechaFutura.getFullYear() + 1);

        const resEntrada = await api('/inventario/entradas', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenBodeguero}` },
            body: JSON.stringify({
                idProveedor: provGeneral.id,
                observaciones: 'Entrada de prueba automatizada',
                productos: [{
                    idProducto: prodTestInv.id,
                    cantidad: 20,
                    precioCompra: 50.00,
                    precioVenta: 100.00,
                    numeroLote: 'LOTE-TEST-01',
                    fechaVencimiento: fechaFutura.toISOString().split('T')[0]
                }]
            })
        });
        assert(resEntrada.status === 201, 'Bodeguero registra entrada de inventario exitosamente (201 Created)');

        // Verificar que el lote fue creado con cantidad 20
        const loteCreado = await prisma.lote.findFirst({
            where: { idProducto: prodTestInv.id, numeroLote: 'LOTE-TEST-01' }
        });
        assert(loteCreado && loteCreado.cantidad === 20, 'Lote creado con stock inicial exacto de 20 unidades');

        // 3. Ajuste de Inventario (Merma de 5 unidades -> nueva cantidad 15)
        const resAjuste = await api(`/inventario/lotes/${loteCreado.id}/ajuste`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${tokenBodeguero}` },
            body: JSON.stringify({
                nuevaCantidad: 15,
                motivo: 'Ajuste por frasco roto durante inspección'
            })
        });
        assert(resAjuste.status === 200 && resAjuste.body.lote.cantidad === 15, 'Ajuste de lote por merma actualiza stock a 15');

        // =========================================================================
        // MÓDULO 5: VENTAS (STOCK SUFICIENTE / INSUFICIENTE / LOTES VENCIDOS / OTRO PRODUCTO)
        // =========================================================================
        console.log('\n--- GRUPO 5: Ventas POS, Lotes Vencidos y Validación Estricta ---');

        // 1. Venta exitosa con stock suficiente
        const resVentaOk = await api('/ventas', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenCajero}` },
            body: JSON.stringify({
                cliente: 'Cliente Prueba 1',
                metodoPago: 'Efectivo',
                detalles: [{
                    idProducto: prodTestInv.id,
                    idLote: loteCreado.id,
                    cantidad: 5,
                    precioUnitario: 100.00
                }]
            })
        });
        assert(resVentaOk.status === 201, 'Venta con stock suficiente registrada exitosamente (201)');

        // Verificar descuento de stock (15 - 5 = 10)
        const loteDescontado = await prisma.lote.findUnique({ where: { id: loteCreado.id } });
        assert(loteDescontado.cantidad === 10, 'Stock de lote descontado correctamente a 10 unidades');

        // 2. Venta con stock INSUFICIENTE (solicitar 50 cuando quedan 10)
        const resVentaInsuf = await api('/ventas', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenCajero}` },
            body: JSON.stringify({
                cliente: 'Cliente Sobreventa',
                metodoPago: 'Efectivo',
                detalles: [{
                    idProducto: prodTestInv.id,
                    idLote: loteCreado.id,
                    cantidad: 50,
                    precioUnitario: 100.00
                }]
            })
        });
        assert(resVentaInsuf.status === 400, 'Venta con stock insuficiente es RECHAZADA (400 Bad Request)');
        const loteSinCambio = await prisma.lote.findUnique({ where: { id: loteCreado.id } });
        assert(loteSinCambio.cantidad === 10, 'El stock permanece inalterado tras rechazo por falta de existencias');

        // 3. Crear LOTE VENCIDO para probar rechazo
        const fechaPasada = new Date();
        fechaPasada.setDate(fechaPasada.getDate() - 15); // venció hace 15 días
        const loteVencido = await prisma.lote.create({
            data: {
                idProducto: prodTestInv.id,
                numeroLote: 'LOTE-CADUCADO-99',
                fechaVencimiento: fechaPasada,
                cantidad: 10,
                estadoDisponible: true
            }
        });

        const resVentaVencida = await api('/ventas', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenCajero}` },
            body: JSON.stringify({
                cliente: 'Cliente Lote Vencido',
                metodoPago: 'Efectivo',
                detalles: [{
                    idProducto: prodTestInv.id,
                    idLote: loteVencido.id,
                    cantidad: 1,
                    precioUnitario: 100.00
                }]
            })
        });
        assert(resVentaVencida.status === 400 && resVentaVencida.body.error.includes('vencido'), 'Venta de lote caducado es RECHAZADA con mensaje de caducidad');

        // 4. Lote de OTRO PRODUCTO
        const otroProducto = await prisma.producto.create({
            data: {
                nombre: 'Otro Producto Distinto ' + Date.now(),
                tipo: 'Alimento',
                requierePrescripcion: false,
                idCategoria: catGeneral.id,
                precioCompra: 30.00,
                precioVenta: 60.00,
                stockMinimo: 2,
                estado: true
            }
        });

        const resVentaLoteCruzado = await api('/ventas', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenCajero}` },
            body: JSON.stringify({
                cliente: 'Cliente Fraude Lote',
                metodoPago: 'Efectivo',
                detalles: [{
                    idProducto: otroProducto.id,
                    idLote: loteCreado.id, // pertenece a prodTestInv, no a otroProducto
                    cantidad: 1,
                    precioUnitario: 60.00
                }]
            })
        });
        assert(resVentaLoteCruzado.status === 400 && resVentaLoteCruzado.body.error.includes('no pertenece'), 'Venta con lote de otro producto es RECHAZADA de inmediato');

        // =========================================================================
        // MÓDULO 6: CONTROL DE RECETAS (ACTIVAS / VENCIDAS / UTILIZADAS)
        // =========================================================================
        console.log('\n--- GRUPO 6: Control Estricto de Recetas Médicas ---');

        // 1. Producto que REQUIERE receta
        const prodFarmaco = await prisma.producto.create({
            data: {
                nombre: 'Fármaco Controlado Test ' + Date.now(),
                tipo: 'Medicamento',
                requierePrescripcion: true,
                idCategoria: catGeneral.id,
                precioCompra: 80.00,
                precioVenta: 150.00,
                stockMinimo: 2,
                estado: true
            }
        });

        const loteFarmaco = await prisma.lote.create({
            data: {
                idProducto: prodFarmaco.id,
                numeroLote: 'L-FARM-01',
                fechaVencimiento: fechaFutura,
                cantidad: 20,
                estadoDisponible: true
            }
        });

        // Intentar vender medicamento controlado SIN RECETA -> 400
        const resVentaSinReceta = await api('/ventas', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenCajero}` },
            body: JSON.stringify({
                cliente: 'Cliente Sin Receta',
                metodoPago: 'Efectivo',
                detalles: [{
                    idProducto: prodFarmaco.id,
                    idLote: loteFarmaco.id,
                    cantidad: 1,
                    precioUnitario: 150.00
                }]
            })
        });
        assert(resVentaSinReceta.status === 400 && resVentaSinReceta.body.requierePrescripcion === true, 'Venta de fármaco controlado sin receta es BLOQUEADA');

        // Crear Receta ACTIVA
        const codRecetaActiva = 'REC-TEST-ACT-' + Date.now();
        const recetaActiva = await prisma.prescripcion.create({
            data: {
                numero: codRecetaActiva,
                cliente: 'Tutor Paciente Test',
                veterinario: 'Dr. Veterinario Test',
                fecha: new Date(),
                fechaVencimiento: fechaFutura,
                estado: 'Activa'
            }
        });

        // Validar receta activa en endpoint de validación
        const valReceta = await api(`/prescripciones/validar/${codRecetaActiva}`, {
            headers: { 'Authorization': `Bearer ${tokenCajero}` }
        });
        assert(valReceta.status === 200 && valReceta.body.valido === true, 'Validación de prescripción activa autorizada (200 OK)');

        // Venta con la receta activa -> éxito y receta pasa a 'Utilizada'
        const resVentaConReceta = await api('/ventas', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenCajero}` },
            body: JSON.stringify({
                cliente: 'Tutor Paciente Test',
                codigoPrescripcion: codRecetaActiva,
                metodoPago: 'Efectivo',
                detalles: [{
                    idProducto: prodFarmaco.id,
                    idLote: loteFarmaco.id,
                    cantidad: 2,
                    precioUnitario: 150.00
                }]
            })
        });
        assert(resVentaConReceta.status === 201, 'Venta con receta activa autorizada y procesada');

        const recetaUtilizadaDb = await prisma.prescripcion.findUnique({ where: { id: recetaActiva.id } });
        assert(recetaUtilizadaDb.estado === 'Utilizada', 'Estado de la receta cambia automáticamente a "Utilizada"');

        // Reintentar vender con la misma receta (YA UTILIZADA) -> 400
        const resVentaRecetaUsada = await api('/ventas', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenCajero}` },
            body: JSON.stringify({
                cliente: 'Reintento Receta Usada',
                codigoPrescripcion: codRecetaActiva,
                metodoPago: 'Efectivo',
                detalles: [{
                    idProducto: prodFarmaco.id,
                    idLote: loteFarmaco.id,
                    cantidad: 1,
                    precioUnitario: 150.00
                }]
            })
        });
        assert(resVentaRecetaUsada.status === 400 && resVentaRecetaUsada.body.error === 'Prescripción utilizada', 'Venta con receta ya utilizada es RECHAZADA');

        // Crear Receta VENCIDA
        const codRecetaVencida = 'REC-TEST-VENC-' + Date.now();
        await prisma.prescripcion.create({
            data: {
                numero: codRecetaVencida,
                cliente: 'Tutor Paciente Vencida',
                veterinario: 'Dr. Veterinario Test',
                fecha: new Date(Date.now() - 40 * 24 * 3600 * 1000),
                fechaVencimiento: fechaPasada,
                estado: 'Vencida'
            }
        });

        const resVentaRecetaVencida = await api('/ventas', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenCajero}` },
            body: JSON.stringify({
                cliente: 'Tutor Paciente Vencida',
                codigoPrescripcion: codRecetaVencida,
                metodoPago: 'Efectivo',
                detalles: [{
                    idProducto: prodFarmaco.id,
                    idLote: loteFarmaco.id,
                    cantidad: 1,
                    precioUnitario: 150.00
                }]
            })
        });
        assert(resVentaRecetaVencida.status === 400 && resVentaRecetaVencida.body.error === 'Prescripción vencida', 'Venta con receta vencida es RECHAZADA');

        // =========================================================================
        // MÓDULO 7: ANULACIÓN DE VENTAS, DEVOLUCIÓN DE EXISTENCIAS Y ANULACIÓN REPETIDA
        // =========================================================================
        console.log('\n--- GRUPO 7: Anulación de Venta y Devolución de Stock ---');

        const ventaIdAnular = resVentaConReceta.body.venta.id;
        const stockAntesDeAnular = (await prisma.lote.findUnique({ where: { id: loteFarmaco.id } })).cantidad;

        // 1. Primera anulación (debe devolver las 2 unidades vendidas)
        const resAnular1 = await api(`/ventas/${ventaIdAnular}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${tokenAdmin}` }
        });
        assert(resAnular1.status === 200, 'Venta anulada exitosamente por Administrador (200 OK)');

        const stockDespuesDeAnular = (await prisma.lote.findUnique({ where: { id: loteFarmaco.id } })).cantidad;
        assert(stockDespuesDeAnular === stockAntesDeAnular + 2, 'Existencias devueltas correctamente al lote tras anulación (+2 unidades)');

        const ventaDbAnulada = await prisma.venta.findUnique({ where: { id: ventaIdAnular } });
        assert(ventaDbAnulada.estado === 'Anulada', 'Estado de la venta actualizado a "Anulada"');

        // 2. Anulación repetida sobre la misma venta -> debe ser RECHAZADA
        const resAnular2 = await api(`/ventas/${ventaIdAnular}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${tokenAdmin}` }
        });
        assert(resAnular2.status === 400 && resAnular2.body.error.includes('previamente'), 'Anulación repetida es RECHAZADA con mensaje descriptivo');

        // =========================================================================
        // MÓDULO 8: REVERSIÓN COMPLETA DE TRANSACCIONES (ROLLBACK)
        // =========================================================================
        console.log('\n--- GRUPO 8: Integridad Transaccional y Rollback ante Fallos ---');

        // Crear una venta con 2 ítems:
        // Ítem 1: Válido (5 unidades disponibles)
        // Ítem 2: Inválido (pide 999 unidades, falla)
        const stockItem1Antes = (await prisma.lote.findUnique({ where: { id: loteCreado.id } })).cantidad;

        const resVentaFallida = await api('/ventas', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenCajero}` },
            body: JSON.stringify({
                cliente: 'Cliente Transacción Fallida',
                metodoPago: 'Efectivo',
                detalles: [
                    {
                        idProducto: prodTestInv.id,
                        idLote: loteCreado.id,
                        cantidad: 2,
                        precioUnitario: 100.00
                    },
                    {
                        idProducto: prodTestInv.id,
                        idLote: loteCreado.id,
                        cantidad: 9999, // provocará fallo en el segundo ítem
                        precioUnitario: 100.00
                    }
                ]
            })
        });

        assert(resVentaFallida.status === 400, 'Transacción multilínea falla por insuficiencia en ítem 2');
        const stockItem1Despues = (await prisma.lote.findUnique({ where: { id: loteCreado.id } })).cantidad;
        assert(stockItem1Despues === stockItem1Antes, 'ROLLBACK completo: El stock del ítem 1 no sufrió descuentos parciales');

        // =========================================================================
        // MÓDULO 9: CONTROL DE CONCURRENCIA EN VENTAS
        // =========================================================================
        console.log('\n--- GRUPO 9: Concurrencia de Ventas y Bloqueo de Sobreventas ---');

        // Crear un lote con exactamente 3 unidades
        const loteConcurrente = await prisma.lote.create({
            data: {
                idProducto: prodTestInv.id,
                numeroLote: 'L-CONC-' + Date.now(),
                fechaVencimiento: fechaFutura,
                cantidad: 3,
                estadoDisponible: true
            }
        });

        // Lanzar 2 ventas simultáneas en paralelo pidiendo 2 unidades cada una (Total solicitado: 4, disponible: 3)
        // Concurrencia estricta: solo UNA venta debe tener éxito y la otra DEBE fallar
        const payloadVentaConc = JSON.stringify({
            cliente: 'Cliente Concurrente',
            metodoPago: 'Efectivo',
            detalles: [{
                idProducto: prodTestInv.id,
                idLote: loteConcurrente.id,
                cantidad: 2,
                precioUnitario: 100.00
            }]
        });

        const [v1, v2] = await Promise.all([
            api('/ventas', { method: 'POST', headers: { 'Authorization': `Bearer ${tokenCajero}` }, body: payloadVentaConc }),
            api('/ventas', { method: 'POST', headers: { 'Authorization': `Bearer ${tokenCajero}` }, body: payloadVentaConc })
        ]);

        const exitosas = [v1, v2].filter(v => v.status === 201).length;
        const fallidas = [v1, v2].filter(v => v.status === 400).length;

        assert(exitosas === 1 && fallidas === 1, 'Control de concurrencia: Exactamente 1 venta triunfó y 1 falló por sobreventa');

        const stockFinalConc = (await prisma.lote.findUnique({ where: { id: loteConcurrente.id } })).cantidad;
        assert(stockFinalConc === 1, 'Stock final del lote es exactamente 1 (3 - 2 = 1, sin descuentos dobles)');

        // =========================================================================
        // MÓDULO 10: REPORTES Y FILTROS FINANCIEROS
        // =========================================================================
        console.log('\n--- GRUPO 10: Reportes y Filtros de Ventas e Inventario ---');

        // 1. Reporte de ventas filtrado por método de pago
        const repEfectivo = await api('/reportes/ventas?metodoPago=Efectivo', {
            headers: { 'Authorization': `Bearer ${tokenAdmin}` }
        });
        assert(repEfectivo.status === 200, 'Reporte de ventas filtrado por método de pago responde 200 OK');
        assert(repEfectivo.body.resumen && typeof repEfectivo.body.resumen.totalRecaudado === 'number', 'Resumen financiero calculado con totalRecaudado');

        // 2. Reporte de inventario
        const repInv = await api('/reportes/inventario', {
            headers: { 'Authorization': `Bearer ${tokenAdmin}` }
        });
        assert(repInv.status === 200, 'Reporte de valoración de existencias responde 200 OK');
        assert(repInv.body.resumen.valorTotalCosto > 0 && repInv.body.resumen.valorTotalVenta > 0, 'Valoración de costo y venta proyectada calculadas correctamente');
        assert(repInv.body.resumen.margenGananciaEstimado > 0, 'Margen de ganancia estimado proyectado exitosamente');

        // =========================================================================
        // MÓDULO 11: MASCOTAS E HISTORIAL CLÍNICO CON RELACIONES REALES
        // =========================================================================
        console.log('\n--- GRUPO 11: Modelos y Rutas de Mascotas e Historial Clínico ---');

        // 1. Registrar Mascota real
        const resMascota = await api('/mascotas', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenAdmin}` },
            body: JSON.stringify({
                nombre: 'Rocky Test',
                especie: 'Canino',
                raza: 'Pastor Alemán',
                edad: 3,
                sexo: 'Macho',
                peso: 28.50,
                propietario: 'Roberto Gómez',
                telefono: '+505 8765-4321'
            })
        });
        assert(resMascota.status === 201 && resMascota.body.mascota.id, 'Mascota registrada con éxito en modelo Mascota');
        const mascotaId = resMascota.body.mascota.id;

        // 2. Registrar Historial Clínico vinculado por FK a la Mascota real
        const resHist = await api('/historial', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenAdmin}` },
            body: JSON.stringify({
                mascotaId: mascotaId,
                veterinario: 'Dra. María Morales',
                diagnostico: 'Dermatitis atópica alérgica',
                tratamiento: 'Antihistamínico y baño medicado con shampoo especial',
                peso: 28.50
            })
        });
        assert(resHist.status === 201 && resHist.body.nuevoHistorial.mascotaId === mascotaId, 'Historial clínico creado con clave foránea real vinculada a Mascota');

        // 3. Consultar Historial de la Mascota
        const resHistList = await api(`/historial/mascota/${mascotaId}`, {
            headers: { 'Authorization': `Bearer ${tokenAdmin}` }
        });
        assert(resHistList.status === 200 && resHistList.body.length >= 1, 'Consulta de historial clínico de la mascota retorna los registros');
        assert(resHistList.body[0].mascota.nombre === 'Rocky Test', 'Relación Prisma de Historial -> Mascota resuelta correctamente');

        // 4. Intentar crear historial con ID de mascota inexistente -> 404
        const resHistInexistente = await api('/historial', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenAdmin}` },
            body: JSON.stringify({
                mascotaId: 999999,
                veterinario: 'Dr. Test',
                diagnostico: 'Test'
            })
        });
        assert(resHistInexistente.status === 404, 'Crear historial con mascota inexistente rechaza con 404 (No simula IDs)');

        // 5. Vincular Prescripción a la Mascota real y consultar prescripciones por mascota
        const codRecetaMascota = 'REC-MASCOTA-' + Date.now();
        await api('/prescripciones', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenAdmin}` },
            body: JSON.stringify({
                numero: codRecetaMascota,
                cliente: 'Roberto Gómez',
                veterinario: 'Dra. María Morales',
                mascotaId: mascotaId,
                detalles: [{
                    idProducto: prodFarmaco.id,
                    cantidad: 1,
                    indicaciones: 'Aplicar según indicación médica'
                }]
            })
        });

        const resPrescMascota = await api(`/prescripciones/mascota/${mascotaId}`, {
            headers: { 'Authorization': `Bearer ${tokenCajero}` }
        });
        assert(resPrescMascota.status === 200 && resPrescMascota.body.length >= 1, 'Prescripciones de la mascota consultadas exitosamente mediante clave foránea');

        // =========================================================================
        // RESUMEN FINAL
        // =========================================================================
        console.log('\n===============================================================');
        console.log(` RESULTADOS FINALES DE LA SUITE:`);
        console.log(` Total de pruebas ejecutadas: ${totalTests}`);
        console.log(` Pruebas superadas (PASS):   ${passedTests}`);
        console.log(` Pruebas fallidas (FAIL):     ${failedTests}`);
        console.log('===============================================================\n');

    } catch (err) {
        console.error('\n❌ ERROR INESPERADO DURANTE LA EJECUCIÓN DE PRUEBAS:\n', err);
        process.exitCode = 1;
    } finally {
        if (server) {
            server.close();
        }
        await prisma.$disconnect();
        process.exit(process.exitCode || 0);
    }
}

runAllTests();
