// utils.js - funciones compartidas para todo el frontend.
// Contiene validación, peticiones, alertas, formato, navegación y redirecciones.


// Patrones regex para validar formularios en el frontend.
// Están alineados con el backend para mantener reglas similares.
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


// apiRequest() simplifica llamadas a la API con fetch, headers JSON y cookies.
// Retorna el JSON del servidor o un objeto de error estándar.
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


// Muestra una alerta Bootstrap en un contenedor.
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


// Formatea un número como precio en pesos chilenos.
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


// Construye el navbar según el usuario y su rol.
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
    // Usuario no logueado: catálogo y autenticación.
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
    // Admin: panel y catálogo.
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
    // Cliente logueado: tienda completa.
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


// Actualiza el contador del carrito en el navbar.
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


// Cierra sesión y redirige al login.
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


// Redirige al login si no hay sesión activa.
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


// Redirige al catálogo si el usuario no es admin.
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


// Valida un campo contra un regex y actualiza clases de Bootstrap.
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


// Lee un parámetro de la URL actual.
function getQueryParam(name) {
  // URLSearchParams es la API moderna del navegador para parsear
  // query strings. Maneja la decodificación de caracteres especiales.
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}


// Devuelve la clase CSS según el estado de pedido o ticket.
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


// Crea una versión con retraso de una función.
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


// Formatea una fecha ISO a formato chileno legible.
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


// Cambia un botón a estado de carga y lo restaura.
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
