const prisma = require('./prismaClient');
const bcrypt = require('bcryptjs');

async function main() {
  console.log('🌱 Iniciando carga de datos iniciales (Seed)...');

  // 1. Roles
  const rolAdmin = await prisma.rol.upsert({
    where: { nombre: 'Administrador' },
    update: {},
    create: {
      nombre: 'Administrador',
      descripcion: 'Acceso total y control administrativo del sistema'
    }
  });

  const rolCajero = await prisma.rol.upsert({
    where: { nombre: 'Cajero' },
    update: {},
    create: {
      nombre: 'Cajero',
      descripcion: 'Registro de ventas POS, validación de recetas y emisión de tickets'
    }
  });

  const rolBodeguero = await prisma.rol.upsert({
    where: { nombre: 'Bodeguero' },
    update: {},
    create: {
      nombre: 'Bodeguero',
      descripcion: 'Gestión de productos, lotes, entradas y ajustes de inventario'
    }
  });

  console.log('✓ Roles creados/verificados');

  // 2. Usuarios
  const hashAdmin = await bcrypt.hash('admin123', 10);
  const hashCajero = await bcrypt.hash('cajero123', 10);
  const hashBodeguero = await bcrypt.hash('bodeguero123', 10);

  await prisma.usuario.upsert({
    where: { email: 'admin@veterinaria.com' },
    update: {},
    create: {
      nombre: 'Manuel Gutiérrez (Administrador)',
      email: 'admin@veterinaria.com',
      password: hashAdmin,
      rolId: rolAdmin.id,
      estado: true
    }
  });

  await prisma.usuario.upsert({
    where: { email: 'cajero@veterinaria.com' },
    update: {},
    create: {
      nombre: 'Jonathan Flores (Cajero)',
      email: 'cajero@veterinaria.com',
      password: hashCajero,
      rolId: rolCajero.id,
      estado: true
    }
  });

  await prisma.usuario.upsert({
    where: { email: 'bodeguero@veterinaria.com' },
    update: {},
    create: {
      nombre: 'Jean Delgadillo (Bodeguero)',
      email: 'bodeguero@veterinaria.com',
      password: hashBodeguero,
      rolId: rolBodeguero.id,
      estado: true
    }
  });

  console.log('✓ Usuarios creados (admin, cajero, bodeguero)');

  // 3. Categorías
  const catAntibioticos = await prisma.categoria.upsert({
    where: { nombre: 'Antibióticos' },
    update: {},
    create: { nombre: 'Antibióticos', descripcion: 'Medicamentos antimicrobianos bajo receta' }
  });

  const catMedicamentos = await prisma.categoria.upsert({
    where: { nombre: 'Medicamentos' },
    update: {},
    create: { nombre: 'Medicamentos', descripcion: 'Tratamientos terapéuticos generales' }
  });

  const catAlimentos = await prisma.categoria.upsert({
    where: { nombre: 'Alimentos' },
    update: {},
    create: { nombre: 'Alimentos', descripcion: 'Alimentos balanceados y dietas especiales' }
  });

  const catAntiparasitarios = await prisma.categoria.upsert({
    where: { nombre: 'Antiparasitarios' },
    update: {},
    create: { nombre: 'Antiparasitarios', descripcion: 'Pipetas, tabletas y desparasitantes' }
  });

  const catAccesorios = await prisma.categoria.upsert({
    where: { nombre: 'Accesorios y Cuidado' },
    update: {},
    create: { nombre: 'Accesorios y Cuidado', descripcion: 'Shampoos, collares y artículos de higiene' }
  });

  // 4. Proveedores
  let provFarma = await prisma.proveedor.findFirst({ where: { nombre: 'Distribuidora FarmaVet S.A.' } });
  if (!provFarma) {
    provFarma = await prisma.proveedor.create({
      data: {
        nombre: 'Distribuidora FarmaVet S.A.',
        telefono: '+505 2278-1122',
        email: 'ventas@farmavet.com',
        direccion: 'Km 5 Carretera Norte, Managua'
      }
    });
  }

  let provNutri = await prisma.proveedor.findFirst({ where: { nombre: 'NutriPet Distribuciones' } });
  if (!provNutri) {
    provNutri = await prisma.proveedor.create({
      data: {
        nombre: 'NutriPet Distribuciones',
        telefono: '+505 2255-9988',
        email: 'pedidos@nutripet.com',
        direccion: 'Altamira D’Este, Calle Principal'
      }
    });
  }

  // 5. Productos y Lotes
  const productosData = [
    {
      codigo: 'P-001',
      nombre: 'Antipulgas Canino Bravecto',
      descripcion: 'Comprimido masticable para perros contra pulgas y garrapatas',
      tipo: 'Medicamento',
      requierePrescripcion: false,
      categoriaId: catAntiparasitarios.id,
      proveedorId: provFarma.id,
      precioCompra: 550.00,
      precioVenta: 850.00,
      stockMinimo: 5,
      lote: { numero: 'L-4587', diasVence: 180, cantidad: 14 }
    },
    {
      codigo: 'M-102',
      nombre: 'Amoxicilina 250mg',
      descripcion: 'Antibiótico de amplio espectro para caninos y felinos',
      tipo: 'Medicamento',
      requierePrescripcion: true,
      categoriaId: catAntibioticos.id,
      proveedorId: provFarma.id,
      precioCompra: 15.00,
      precioVenta: 25.00,
      stockMinimo: 10,
      lote: { numero: 'L-12', diasVence: 5, cantidad: 45 } // Alerta vencimiento crítico
    },
    {
      codigo: 'M-103',
      nombre: 'Ketamina Solución Inyectable',
      descripcion: 'Anestésico disociativo de uso veterinario controlado',
      tipo: 'Medicamento',
      requierePrescripcion: true,
      categoriaId: catMedicamentos.id,
      proveedorId: provFarma.id,
      precioCompra: 30.00,
      precioVenta: 55.00,
      stockMinimo: 5,
      lote: { numero: 'L-08', diasVence: 18, cantidad: 3 } // Alerta stock bajo
    },
    {
      codigo: 'A-201',
      nombre: 'Alimento Royal Canin Medium Adult',
      descripcion: 'Bolsa de 15 Kg formulada para perros de talla mediana',
      tipo: 'Alimento',
      requierePrescripcion: false,
      categoriaId: catAlimentos.id,
      proveedorId: provNutri.id,
      precioCompra: 420.00,
      precioVenta: 640.00,
      stockMinimo: 6,
      lote: { numero: 'L-1256', diasVence: 240, cantidad: 20 }
    },
    {
      codigo: 'M-104',
      nombre: 'Meloxicam 2mg Tabletas',
      descripcion: 'Antiinflamatorio no esteroideo para afecciones musculoesqueléticas',
      tipo: 'Medicamento',
      requierePrescripcion: true,
      categoriaId: catMedicamentos.id,
      proveedorId: provFarma.id,
      precioCompra: 90.00,
      precioVenta: 150.00,
      stockMinimo: 8,
      lote: { numero: 'L-7890', diasVence: 90, cantidad: 12 }
    },
    {
      codigo: 'H-301',
      nombre: 'Shampoo Antipulgas y Garrapatas',
      descripcion: 'Fórmula suave con extracto de neem y citronela 500ml',
      tipo: 'Otro',
      requierePrescripcion: false,
      categoriaId: catAccesorios.id,
      proveedorId: provNutri.id,
      precioCompra: 80.00,
      precioVenta: 120.00,
      stockMinimo: 15,
      lote: { numero: 'L-45', diasVence: 365, cantidad: 120 }
    },
    {
      codigo: 'VAC-001',
      nombre: 'Vacuna Antirrábica Rabisin',
      descripcion: 'Inmunización activa contra el virus de la rabia',
      tipo: 'Medicamento',
      requierePrescripcion: true,
      categoriaId: catMedicamentos.id,
      proveedorId: provFarma.id,
      precioCompra: 40.00,
      precioVenta: 75.00,
      stockMinimo: 6,
      lote: { numero: 'L-A12', diasVence: 10, cantidad: 2 } // Stock bajo y próximo a vencer
    }
  ];

  for (const item of productosData) {
    let prod = await prisma.producto.findFirst({ where: { codigoBarras: item.codigo } });
    if (!prod) {
      prod = await prisma.producto.create({
        data: {
          nombre: item.nombre,
          descripcion: item.descripcion,
          tipo: item.tipo,
          requierePrescripcion: item.requierePrescripcion,
          idCategoria: item.categoriaId,
          idProveedor: item.proveedorId,
          codigoBarras: item.codigo,
          precioCompra: item.precioCompra,
          precioVenta: item.precioVenta,
          stockMinimo: item.stockMinimo,
          estado: true
        }
      });

      // Crear lote correspondiente
      const fechaVence = new Date();
      fechaVence.setDate(fechaVence.getDate() + item.lote.diasVence);

      await prisma.lote.create({
        data: {
          idProducto: prod.id,
          numeroLote: item.lote.numero,
          fechaVencimiento: fechaVence,
          cantidad: item.lote.cantidad,
          estadoDisponible: item.lote.cantidad > 0
        }
      });
    }
  }
  console.log('✓ Productos y Lotes inicializados con éxito');

  // 6. Prescripciones Médicas de Prueba (RF-13)
  const amox = await prisma.producto.findFirst({ where: { codigoBarras: 'M-102' } });
  const keta = await prisma.producto.findFirst({ where: { codigoBarras: 'M-103' } });

  const prescripcion1 = await prisma.prescripcion.upsert({
    where: { numero: 'REC-892' },
    update: {},
    create: {
      numero: 'REC-892',
      cliente: 'Manuel Gutiérrez',
      veterinario: 'Dr. Carlos Mora (Col. Med. #4521)',
      observaciones: 'Tratamiento por cuadro respiratorio agudo en paciente canino Golden Retriever 4 años',
      estado: 'Activa'
    }
  });

  if (amox) {
    const existingDet = await prisma.detallePrescripcion.findFirst({
      where: { idPrescripcion: prescripcion1.id, idProducto: amox.id }
    });
    if (!existingDet) {
      await prisma.detallePrescripcion.create({
        data: {
          idPrescripcion: prescripcion1.id,
          idProducto: amox.id,
          cantidad: 2,
          indicaciones: 'Administrar 1 cápsula cada 12 horas por 7 días junto con alimento'
        }
      });
    }
  }

  const prescripcion2 = await prisma.prescripcion.upsert({
    where: { numero: 'REC-101' },
    update: {},
    create: {
      numero: 'REC-101',
      cliente: 'Ana Martínez',
      veterinario: 'Dra. Elena Ruiz (Col. Med. #3190)',
      observaciones: 'Procedimiento de sedación menor para limpieza dental en felino',
      estado: 'Activa'
    }
  });

  if (keta) {
    const existingDet2 = await prisma.detallePrescripcion.findFirst({
      where: { idPrescripcion: prescripcion2.id, idProducto: keta.id }
    });
    if (!existingDet2) {
      await prisma.detallePrescripcion.create({
        data: {
          idPrescripcion: prescripcion2.id,
          idProducto: keta.id,
          cantidad: 1,
          indicaciones: 'Aplicación estricta en quirófano veterinario'
        }
      });
    }
  }

  console.log('✓ Prescripciones médicas creadas (REC-892, REC-101)');

  // 7. Configuración General de la Veterinaria
  const config = await prisma.configuracion.findFirst();
  if (!config) {
    await prisma.configuracion.create({
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
    console.log('✓ Configuración del sistema creada');
  }

  // 8. Registro de ventas de ejemplo
  const countVentas = await prisma.venta.count();
  if (countVentas === 0) {
    const userAdmin = await prisma.usuario.findFirst({ where: { email: 'admin@veterinaria.com' } });
    const prodBravecto = await prisma.producto.findFirst({ where: { codigoBarras: 'P-001' } });
    const loteBravecto = await prisma.lote.findFirst({ where: { idProducto: prodBravecto?.id } });

    if (prodBravecto && loteBravecto && userAdmin) {
      await prisma.venta.create({
        data: {
          idUsuario: userAdmin.id,
          cliente: 'Carlos Mendoza',
          total: 850.00,
          descuento: 0.00,
          metodoPago: 'Efectivo',
          estado: 'Completada',
          detalles: {
            create: {
              idProducto: prodBravecto.id,
              idLote: loteBravecto.id,
              cantidad: 1,
              precioUnitario: 850.00,
              subtotal: 850.00
            }
          }
        }
      });
      console.log('✓ Venta de prueba registrada');
    }
  }

  console.log('🚀 Base de datos inicializada completamente.');
}

main()
  .catch((e) => {
    console.error('Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
