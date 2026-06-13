# ️ Tienda de Ropa — Sistema E-Commerce

Sistema web completo de comercio electrónico para venta de ropa, desarrollado con Node.js, Express, MySQL y Bootstrap 5. Incluye integración con **Webpay Plus** (Transbank) para procesamiento de pagos.

## Requisitos Previos

- [XAMPP](https://www.apachefriends.org/) (incluye Apache + MySQL + phpMyAdmin)
- [Node.js](https://nodejs.org/) v18 o superior
- npm (incluido con Node.js)

## Instalación Paso a Paso

### 1. Preparar la Base de Datos

1. Abrir **XAMPP Control Panel**
2. Iniciar **Apache** y **MySQL** (ambos deben estar en verde)
3. Abrir el navegador e ir a: `http://localhost/phpmyadmin`
4. En phpMyAdmin:
   - Ir a la pestaña **"Importar"**
   - Seleccionar el archivo `database/schema.sql`
   - Click en **"Continuar"** → Se crearán la base de datos y todas las tablas
5. Repetir el paso 4 con el archivo `database/seed.sql` para cargar datos de prueba

### 2. Instalar Dependencias

```bash
cd AyudantiaWeb_Integracio
npm install
```

### 3. Configurar Variables de Entorno

El archivo `.env` ya está configurado para XAMPP por defecto:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=tienda_ropa
```
> Si tu XAMPP tiene una contraseña diferente para MySQL, modifica `DB_PASS`.

### 4. Iniciar el Servidor

```bash
# Modo desarrollo (con hot-reload automático)
npm run dev

# Modo producción
npm start
```

### 5. Abrir la Aplicación

Ir a: **http://localhost:3000**

## Usuarios de Prueba

| Rol | Email | Contraseña |
|---|---|---|
| **Admin** | admin@tienda.com | Admin123! |
| **Cliente** | cliente@test.com | Cliente123! |

## Tarjetas de Prueba (Webpay Plus Sandbox)

| Resultado | Número de Tarjeta | CVV | Fecha Exp |
|---|---|---|---|
| **Aprobada** | 4051 8856 0044 6623 | 123 | Cualquier futura |
| **Rechazada** | 5186 0595 5959 0568 | 123 | Cualquier futura |

> **RUT de prueba:** 11.111.111-1 | **Clave:** 123

## ️ Estructura del Proyecto

```
├── database/
│   ├── schema.sql        ← DDL de la base de datos (11 tablas)
│   └── seed.sql          ← Datos de prueba
├── config/
│   └── db.js             ← Conexión MySQL (pool)
├── middleware/
│   ├── auth.js           ← Verificar sesión activa
│   ├── adminAuth.js      ← Verificar rol Admin
│   └── validators.js     ← Regex y validaciones
├── routes/
│   ├── authRoutes.js     ← /api/auth/*
│   ├── productRoutes.js  ← /api/productos/*
│   ├── cartRoutes.js     ← /api/carrito/*
│   ├── orderRoutes.js    ← /api/pedidos/*
│   ├── paymentRoutes.js  ← /api/pagos/*
│   ├── supportRoutes.js  ← /api/soporte/*
│   └── adminRoutes.js    ← /api/admin/*
├── controllers/
│   ├── authController.js
│   ├── productController.js
│   ├── cartController.js
│   ├── orderController.js
│   ├── paymentController.js
│   ├── supportController.js
│   └── adminController.js
├── public/
│   ├── css/styles.css
│   ├── js/               ← 8 archivos JS del frontend
│   └── pages/            ← 14 páginas HTML (+ 5 admin)
├── app.js                ← Entry point del servidor
├── package.json
├── .env
└── README.md
```

## Diagramas del Proyecto

Este sistema fue diseñado a partir de los siguientes diagramas UML:

| Imagen | Diagrama | Descripción |
|---|---|---|
| `imagen.png` | Diagrama de Clases UML | Estructura de clases del backend |
| `imagen (1).png` | Casos de Uso - Cliente | Flujos del usuario final |
| `imagen (2).png` | Casos de Uso - Admin | Flujos del administrador |
| `imagen (3).png` | Casos de Uso - Bodega/Despacho | Flujos logísticos |
| `imagen (4).png` | ERD (Modelo Relacional) | Esquema de la base de datos |
| `imagen (5).png` | Secuencia - Proceso de Compra | Flujo de pago con pasarela |
| `imagen (6).png` | Secuencia - Devolución/Reembolso | Flujo de post-venta |
| `imagen (7).png` | Secuencia - Gestión de Productos | CRUD admin de productos |

## Seguridad Implementada

- Contraseñas hasheadas con **bcryptjs** (10 salt rounds)
- Consultas **parametrizadas** (previene SQL Injection)
- Sanitización de entrada (previene XSS)
- Sesiones en MySQL con **httpOnly cookies**
- Middleware de autenticación y autorización por roles
- Validación con **regex** tanto en frontend como backend
- Verificación de pertenencia (un usuario no accede a datos de otro)

## API Endpoints

### Autenticación (`/api/auth`)
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | /registro | No | Registrar usuario |
| POST | /login | No | Iniciar sesión |
| POST | /logout | Sí | Cerrar sesión |
| GET | /perfil | Sí | Obtener datos del perfil |
| PUT | /perfil | Sí | Editar perfil |
| GET | /session | No | Verificar sesión activa |

### Productos (`/api/productos`)
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | / | No | Listar productos (paginado) |
| GET | /buscar?q= | No | Buscar por nombre |
| GET | /filtrar | No | Filtrar por categoría/precio/talla/color |
| GET | /categorias | No | Listar categorías |
| GET | /:id | No | Detalle de un producto |

### Carrito (`/api/carrito`)
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | / | Sí | Ver carrito |
| POST | /agregar | Sí | Agregar producto |
| PUT | /actualizar/:id | Sí | Cambiar cantidad |
| DELETE | /eliminar/:id | Sí | Quitar producto |
| DELETE | /vaciar | Sí | Vaciar carrito |

### Pedidos (`/api/pedidos`)
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | /crear | Sí | Crear pedido desde carrito |
| GET | / | Sí | Historial de pedidos |
| GET | /:id | Sí | Detalle del pedido |
| PUT | /:id/cancelar | Sí | Cancelar pedido pendiente |

### Pagos (`/api/pagos`)
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | /crear | Sí | Iniciar pago en Webpay |
| GET | /confirmar | No | Callback de Webpay |
| GET | /:idPedido | Sí | Info del pago de un pedido |

### Admin (`/api/admin`) — Requiere rol Admin
Gestión completa de: productos, usuarios, pedidos, tickets y reembolsos.
