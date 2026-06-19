# Ensigna - Tienda Otaku 

Este proyecto es nuestra tienda otaku hecha con Node.js, Express y MySQL. La idea fue crear una tienda online para vender ropa, accesorios y productos de anime con carrito, pago por Webpay y un panel de administración básico.

Aquí lo armamos con nuestro propio estilo, queremos que se note que es un trabajo de curso hecho por el grupo.

## Sobre el negocio

Ensigna es una tienda pensada para fans del anime. En el sitio se puede:
- ver productos con imágenes y descripción,
- filtrar por categoría, talla, color y precio,
- buscar por nombre,
- agregar al carrito,
- hacer el checkout con Webpay,
- y en la zona de admin gestionar productos, pedidos, usuarios y tickets de soporte.

## Integrantes del grupo

- Nicolás Espinoza
- Javiera Be
- Carlos Aravena
- Rayen Gutiérrez

## Requisitos

Necesitas tener:
- XAMPP instalado y corriendo Apache + MySQL,
- Node.js instalado (recomendado v18 o superior),
- npm disponible desde la terminal.

## Cómo levantar el proyecto

1. Abre XAMPP y enciende Apache y MySQL.
2. Abre el navegador y entra a `http://localhost/phpmyadmin`.
3. En phpMyAdmin importa primero `database/schema.sql` y luego `database/seed.sql`.
4. Abre una terminal y ve a la carpeta del proyecto:

```bash
cd "c:\xampp\htdocs\Ensigna\Ensigna Programa"
```

5. Instala las dependencias:

```bash
npm install
```

6. Arranca el servidor:

```bash
npm run dev 
o
npm start 
```

7. Abre el sitio en el navegador en:

```text
http://localhost:3000
```

> Si tu MySQL de XAMPP tiene contraseña, edita el archivo `.env` y cambia `DB_PASS`.

## Acceso rápido

- Admin: `admin@tienda.com` / `Admin123!`
- Cliente: `cliente@test.com` / `Cliente123!`

## Estructura básica del proyecto

- `app.js`: punto de entrada del servidor
- `config/db.js`: conexión a la base de datos
- `routes/`: define las rutas de la API
- `controllers/`: lógica de cada endpoint
- `public/`: archivos del frontend (HTML, CSS, JS)
- `database/`: scripts para crear y poblar la base de datos

## Qué incluye Ensigna

- Catálogo con paginación
- Búsqueda y filtros
- Página de producto detallada
- Carrito de compras con actualización de cantidades
- Checkout con integración a Webpay
- Panel admin para productos, usuarios, pedidos y soporte
- Autenticación con sesión en MySQL

## Notas importantes

- El checkout usa la pasarela Webpay
- Las contraseñas se guardan con bcrypt.

## Endpoints principales

- `/api/productos` - listar productos
- `/api/productos/buscar` - buscar por texto
- `/api/productos/filtrar` - aplicar filtros
- `/api/carrito` - manejar el carrito
- `/api/pedidos` - crear y ver pedidos
- `/api/pagos` - pago y confirmación
- `/api/admin` - funcionalidad de administrador

## Cómo probar rápido

1. Inicia sesión con el usuario admin.
2. Entra al panel admin.
3. Crea, edita y desactiva productos.
4. En el sitio normal, agrega productos al carrito y prueba el checkout.
5. En soporte puedes ver tickets y responderlos.

## Tip extra

Si algo no carga, revisa en la terminal si hay errores de conexión con MySQL, y asegúrate de que Apache y MySQL estén activos en XAMPP.
