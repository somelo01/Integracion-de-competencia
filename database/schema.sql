
CREATE DATABASE IF NOT EXISTS tienda_ropa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE tienda_ropa;

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  contrasena VARCHAR(255) NOT NULL,           -- Hash bcrypt (nunca texto plano)
  rol_usuario ENUM('Admin', 'Cliente', 'Soporte') NOT NULL DEFAULT 'Cliente',
  verificacion_email TINYINT(1) NOT NULL DEFAULT 0,  -- 0 = No verificado, 1 = Verificado
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Tabla recuperar_acceso: tokens de recuperación de contraseña.
-- Cada token contiene expiración y bandera de uso.
CREATE TABLE IF NOT EXISTS recuperar_acceso (
  id_recuperacion INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expiracion DATETIME NOT NULL,
  usado TINYINT(1) NOT NULL DEFAULT 0,        -- 0 = Disponible, 1 = Ya fue usado
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_recuperar_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON DELETE CASCADE                          -- Si se borra el usuario, se borran sus tokens
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Tabla gestion_productos: catálogo de productos.
-- Incluye datos básicos, stock, talla, color, imagen y estado activo.
CREATE TABLE IF NOT EXISTS gestion_productos (
  id_producto INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  categoria VARCHAR(50) NOT NULL,             -- Ej: Camisetas, Pantalones, Vestidos
  precio DECIMAL(10,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  talla VARCHAR(10) DEFAULT NULL,             -- XS, S, M, L, XL, XXL (del diagrama UML)
  color VARCHAR(30) DEFAULT NULL,             -- Del diagrama UML
  descripcion TEXT DEFAULT NULL,
  imagen_url VARCHAR(255) DEFAULT NULL,       -- URL o ruta de la imagen del producto
  activo TINYINT(1) NOT NULL DEFAULT 1,       -- 1 = Visible, 0 = Oculto (soft delete)
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Validaciones a nivel de BD
  CONSTRAINT chk_precio_positivo CHECK (precio >= 0),
  CONSTRAINT chk_stock_positivo CHECK (stock >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Tabla filtros_busqueda: filtros guardados por usuario.
-- Permite asociar filtros de búsqueda a un usuario.
CREATE TABLE IF NOT EXISTS filtros_busqueda (
  id_filtro INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT DEFAULT NULL,
  categoria VARCHAR(50) DEFAULT NULL,
  precio_min DECIMAL(10,2) DEFAULT NULL,
  precio_max DECIMAL(10,2) DEFAULT NULL,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_filtro_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT chk_precio_min CHECK (precio_min >= 0 OR precio_min IS NULL),
  CONSTRAINT chk_precio_max CHECK (precio_max >= 0 OR precio_max IS NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Tabla carrito_compras: carrito activo por usuario.
-- Cada usuario tiene un carrito único con sus productos.
CREATE TABLE IF NOT EXISTS carrito_compras (
  id_carrito INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL UNIQUE,             -- Un solo carrito por usuario
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_carrito_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Tabla detalle_carrito: productos y cantidades del carrito.
-- Evita duplicados con UNIQUE(id_carrito, id_producto).
CREATE TABLE IF NOT EXISTS detalle_carrito (
  id_detalle_carrito INT AUTO_INCREMENT PRIMARY KEY,
  id_carrito INT NOT NULL,
  id_producto INT NOT NULL,
  cantidad INT NOT NULL DEFAULT 1,

  CONSTRAINT fk_detcarrito_carrito
    FOREIGN KEY (id_carrito) REFERENCES carrito_compras(id_carrito)
    ON DELETE CASCADE                          -- Si se borra el carrito, se borran sus detalles
    ON UPDATE CASCADE,

  CONSTRAINT fk_detcarrito_producto
    FOREIGN KEY (id_producto) REFERENCES gestion_productos(id_producto)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT chk_cantidad_carrito CHECK (cantidad > 0),
  UNIQUE KEY uq_carrito_producto (id_carrito, id_producto)  -- Evitar duplicados
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Tabla pedidos: órdenes de compra del cliente.
-- Incluye estado, total y relación con usuario.
CREATE TABLE IF NOT EXISTS pedidos (
  id_pedido INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  estado ENUM('Pendiente', 'Aprobado', 'Rechazado', 'Cancelado', 'Enviado', 'Entregado')
    NOT NULL DEFAULT 'Pendiente',
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,

  CONSTRAINT fk_pedido_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Tabla detalle_pedido: productos y precios en cada pedido.
-- Conserva el precio unitario histórico en el momento de compra.
CREATE TABLE IF NOT EXISTS detalle_pedido (
  id_detalle INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,
  id_producto INT NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,     -- Precio al momento de la compra

  CONSTRAINT fk_detpedido_pedido
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_detpedido_producto
    FOREIGN KEY (id_producto) REFERENCES gestion_productos(id_producto)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT chk_cantidad_pedido CHECK (cantidad > 0),
  CONSTRAINT chk_precio_unitario CHECK (precio_unitario >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Tabla pagos: información de pago de cada pedido.
-- Incluye estado, método, monto y token Webpay.
CREATE TABLE IF NOT EXISTS pagos (
  id_pago INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,
  estado ENUM('Pendiente', 'Aprobado', 'Rechazado', 'Cancelado', 'Reembolsado')
    NOT NULL DEFAULT 'Pendiente',
  metodo_pago VARCHAR(50) NOT NULL DEFAULT 'Webpay',
  monto DECIMAL(10,2) NOT NULL,
  token_ws VARCHAR(255) DEFAULT NULL,         -- Token de Transbank Webpay
  fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_pago_pedido
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Tabla facturas: comprobantes generados tras un pago aprobado.
-- Guarda la ruta al PDF del comprobante.
CREATE TABLE IF NOT EXISTS facturas (
  id_factura INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL UNIQUE,              -- Una sola factura por pedido
  comprobante_pdf VARCHAR(255) DEFAULT NULL,  -- Ruta al archivo PDF generado
  fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_factura_pedido
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Tabla soporte: tickets de ayuda y solicitudes de reembolso.
-- Tipo, estado, pedido asociado y respuesta del administrador.
CREATE TABLE IF NOT EXISTS soporte (
  id_ticket INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  asunto VARCHAR(200) NOT NULL,
  estado ENUM('Abierto', 'En Proceso', 'Cerrado') NOT NULL DEFAULT 'Abierto',
  tipo ENUM('Consulta', 'Reembolso', 'Problema Técnico', 'Otro') NOT NULL DEFAULT 'Consulta',
  id_pedido INT DEFAULT NULL,                 -- Solo para tickets tipo 'Reembolso'
  comentarios TEXT DEFAULT NULL,              -- Descripción del problema por el cliente
  respuesta_admin TEXT DEFAULT NULL,          -- Respuesta del administrador
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_soporte_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_soporte_pedido
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Índices adicionales para consultas frecuentes.

-- Buscar productos por categoría (filtro más usado en el catálogo)
CREATE INDEX idx_producto_categoria ON gestion_productos(categoria);

-- Buscar productos por rango de precio (filtro del catálogo)
CREATE INDEX idx_producto_precio ON gestion_productos(precio);

-- Buscar productos activos (solo mostrar visibles en catálogo)
CREATE INDEX idx_producto_activo ON gestion_productos(activo);

-- Buscar pedidos por usuario (historial de compras)
CREATE INDEX idx_pedido_usuario ON pedidos(id_usuario);

-- Buscar pedidos por estado (panel admin: filtrar por estado)
CREATE INDEX idx_pedido_estado ON pedidos(estado);

-- Buscar tickets por usuario (mis tickets de soporte)
CREATE INDEX idx_soporte_usuario ON soporte(id_usuario);

-- Buscar tickets por estado (panel admin: tickets abiertos)
CREATE INDEX idx_soporte_estado ON soporte(estado);
