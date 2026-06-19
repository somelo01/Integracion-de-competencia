-- Seed de datos para tienda_ropa.
-- Contiene usuarios, productos, carritos, pedidos, pagos, facturas y soporte.
USE tienda_ropa;

-- Usuarios de prueba con contraseñas bcrypt.
INSERT INTO usuarios (email, nombre, contrasena, rol_usuario, verificacion_email) VALUES
('admin@tienda.com', 'Administrador Principal', '$2a$10$yOOA4LE/dvK6tT7b94cugua8YtmuuS/IRT1lrunxEruqg9Sra41x.', 'Admin', 1),
('cliente@test.com', 'María José González', '$2a$10$kRXNH/X75w7RD0inK5GZdO./rJPLrbJpvjm.oQTlZDrnIYPP2.Gxm', 'Cliente', 1);


-- Productos de ejemplo para catálogo y filtros.
INSERT INTO gestion_productos (nombre, categoria, precio, stock, talla, color, descripcion, imagen_url) VALUES

('Camiseta Full metal alchemist(Blanca) - Logo Anime', 'Camisetas', 12990.00, 50, 'M', 'Blanco', 'Camiseta con estampado oficial de anime, algodón suave y cómodo. Perfecta para fans.', '/img/Camiseta-Blanca-N.png'),
('Camiseta Full metal alchemist(Negro)" - Ed. Limitada', 'Camisetas', 18990.00, 35, 'L', 'Negro', 'Oversize con estampado inspirado en shonen clásico. Diseño de edición limitada.', '/img/Camiseta-Negra-N.webp'),
('Camiseta Full metal alchemist(Azul) - Minimal Anime', 'Camisetas', 24990.00, 25, 'M', 'Azul', 'Polo con bordado discreto de emblema de academia anime. Ideal para uso diario.', '/img/Camiseta-Azul-N.png'),


('Pantalón Jogger - Anime', 'Pantalones', 22990.00, 30, 'S', 'Gris', 'Jogger deportivo con logo discreto de estudio. Cómodo y resistente.', '/img/jogger-gris.jpg'),
('Pantalón One Piece - Mugiwara', 'Pantalones', 32990.00, 30, 'M', 'Negro', 'Pantalón inspirado en el universo One Piece.', '/img/pantalones-one-piece.png'),
    
('Vestido Primaveral - Floral Anime', 'Vestidos', 35990.00, 15, 'S', 'Rosa', 'Vestido con estampado floral inspirado en las celebraciones primaverales.', '/img/vestido-rosa.jpg'),
('Vestido Elegante Anime - Gala Cosplay', 'Vestidos', 59990.00, 10, 'M', 'Negro', 'Vestido elegante ideal para eventos, convenciones y cosplay de gala.', '/img/vestido-anime.jpg'),

('Chaqueta Full metal alchemist - Patch Anime', 'Chaquetas', 44990.00, 18, 'L', 'Rojo', 'Chaqueta de full metal alchemist de Edward.', '/img/Chaleco-Anime-Fullmetal.webp'),
('Chaqueta Naruto - ', 'Chaquetas', 69990.00, 12, 'XL', 'Negro', 'Chaleco de Naruto con estampado del equipo 7', '/img/Chaleco-Anime.webp'),

('Gorro de lana Naruto - Ed. Anime', 'Accesorios', 9990.00, 60, NULL, 'Gris', 'Gorro de lana con bordado y etiqueta temática de kitsune. Cálido y estiloso.', '/img/Gorro-de-lana-Naruto.jpg'),
('Cinturón Full Metal Alchemist - Cuero', 'Accesorios', 15990.00, 45, NULL, 'Negro', 'Cinturón de cuero de full metal alchemist de 85cm.', '/img/Cinturo-Anime.jpg');



-- Carritos de prueba para cada usuario.
INSERT INTO carrito_compras (id_usuario) VALUES
(1),  -- Carrito del admin (vacío)
(2);  -- Carrito del cliente (con productos abajo)


-- Detalle del carrito del cliente.
INSERT INTO detalle_carrito (id_carrito, id_producto, cantidad) VALUES
(2, 1, 2),   -- 2x Camiseta blanca
(2, 4, 1);   -- 1x Jeans


-- Pedidos de ejemplo para historial de cliente.
INSERT INTO pedidos (id_usuario, estado, total) VALUES
(2, 'Entregado', 55970.00),   -- Pedido 1: ya entregado
(2, 'Aprobado', 35990.00);    -- Pedido 2: aprobado, en proceso


-- Detalle de pedidos con precios históricos.

-- Detalle del Pedido 1 (Entregado)
INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES
(1, 1, 2, 12990.00),   -- 2x Camiseta Básica = 25,980
(1, 4, 1, 29990.00);   -- 1x Jeans = 29,990 → Total: 55,970

-- Detalle del Pedido 2 (Aprobado)
INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES
(2, 7, 1, 35990.00);   -- 1x Vestido Casual Floral = 35,990


-- Pagos asociados a los pedidos.
INSERT INTO pagos (id_pedido, estado, metodo_pago, monto) VALUES
(1, 'Aprobado', 'Webpay', 55970.00),     -- Pago del pedido 1: aprobado
(2, 'Aprobado', 'Webpay', 35990.00);     -- Pago del pedido 2: aprobado


-- Facturas relacionadas a pedidos.
INSERT INTO facturas (id_pedido, comprobante_pdf) VALUES
(1, '/facturas/factura-001.pdf'),
(2, '/facturas/factura-002.pdf');


-- Ticket de soporte de ejemplo.
INSERT INTO soporte (id_usuario, asunto, estado, tipo, comentarios) VALUES
(2, 'Consulta sobre tallas', 'Abierto', 'Consulta',
 'Hola, quisiera saber si la Camiseta Full metal alchemist(Negro) viene en talla XL. Gracias.');


-- Seed cargado. Inicia el servidor con: npm start