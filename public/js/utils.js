// ============================================================
// UTILIDADES COMPARTIDAS - utils.js
// ============================================================
// Este archivo contiene funciones reutilizables que se usan
// en TODAS las páginas del frontend. Se carga antes de cualquier
// otro script específico de página.
//
// ¿POR QUÉ UN ARCHIVO DE UTILIDADES?
// Para evitar duplicar código. Si 5 páginas necesitan hacer
// peticiones a la API, no queremos escribir fetch() con manejo
// de errores 5 veces. Lo escribimos una vez aquí y lo reutilizamos.
//
// CONTENIDO:
// 1. REGEX - Patrones de validación (iguales al backend)
// 2. apiRequest() - Wrapper para peticiones HTTP
// 3. showAlert() - Mostrar alertas Bootstrap dinámicas
// 4. formatCurrency() - Formatear precios en CLP
// 5. loadNavbar() - Construir navbar según sesión del usuario
// 6. redirectIfNotAuth() - Proteger páginas de usuario
// 7. redirectIfNotAdmin() - Proteger páginas de admin
// 8. validateField() - Validación en tiempo real
// 9. getQueryParam() - Leer parámetros de URL
// ============================================================


// ============================================================
// 1. PATRONES REGEX
// ============================================================
// ESTOS PATRONES SON IDÉNTICOS A LOS DEL BACKEND (middleware/validators.js)
// ¿POR QUÉ duplicarlos? Porque el frontend y backend son aplicaciones
// separadas. El frontend valida para dar feedback inmediato al usuario
// (mejor UX), pero el backend TAMBIÉN valida porque no puede confiar
// en el frontend (un atacante puede saltarse la validación del frontend).
//
// IMPORTANTE: Si se modifica un regex aquí, HAY QUE modificarlo
// también en middleware/validators.js y viceversa.
// ============================================================
const REGEX = {
  // Email: formato estándar usuario@dominio.extension
  // Acepta: maria@correo.cl, juan.perez@gmail.com
  // Rechaza: @correo.com, maria@, maria@.com
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,

  // Contraseña: mínimo 8 caracteres con:
  //   - 1 minúscula (a-z)
  //   - 1 mayúscula (A-Z)
  //   - 1 número (0-9)
  //   - 1 carácter especial (@$!%*?&#)
  // Acepta: Admin123!, Clave#Segura1
  // Rechaza: password, 12345678, Admin123 (sin especial)
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/,

  // Nombre: letras (con acentos/ñ), espacios, 2-100 caracteres
  // Acepta: María, José Ñuñez
  // Rechaza: M, Juan123, <script>
  NAME: /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]{2,100}$/,

  // Precio: número positivo con hasta 2 decimales
  // Acepta: 100, 29990, 12.99
  // Rechaza: -10, abc, 12.999
  PRICE: /^\d+(\.\d{1,2})?$/,

  // ID: entero positivo (para parámetros de URL)
  // Acepta: 1, 42, 999
  // Rechaza: 0, -1, 1.5, abc
  ID: /^[1-9]\d*$/,

  // Cantidad: entero positivo para ítems del carrito
  // Acepta: 1, 5, 100
  // Rechaza: 0, -1, 1.5
  QUANTITY: /^[1-9]\d*$/
};


// ============================================================
// 2. apiRequest() - WRAPPER PARA PETICIONES HTTP
// ============================================================
// Función centralizada para hacer peticiones a la API del backend.
// Envuelve fetch() con configuración estándar y manejo de errores.
//
// ¿POR QUÉ un wrapper y no usar fetch() directamente?
// 1. Todas las peticiones necesitan credentials: 'include' (cookies de sesión)
// 2. Todas las peticiones JSON necesitan los mismos headers
// 3. Todas necesitan manejar errores de red y parseo
// 4. Reduce duplicación: en vez de 30 líneas por petición, son 1-2
//
// PARÁMETROS:
//   url    - Ruta de la API (ej: '/api/auth/login')
//   method - Método HTTP ('GET', 'POST', 'PUT', 'DELETE')
//   body   - Objeto a enviar como JSON (null para GET)
//
// RETORNA:
//   El objeto JSON de respuesta del servidor, que siempre tiene:
//   { success: true/false, message: "...", data: {...}, errors: [...] }
//
// LANZA ERROR:
//   Si la red falla o el servidor no responde
// ============================================================
async function apiRequest(url, method = 'GET', body = null) {
  try {
    // Configuración base de la petición
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json' // Siempre enviamos/recibimos JSON
      },
      // credentials: 'include' es CRUCIAL para que el navegador
      // envíe las cookies de sesión (connect.sid) con cada petición.
      // Sin esto, el backend no puede identificar al usuario logueado.
      credentials: 'include'
    };

    // Solo agregar body si no es GET (GET no puede tener body)
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    // Ejecutar la petición HTTP
    const response = await fetch(url, options);

    // Intentar parsear la respuesta como JSON
    // Usamos try/catch por si la respuesta no es JSON válido
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      // Si no se puede parsear, crear una respuesta genérica de error
      throw new Error('Error al procesar la respuesta del servidor');
    }

    // Retornar los datos (incluso si success es false, para que
    // la página que llamó pueda leer los mensajes de error)
    return data;

  } catch (error) {
    // Error de red (servidor caído, sin internet, etc.)
    console.error('Error en apiRequest:', error);
    // Retornar un objeto con el formato estándar de error
    return {
      success: false,
      message: error.message || 'Error de conexión con el servidor',
      data: null,
      errors: null
    };
  }
}


// ============================================================
// 3. showAlert() - MOSTRAR ALERTAS BOOTSTRAP DINÁMICAS
// ============================================================
// Inyecta una alerta Bootstrap dentro de un contenedor HTML.
// Se usa para mostrar mensajes de éxito, error, advertencia, etc.
//
// PARÁMETROS:
//   containerId - ID del elemento donde insertar la alerta (ej: 'alert-container')
//   message     - Texto del mensaje a mostrar
//   type        - Tipo de alerta Bootstrap: 'danger', 'success', 'warning', 'info'
//
// EJEMPLO DE USO:
//   showAlert('login-alerts', 'Email o contraseña incorrectos', 'danger');
//   showAlert('register-alerts', 'Cuenta creada exitosamente', 'success');
// ============================================================
function showAlert(containerId, message, type = 'danger') {
  // Buscar el contenedor donde insertar la alerta
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Contenedor de alertas no encontrado: #${containerId}`);
    return;
  }

  // Elegir icono según el tipo de alerta
  const icons = {
    danger: 'bi-exclamation-triangle-fill',
    success: 'bi-check-circle-fill',
    warning: 'bi-exclamation-circle-fill',
    info: 'bi-info-circle-fill'
  };
  const icon = icons[type] || icons.info;

  // Crear el HTML de la alerta Bootstrap
  // alert-dismissible + btn-close permite cerrarla con la X
  container.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show d-flex align-items-center" role="alert">
      <i class="bi ${icon} me-2"></i>
      <div>${message}</div>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
    </div>
  `;

  // Hacer scroll al contenedor para que el usuario vea la alerta
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}


// ============================================================
// 4. formatCurrency() - FORMATEAR PRECIOS
// ============================================================
// Formatea un número como precio en pesos chilenos (CLP).
// Usa la API nativa Intl.NumberFormat que soporta todos los
// navegadores modernos.
//
// EJEMPLO:
//   formatCurrency(29990) → "$29.990"
//   formatCurrency(1500.5) → "$1.501"
// ============================================================
function formatCurrency(amount) {
  // Asegurarse de que sea un número
  const num = Number(amount);
  if (isNaN(num)) return '$0';

  // Formatear como peso chileno (sin decimales, con separador de miles)
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}


// ============================================================
// 5. loadNavbar() - CONSTRUIR NAVBAR DINÁMICAMENTE
// ============================================================
// Construye el HTML del navbar según si el usuario está logueado
// y cuál es su rol (cliente o admin).
//
// ¿POR QUÉ dinámico y no estático?
// Porque los links del navbar cambian según el estado de sesión:
// - No logueado: ver Catálogo, Login, Registro
// - Cliente: ver Catálogo, Carrito, Mis Pedidos, Soporte, Perfil, Cerrar Sesión
// - Admin: ver Panel Admin, Catálogo, Cerrar Sesión
//
// Esta función se llama en el DOMContentLoaded de CADA página.
// Consulta GET /api/auth/session para saber si hay sesión activa.
//
// Referencia: Imagen 1 - Diagrama de navegación por roles
// ============================================================
async function loadNavbar() {
  // Contenedor donde se inyecta el navbar (existe en todas las páginas)
  const container = document.getElementById('navbar-container');
  if (!container) return;

  // Consultar al backend si hay una sesión activa
  // GET /api/auth/session devuelve { success: true/false, data: { userId, userName, email, rol } }
  let user = null;
  try {
    const response = await apiRequest('/api/auth/session');
    if (response.success && response.data) {
      user = response.data; // { userId, userName, email, rol }
    }
  } catch (error) {
    // Si falla la consulta, asumir que no hay sesión (mostrar navbar público)
    console.warn('No se pudo verificar la sesión:', error);
  }

  // Determinar la ruta base para los links
  // Las páginas están en /pages/ y los links deben apuntar correctamente
  const basePath = '/pages/';
  const adminPath = '/pages/admin/';

  // Construir los links según el estado de sesión y rol
  let navLinks = '';
  let rightLinks = '';

  if (!user) {
    // ============================
    // USUARIO NO LOGUEADO
    // ============================
    // Solo puede ver el catálogo y las páginas de autenticación
    navLinks = `
      <li class="nav-item">
        <a class="nav-link" href="${basePath}catalog.html">
          <i class="bi bi-grid me-1"></i>Catálogo
        </a>
      </li>
    `;
    rightLinks = `
      <li class="nav-item">
        <a class="nav-link" href="${basePath}login.html">
          <i class="bi bi-box-arrow-in-right me-1"></i>Iniciar Sesión
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="${basePath}register.html">
          <i class="bi bi-person-plus me-1"></i>Registro
        </a>
      </li>
    `;

  } else if (user.rol === 'Admin') {
    // ============================
    // ADMINISTRADOR
    // ============================
    // Acceso al panel admin y al catálogo público
    navLinks = `
      <li class="nav-item">
        <a class="nav-link" href="${adminPath}dashboard.html">
          <i class="bi bi-speedometer2 me-1"></i>Panel Admin
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="${basePath}catalog.html">
          <i class="bi bi-grid me-1"></i>Catálogo
        </a>
      </li>
    `;
    rightLinks = `
      <li class="nav-item">
        <span class="nav-link text-warning">
          <i class="bi bi-shield-check me-1"></i>${user.userName || user.nombre}
        </span>
      </li>
      <li class="nav-item">
        <a class="nav-link btn-logout btn btn-sm ms-2" href="#" id="btn-logout">
          <i class="bi bi-box-arrow-right me-1"></i>Cerrar Sesión
        </a>
      </li>
    `;

  } else {
    // ============================
    // CLIENTE LOGUEADO
    // ============================
    // Acceso completo a la tienda: catálogo, carrito, pedidos, soporte, perfil
    navLinks = `
      <li class="nav-item">
        <a class="nav-link" href="${basePath}catalog.html">
          <i class="bi bi-grid me-1"></i>Catálogo
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="${basePath}cart.html">
          <i class="bi bi-cart3 me-1"></i>Carrito
          <span class="badge rounded-pill cart-badge" id="cart-count" style="display:none;">0</span>
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="${basePath}orders.html">
          <i class="bi bi-bag me-1"></i>Mis Pedidos
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="${basePath}support.html">
          <i class="bi bi-headset me-1"></i>Soporte
        </a>
      </li>
    `;
    rightLinks = `
      <li class="nav-item">
        <a class="nav-link" href="${basePath}profile.html">
          <i class="bi bi-person-circle me-1"></i>${user.userName || user.nombre}
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link btn-logout btn btn-sm ms-2" href="#" id="btn-logout">
          <i class="bi bi-box-arrow-right me-1"></i>Cerrar Sesión
        </a>
      </li>
    `;
  }

  // Construir el HTML completo del navbar
  container.innerHTML = `
    <nav class="navbar navbar-expand-lg navbar-custom">
      <div class="container">
        <a class="navbar-brand" href="${basePath}index.html" style="font-weight: 900; letter-spacing: 2px; color: #ffd700 !important;">
          ENSIGNA
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse"
                data-bs-target="#navbarMain" aria-controls="navbarMain"
                aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarMain">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">
            ${navLinks}
          </ul>
          <ul class="navbar-nav ms-auto mb-2 mb-lg-0 align-items-center">
            ${rightLinks}
          </ul>
        </div>
      </div>
    </nav>
  `;

  // Si el usuario está logueado como cliente, cargar el contador del carrito
  if (user && user.rol !== 'Admin') {
    loadCartCount();
  }

  // Agregar evento de cerrar sesión al botón de logout
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}


// ============================================================
// FUNCIÓN: loadCartCount() - CARGAR CONTADOR DEL CARRITO
// ============================================================
// Actualiza el badge del carrito en el navbar con la cantidad
// total de ítems. Se llama cada vez que se carga el navbar
// y cada vez que se modifica el carrito.
// ============================================================
async function loadCartCount() {
  try {
    const response = await apiRequest('/api/carrito');
    if (response.success && response.data) {
      const items = Array.isArray(response.data) ? response.data : (response.data.items || []);
      const count = items.length;
      const badge = document.getElementById('cart-count');
      if (badge) {
        if (count > 0) {
          badge.textContent = count;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    }
  } catch (error) {
    console.warn('No se pudo cargar el contador del carrito:', error);
  }
}


// ============================================================
// FUNCIÓN: handleLogout() - CERRAR SESIÓN
// ============================================================
// Envía POST /api/auth/logout para destruir la sesión en el
// servidor, luego redirige a la página de login.
// ============================================================
async function handleLogout(event) {
  event.preventDefault(); // Evitar navegación del link

  try {
    const response = await apiRequest('/api/auth/logout', 'POST');
    // Redirigir al login independientemente del resultado
    // porque si falla, la sesión probablemente ya expiró
    window.location.href = '/pages/login.html';
  } catch (error) {
    window.location.href = '/pages/login.html';
  }
}


// ============================================================
// 6. redirectIfNotAuth() - PROTEGER PÁGINAS DE USUARIO
// ============================================================
// Verifica si hay una sesión activa. Si no la hay, redirige
// al login. Se usa en páginas que requieren autenticación:
// carrito, pedidos, soporte, perfil, checkout.
//
// RETORNA: Los datos del usuario si está autenticado, null si no.
// ============================================================
async function redirectIfNotAuth() {
  try {
    const response = await apiRequest('/api/auth/session');
    if (response.success && response.data) {
      return response.data; // Usuario autenticado
    }
  } catch (error) {
    // Error de red, redirigir al login
  }
  // No hay sesión → redirigir al login
  window.location.href = '/pages/login.html';
  return null;
}


// ============================================================
// 7. redirectIfNotAdmin() - PROTEGER PÁGINAS DE ADMIN
// ============================================================
// Verifica que el usuario tenga rol de 'Admin'. Si no,
// redirige al catálogo. Se usa en todas las páginas admin/.
//
// RETORNA: Los datos del usuario si es admin, null si no.
// ============================================================
async function redirectIfNotAdmin() {
  try {
    const response = await apiRequest('/api/auth/session');
    if (response.success && response.data && response.data.rol === 'Admin') {
      return response.data; // Es admin
    }
  } catch (error) {
    // Error de red
  }
  // No es admin → redirigir al catálogo
  window.location.href = '/pages/catalog.html';
  return null;
}


// ============================================================
// 8. validateField() - VALIDACIÓN EN TIEMPO REAL
// ============================================================
// Valida un campo de formulario contra un patrón regex y
// actualiza las clases CSS de Bootstrap (.is-valid, .is-invalid)
// para dar feedback visual inmediato al usuario.
//
// PARÁMETROS:
//   input      - El elemento <input> del DOM
//   regex      - El patrón regex a evaluar
//   errorMsg   - Mensaje de error a mostrar si no cumple
//
// RETORNA: true si es válido, false si no.
//
// EJEMPLO DE USO:
//   const emailInput = document.getElementById('email');
//   emailInput.addEventListener('input', () => {
//     validateField(emailInput, REGEX.EMAIL, 'Formato de email inválido');
//   });
// ============================================================
function validateField(input, regex, errorMsg) {
  const value = input.value.trim();

  // Buscar el div de mensaje de validación (hermano siguiente del input)
  // Este div tiene la clase .validation-message
  const messageDiv = input.parentElement.querySelector('.validation-message');

  if (value === '') {
    // Campo vacío: quitar todas las clases de validación
    input.classList.remove('is-valid', 'is-invalid');
    if (messageDiv) {
      messageDiv.textContent = '';
      messageDiv.style.display = 'none';
    }
    return false;
  }

  if (regex.test(value)) {
    // Válido: poner borde verde
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
    if (messageDiv) {
      messageDiv.textContent = 'Válido';
      messageDiv.style.display = 'block';
      messageDiv.style.color = 'var(--color-success, #28a745)';
    }
    return true;
  } else {
    // Inválido: poner borde rojo y mostrar mensaje de error
    input.classList.remove('is-valid');
    input.classList.add('is-invalid');
    if (messageDiv) {
      messageDiv.textContent = errorMsg;
      messageDiv.style.display = 'block';
      messageDiv.style.color = 'var(--color-danger, #dc3545)';
    }
    return false;
  }
}


// ============================================================
// 9. getQueryParam() - LEER PARÁMETROS DE URL
// ============================================================
// Extrae un parámetro de la URL actual (query string).
// Se usa para leer IDs de productos, pedidos, etc.
//
// EJEMPLO:
//   URL: /pages/product.html?id=42
//   getQueryParam('id') → "42"
//
//   URL: /pages/catalog.html?page=2&categoria=Camisetas
//   getQueryParam('page') → "2"
//   getQueryParam('categoria') → "Camisetas"
// ============================================================
function getQueryParam(name) {
  // URLSearchParams es la API moderna del navegador para parsear
  // query strings. Maneja la decodificación de caracteres especiales.
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}


// ============================================================
// 10. getStatusBadgeClass() - OBTENER CLASE CSS DEL BADGE
// ============================================================
// Retorna la clase CSS correspondiente al estado de un pedido
// o ticket, para mostrar el badge del color correcto.
//
// EJEMPLO:
//   getStatusBadgeClass('Pendiente') → 'badge-pendiente'
//   getStatusBadgeClass('Cancelado') → 'badge-cancelado'
// ============================================================
function getStatusBadgeClass(status) {
  // Mapa de estados a clases CSS (definidas en styles.css)
  const statusMap = {
    // Estados de pedidos
    'Pendiente': 'badge-pendiente',
    'Pagado': 'badge-pagado',
    'Enviado': 'badge-enviado',
    'Entregado': 'badge-entregado',
    'Cancelado': 'badge-cancelado',
    // Estados de tickets
    'Abierto': 'badge-abierto',
    'En Proceso': 'badge-en-proceso',
    'Resuelto': 'badge-resuelto',
    'Cerrado': 'badge-cerrado'
  };

  return statusMap[status] || 'bg-secondary'; // Fallback: gris
}


// ============================================================
// 11. debounce() - RETRASAR EJECUCIÓN DE FUNCIÓN
// ============================================================
// Crea una versión "retrasada" de una función que solo se
// ejecuta después de que el usuario deja de invocarla por
// un tiempo determinado (delay en ms).
//
// ¿PARA QUÉ SIRVE?
// Para la búsqueda en el catálogo. Sin debounce, cada letra
// que el usuario escribe dispararía una petición al servidor.
// Con debounce, solo se busca cuando el usuario deja de escribir
// por 300ms, reduciendo las peticiones innecesarias.
//
// EJEMPLO:
//   const buscarProductos = debounce((query) => {
//     apiRequest(`/api/productos/buscar?q=${query}`);
//   }, 300);
//   searchInput.addEventListener('input', (e) => buscarProductos(e.target.value));
// ============================================================
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    // Si hay un timer pendiente, cancelarlo
    clearTimeout(timeoutId);
    // Iniciar un nuevo timer
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}


// ============================================================
// 12. formatDate() - FORMATEAR FECHAS
// ============================================================
// Convierte una fecha ISO del servidor a formato legible en
// español chileno.
//
// EJEMPLO:
//   formatDate('2024-01-15T14:30:00Z') → '15/01/2024 11:30'
// ============================================================
function formatDate(isoString) {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}


// ============================================================
// 13. setButtonLoading() / resetButton() - ESTADO DE CARGA
// ============================================================
// Cambia un botón a estado de carga (deshabilitado con spinner)
// y luego lo restaura. Evita que el usuario haga doble click
// mientras se procesa una petición.
// ============================================================
function setButtonLoading(button, loadingText = 'Procesando...') {
  // Guardar el texto original para restaurarlo después
  button.dataset.originalText = button.innerHTML;
  button.innerHTML = `
    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
    ${loadingText}
  `;
  button.disabled = true;
}

function resetButton(button) {
  // Restaurar el texto original guardado en dataset
  if (button.dataset.originalText) {
    button.innerHTML = button.dataset.originalText;
  }
  button.disabled = false;
}
