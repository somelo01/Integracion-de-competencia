
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


-- ============================================================
-- TABLA: recuperar_acceso
-- ============================================================
-- Almacena tokens temporales para el flujo de recuperación
-- de contraseña. Cada token tiene una expiración de 1 hora.
-- Basada en la entidad "Recuperar_Acceso" del ERD (imagen 4).
--
-- Flujo:
--   1. Usuario solicita recuperación → Se genera token + expiración
--   2. Usuario recibe enlace con token (simulado en este proyecto)
--   3. Usuario usa el token para establecer nueva contraseña
--   4. Token se marca como "usado" para evitar reutilización
--
-- Relaciones:
--   ← usuarios.id_usuario (N:1) - A qué usuario pertenece
-- ============================================================
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


-- ============================================================
-- TABLA: gestion_productos
-- ============================================================
-- Catálogo completo de productos de la tienda de ropa.
-- Basada en la entidad "Gestion de Productos" del ERD (imagen 4)
-- y la clase "Gestion_Productos" del diagrama UML (imagen.png).
--
-- Campos del ERD: ID_producto, Nombre, Categoría, Precio, Stock
-- Campos adicionales del UML: Talla, Color (diagrama de clases)
-- Campo adicional: 'activo' para soportar el caso de uso
-- "Ocultar/Eliminar Producto" del admin (imagen 2) sin borrar datos.
--
-- Relaciones:
--   → detalle_carrito (1:N) - Productos en carritos
--   → detalle_pedido (1:N) - Productos en pedidos
-- ============================================================
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


-- ============================================================
-- TABLA: filtros_busqueda
-- ============================================================
-- Almacena los filtros de búsqueda aplicados por los usuarios.
-- Basada en la entidad "filtros_Busqueda" del ERD (imagen 4)
-- y la clase "Filtros_Busqueda" del diagrama UML (imagen.png).
--
-- Nota: En esta implementación, los filtros se aplican en tiempo
-- real via query params en la API. Esta tabla permite guardar
-- búsquedas favoritas (funcionalidad opcional).
--
-- Relaciones:
--   ← usuarios.id_usuario (N:1) - Qué usuario guardó el filtro
-- ============================================================
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


-- ============================================================
-- TABLA: carrito_compras
-- ============================================================
-- Representa el carrito de compras activo de cada usuario.
-- Basada en la entidad "Carrito_Compras" del ERD (imagen 4).
--
-- Cada usuario tiene UN SOLO carrito activo (UNIQUE en id_usuario).
-- El carrito se crea automáticamente al registrar un usuario.
-- Los productos del carrito están en la tabla detalle_carrito.
--
-- Relaciones:
--   ← usuarios.id_usuario (1:1) - A qué usuario pertenece
--   → detalle_carrito (1:N) - Productos dentro del carrito
-- ============================================================
CREATE TABLE IF NOT EXISTS carrito_compras (
  id_carrito INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL UNIQUE,             -- Un solo carrito por usuario
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_carrito_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLA: detalle_carrito
-- ============================================================
-- Tabla intermedia que resuelve la relación Muchos-a-Muchos
-- entre carrito_compras y gestion_productos.
-- Basada en la entidad "Detalle_Carrito" del ERD (imagen 4).
--
-- Cada fila = un producto agregado al carrito con su cantidad.
-- UNIQUE(id_carrito, id_producto) evita duplicados: si el usuario
-- agrega el mismo producto dos veces, se suma la cantidad.
--
-- Relaciones:
--   ← carrito_compras.id_carrito (N:1)
--   ← gestion_productos.id_producto (N:1)
-- ============================================================
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


-- ============================================================
-- TABLA: pedidos
-- ============================================================
-- Registra las órdenes de compra confirmadas por los clientes.
-- Basada en la entidad "Pedidos" del ERD (imagen 4).
--
-- Estados (del ERD + extensiones para logística del diagrama 3):
--   'Pendiente'  → Pedido creado, esperando pago
--   'Aprobado'   → Pago exitoso, listo para despacho
--   'Rechazado'  → Pago rechazado por la pasarela
--   'Cancelado'  → Cancelado por el cliente o admin
--   'Enviado'    → En camino (coordinador de despacho)
--   'Entregado'  → Recibido por el cliente
--
-- Relaciones:
--   ← usuarios.id_usuario (N:1) - Quién hizo el pedido
--   → detalle_pedido (1:N) - Productos del pedido
--   → pagos (1:1) - Información del pago
--   → facturas (1:1) - Comprobante PDF
--   → soporte (1:N) - Tickets asociados
-- ============================================================
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


-- ============================================================
-- TABLA: detalle_pedido
-- ============================================================
-- Tabla intermedia que resuelve la relación Muchos-a-Muchos
-- entre pedidos y gestion_productos.
-- Basada en la entidad "Detalle_Pedido" del ERD (imagen 4).
--
-- Guarda el precio_unitario al momento de la compra para que
-- si el admin cambia el precio después, el historial no se vea
-- afectado (integridad histórica).
--
-- Relaciones:
--   ← pedidos.id_pedido (N:1)
--   ← gestion_productos.id_producto (N:1)
-- ============================================================
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


-- ============================================================
-- TABLA: pagos
-- ============================================================
-- Registra la información de pago asociada a cada pedido.
-- Basada en la entidad "Pagos" del ERD (imagen 4) y el
-- Diagrama de Secuencia del Proceso de Compra (imagen 5).
--
-- En este proyecto se integra Transbank Webpay Plus (sandbox).
-- El token_ws y datos de respuesta de Transbank se guardan aquí.
--
-- Estados:
--   'Pendiente'    → Esperando procesamiento
--   'Aprobado'     → Transbank aprobó el pago
--   'Rechazado'    → Transbank rechazó el pago
--   'Cancelado'    → Usuario canceló en el formulario de Transbank
--   'Reembolsado'  → Se ejecutó un reembolso (diagrama 6)
--
-- Relaciones:
--   ← pedidos.id_pedido (1:1) - A qué pedido corresponde
-- ============================================================
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


-- ============================================================
-- TABLA: facturas
-- ============================================================
-- Almacena los comprobantes de compra generados tras un pago
-- exitoso. Basada en la entidad "Facturas" del ERD (imagen 4).
--
-- Se genera una factura automáticamente al aprobarse un pago.
-- El campo comprobante_pdf almacena la ruta al archivo PDF.
--
-- Relaciones:
--   ← pedidos.id_pedido (1:1) - Una factura por pedido
-- ============================================================
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


-- ============================================================
-- TABLA: soporte
-- ============================================================
-- Sistema de tickets de ayuda y solicitudes de reembolso.
-- Basada en la entidad "Soporte" del ERD (imagen 4) y la
-- clase "Soporte" del diagrama UML (imagen.png).
--
-- Soporta el flujo de Devolución/Reembolso del Diagrama de
-- Secuencia (imagen 6): el cliente crea un ticket tipo 'Reembolso'
-- asociado a un pedido, y el admin lo evalúa y responde.
--
-- Tipos de ticket:
--   'Consulta'          → Pregunta general
--   'Reembolso'         → Solicitud de devolución (necesita id_pedido)
--   'Problema Técnico'  → Error en la plataforma
--   'Otro'              → Otros asuntos
--
-- Relaciones:
--   ← usuarios.id_usuario (N:1) - Quién creó el ticket
--   ← pedidos.id_pedido (N:1, opcional) - Pedido asociado (reembolsos)
-- ============================================================
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


-- ============================================================
-- ÍNDICES ADICIONALES
-- ============================================================
-- Mejoran el rendimiento de consultas frecuentes (búsquedas,
-- filtros, listados). phpMyAdmin los mostrará en la pestaña
-- "Estructura" de cada tabla.
-- ============================================================

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
