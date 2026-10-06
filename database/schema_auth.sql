create table rol(
    id serial primary key,
    nombre varchar(50) not null unique,
    descripcion nvarchar(255)
);

create table usuario(
    id serial primary key,
    nombre varchar(100) not null,
    email varchar(100) not null unique,
    password varchar(255) not null,
    rol_id int not null,
    estado boolean default true,
    ultima_conexion timestamp,
    constraint fk_usuario_rol foreign key (rol_id) references rol(id)
);


INSERT INTO rol (nombre, descripcion) VALUES
('Administrador', 'Acceso total al sistema'),
('Cajero', 'Registro de ventas y consulta de precios'),
('Bodeguero', 'Gestión de inventarios y entradas');
