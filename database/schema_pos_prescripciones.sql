-- ============================================
-- RF-13: PRESCRIPCIONES MEDICAS
-- Responsable: Jonathan
-- ============================================

-- Registro de recetas medicas
CREATE TABLE IF NOT EXISTS prescripcion (
    id SERIAL PRIMARY KEY,
    numero_receta VARCHAR(50) NOT NULL UNIQUE,
    cedula_cliente VARCHAR(30) NOT NULL,
    nombre_paciente VARCHAR(150) NOT NULL,
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE,
    estado VARCHAR(20) DEFAULT 'Activa',
    CHECK (
        fecha_vencimiento IS NULL
        OR fecha_vencimiento >= fecha_emision
    )
);

-- Medicamentos autorizados en cada receta
CREATE TABLE IF NOT EXISTS detalle_prescripcion (
    id SERIAL PRIMARY KEY,
    prescripcion_id INT NOT NULL
        REFERENCES prescripcion(id),
    producto_id INT NOT NULL
        REFERENCES producto(id),
    cantidad_autorizada INT NOT NULL
        CHECK (cantidad_autorizada > 0),
    UNIQUE (prescripcion_id, producto_id)
);

-- ============================================
-- RF-12: PUNTO DE VENTA (POS)
-- Responsable: Jonathan
-- ============================================

-- Registro general de ventas
CREATE TABLE IF NOT EXISTS venta (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL
        REFERENCES usuario(id),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total NUMERIC(10,2) NOT NULL
        CHECK (total >= 0),
    metodo_pago VARCHAR(30) NOT NULL,
    estado VARCHAR(20) DEFAULT 'Completada'
);

-- Productos incluidos en cada venta
CREATE TABLE IF NOT EXISTS detalle_venta (
    id SERIAL PRIMARY KEY,
    venta_id INT NOT NULL
        REFERENCES venta(id),
    producto_id INT NOT NULL
        REFERENCES producto(id),
    lote_id INT NOT NULL
        REFERENCES lote(id),
    prescripcion_id INT
        REFERENCES prescripcion(id),
    cantidad INT NOT NULL
        CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL
        CHECK (precio_unitario >= 0),
    subtotal NUMERIC(10,2) NOT NULL
        CHECK (subtotal >= 0)
);