// ============================================================
// MIDDLEWARE: VALIDACIONES Y REGEX
// ============================================================
// Este archivo centraliza TODAS las validaciones del sistema.
// Los regex (expresiones regulares) definen los patrones que
// deben cumplir los datos de entrada del usuario.
//
// ¿POR QUÉ VALIDAR EN EL BACKEND?
// Aunque el frontend también valida (para mejor UX), la
// validación del backend es la que REALMENTE protege el sistema.
// Un atacante puede saltarse la validación del frontend
// fácilmente (usando Postman, curl, o desactivando JavaScript).
//
// CÓMO SE USA EN LAS RUTAS:
//   const { validateRegister, validateProduct } = require('../middleware/validators');
//   router.post('/registro', validateRegister, authController.registrar);
//   // validateRegister se ejecuta ANTES del controlador.
//   // Si la validación falla, responde con 400 y NO llega al controlador.
//   // Si pasa, llama a next() y continúa al controlador.
// ============================================================

// ============================================================
// PATRONES REGEX
// ============================================================
// Cada regex define qué formato es válido para cada campo.
// Se exportan para reutilizarlos en el frontend (utils.js).
// ============================================================

const REGEX = {
  // Email: formato estándar (usuario@dominio.extension)
  // Acepta: maria@correo.cl, juan.perez@gmail.com, user123@empresa.co
  // Rechaza: @correo.com, maria@, maria@.com, maria correo.com
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,

  // Contraseña: mínimo 8 caracteres, al menos:
  //   - 1 letra minúscula (a-z)
  //   - 1 letra mayúscula (A-Z)
  //   - 1 número (0-9)
  //   - 1 carácter especial (@$!%*?&#)
  // Acepta: Admin123!, Clave#Segura1, P@ssw0rd
  // Rechaza: password, 12345678, Admin123 (sin especial), admin123! (sin mayúscula)
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/,

  // Nombre: solo letras (incluyendo ñ/Ñ y acentos del español),
  // espacios y entre 2-100 caracteres.
  // Acepta: María, José Ñuñez, Ana María López
  // Rechaza: M, Juan123, <script>alert('xss')</script>
  NAME: /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]{2,100}$/,

  // Precio: número positivo con hasta 2 decimales.
  // Acepta: 100, 29990, 12.99, 0.50
  // Rechaza: -10, abc, 12.999, .50
  PRICE: /^\d+(\.\d{1,2})?$/,

  // ID numérico: solo dígitos enteros positivos (para parámetros de URL).
  // Acepta: 1, 42, 999
  // Rechaza: 0, -1, 1.5, abc
  ID: /^[1-9]\d*$/,

  // Cantidad: entero positivo para ítems del carrito.
  // Acepta: 1, 5, 100
  // Rechaza: 0, -1, 1.5
  QUANTITY: /^[1-9]\d*$/
};


// ============================================================
// FUNCIÓN: sanitizeInput
// ============================================================
// Limpia un string de caracteres peligrosos para prevenir XSS
// (Cross-Site Scripting). Convierte caracteres HTML especiales
// en sus entidades seguras.
//
// Ejemplo:
//   sanitizeInput('<script>alert("xss")</script>')
//   → '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
// ============================================================
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}


// ============================================================
// FUNCIÓN HELPER: buildErrorResponse
// ============================================================
// Construye un objeto de error con formato consistente.
// Todas las respuestas de error del sistema siguen este formato
// para que el frontend siempre sepa cómo interpretar los errores.
// ============================================================
function buildErrorResponse(errors) {
  return {
    success: false,
    message: 'Error de validación',
    data: null,
    errors: errors // Array de { field: 'campo', message: 'Descripción del error' }
  };
}


// ============================================================
// MIDDLEWARE: validateRegister
// ============================================================
// Valida los datos del formulario de registro de usuario.
// Se usa en: routes/authRoutes.js → POST /api/auth/registro
//
// Campos requeridos:
//   - email: formato email válido
//   - nombre: solo letras y espacios, 2-100 chars
//   - contrasena: mínimo 8 chars con mayúscula, minúscula, número, especial
// ============================================================
function validateRegister(req, res, next) {
  const { email, nombre, contrasena } = req.body;
  const errors = [];

  // Verificar que los campos existen y no están vacíos
  if (!email || !email.trim()) {
    errors.push({ field: 'email', message: 'El email es obligatorio' });
  } else if (!REGEX.EMAIL.test(email.trim())) {
    errors.push({ field: 'email', message: 'Formato de email inválido. Ejemplo: usuario@correo.com' });
  }

  if (!nombre || !nombre.trim()) {
    errors.push({ field: 'nombre', message: 'El nombre es obligatorio' });
  } else if (!REGEX.NAME.test(nombre.trim())) {
    errors.push({ field: 'nombre', message: 'El nombre solo puede contener letras y espacios (2-100 caracteres)' });
  }

  if (!contrasena) {
    errors.push({ field: 'contrasena', message: 'La contraseña es obligatoria' });
  } else if (!REGEX.PASSWORD.test(contrasena)) {
    errors.push({
      field: 'contrasena',
      message: 'La contraseña debe tener mínimo 8 caracteres, incluyendo: 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial (@$!%*?&#)'
    });
  }

  // Si hay errores, responder con 400 (Bad Request) y NO continuar
  if (errors.length > 0) {
    return res.status(400).json(buildErrorResponse(errors));
  }

  // Sanitizar los campos antes de pasar al controlador
  req.body.email = email.trim().toLowerCase();
  req.body.nombre = sanitizeInput(nombre.trim());

  // Todo OK → continuar al controlador
  next();
}


// ============================================================
// MIDDLEWARE: validateLogin
// ============================================================
// Valida los datos del formulario de inicio de sesión.
// Se usa en: routes/authRoutes.js → POST /api/auth/login
// ============================================================
function validateLogin(req, res, next) {
  const { email, contrasena } = req.body;
  const errors = [];

  if (!email || !email.trim()) {
    errors.push({ field: 'email', message: 'El email es obligatorio' });
  } else if (!REGEX.EMAIL.test(email.trim())) {
    errors.push({ field: 'email', message: 'Formato de email inválido' });
  }

  if (!contrasena) {
    errors.push({ field: 'contrasena', message: 'La contraseña es obligatoria' });
  }

  if (errors.length > 0) {
    return res.status(400).json(buildErrorResponse(errors));
  }

  req.body.email = email.trim().toLowerCase();
  next();
}


// ============================================================
// MIDDLEWARE: validateProduct
// ============================================================
// Valida los datos al crear o editar un producto (panel admin).
// Se usa en: routes/adminRoutes.js → POST/PUT /api/admin/productos
// ============================================================
function validateProduct(req, res, next) {
  const { nombre, categoria, precio, stock } = req.body;
  const errors = [];

  if (!nombre || !nombre.trim()) {
    errors.push({ field: 'nombre', message: 'El nombre del producto es obligatorio' });
  } else if (nombre.trim().length < 3 || nombre.trim().length > 150) {
    errors.push({ field: 'nombre', message: 'El nombre debe tener entre 3 y 150 caracteres' });
  }

  if (!categoria || !categoria.trim()) {
    errors.push({ field: 'categoria', message: 'La categoría es obligatoria' });
  }

  if (precio === undefined || precio === null || precio === '') {
    errors.push({ field: 'precio', message: 'El precio es obligatorio' });
  } else if (!REGEX.PRICE.test(String(precio)) || parseFloat(precio) < 0) {
    errors.push({ field: 'precio', message: 'El precio debe ser un número positivo con hasta 2 decimales' });
  }

  if (stock === undefined || stock === null || stock === '') {
    errors.push({ field: 'stock', message: 'El stock es obligatorio' });
  } else if (!Number.isInteger(Number(stock)) || Number(stock) < 0) {
    errors.push({ field: 'stock', message: 'El stock debe ser un número entero mayor o igual a 0' });
  }

  if (errors.length > 0) {
    return res.status(400).json(buildErrorResponse(errors));
  }

  // Sanitizar campos de texto
  req.body.nombre = sanitizeInput(nombre.trim());
  req.body.categoria = sanitizeInput(categoria.trim());
  if (req.body.descripcion) {
    req.body.descripcion = sanitizeInput(req.body.descripcion.trim());
  }

  next();
}


// ============================================================
// MIDDLEWARE: validateCartItem
// ============================================================
// Valida los datos al agregar un producto al carrito.
// Se usa en: routes/cartRoutes.js → POST /api/carrito/agregar
// ============================================================
function validateCartItem(req, res, next) {
  const { id_producto, cantidad } = req.body;
  const errors = [];

  if (!id_producto) {
    errors.push({ field: 'id_producto', message: 'El ID del producto es obligatorio' });
  } else if (!REGEX.ID.test(String(id_producto))) {
    errors.push({ field: 'id_producto', message: 'ID de producto inválido' });
  }

  if (!cantidad) {
    errors.push({ field: 'cantidad', message: 'La cantidad es obligatoria' });
  } else if (!REGEX.QUANTITY.test(String(cantidad)) || Number(cantidad) < 1) {
    errors.push({ field: 'cantidad', message: 'La cantidad debe ser un número entero mayor a 0' });
  }

  if (errors.length > 0) {
    return res.status(400).json(buildErrorResponse(errors));
  }

  next();
}


// ============================================================
// MIDDLEWARE: validateTicket
// ============================================================
// Valida los datos al crear un ticket de soporte.
// Se usa en: routes/supportRoutes.js → POST /api/soporte/crear
// ============================================================
function validateTicket(req, res, next) {
  const { asunto, tipo, comentarios } = req.body;
  const errors = [];
  const tiposValidos = ['Consulta', 'Reembolso', 'Problema Técnico', 'Otro'];

  if (!asunto || !asunto.trim()) {
    errors.push({ field: 'asunto', message: 'El asunto es obligatorio' });
  } else if (asunto.trim().length < 5 || asunto.trim().length > 200) {
    errors.push({ field: 'asunto', message: 'El asunto debe tener entre 5 y 200 caracteres' });
  }

  if (tipo && !tiposValidos.includes(tipo)) {
    errors.push({ field: 'tipo', message: `Tipo inválido. Opciones: ${tiposValidos.join(', ')}` });
  }

  // Si es tipo Reembolso, necesita id_pedido
  if (tipo === 'Reembolso' && !req.body.id_pedido) {
    errors.push({ field: 'id_pedido', message: 'Para solicitar un reembolso, debe indicar el ID del pedido' });
  }

  if (errors.length > 0) {
    return res.status(400).json(buildErrorResponse(errors));
  }

  // Sanitizar
  req.body.asunto = sanitizeInput(asunto.trim());
  if (comentarios) {
    req.body.comentarios = sanitizeInput(comentarios.trim());
  }

  next();
}


// ============================================================
// MIDDLEWARE: validateId
// ============================================================
// Valida que el parámetro :id de la URL sea un entero positivo.
// Se usa como middleware en cualquier ruta con :id
// Ejemplo: router.get('/:id', validateId, controller.getById);
// ============================================================
function validateId(req, res, next) {
  const id = req.params.id || req.params.idDetalle || req.params.idPago;
  if (!id || !REGEX.ID.test(id)) {
    return res.status(400).json({
      success: false,
      message: 'ID inválido. Debe ser un número entero positivo.',
      data: null,
      errors: [{ field: 'id', message: 'ID inválido' }]
    });
  }
  next();
}


// ============================================================
// EXPORTAR todo lo que necesitan los demás archivos
// ============================================================
module.exports = {
  REGEX,                 // Para reutilizar los patrones en el frontend
  sanitizeInput,
  validateRegister,
  validateLogin,
  validateProduct,
  validateCartItem,
  validateTicket,
  validateId
};
