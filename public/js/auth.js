// ============================================================
// AUTH.JS - LÓGICA DE AUTENTICACIÓN DEL FRONTEND
// ============================================================
// Maneja los formularios de: Login, Registro, Recuperar Contraseña
// y Editar Perfil.
//
// DEPENDE DE: utils.js (debe cargarse antes que este archivo)
//   - REGEX: patrones de validación
//   - apiRequest(): peticiones HTTP
//   - showAlert(): alertas Bootstrap
//   - validateField(): validación en tiempo real
//   - setButtonLoading() / resetButton(): estados de botón
//
// ¿CÓMO FUNCIONA LA AUTENTICACIÓN?
// 1. El usuario envía email + contraseña al backend
// 2. El backend verifica los datos y crea una SESIÓN
// 3. El backend envía una cookie (connect.sid) al navegador
// 4. En cada petición posterior, el navegador envía esa cookie
// 5. El backend usa la cookie para saber quién es el usuario
//
// Referencia: Imagen 2 - Diagrama de flujo de autenticación
// ============================================================


// ============================================================
// INICIALIZACIÓN AL CARGAR LA PÁGINA
// ============================================================
// Se ejecuta cuando el DOM está listo. Detecta en qué página
// estamos y activa los formularios correspondientes.
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Detectar qué formulario existe en la página actual
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const recoverForm = document.getElementById('recover-form');
  const profileForm = document.getElementById('profile-form');

  // Inicializar el formulario que corresponda
  if (loginForm) initLogin(loginForm);
  if (registerForm) initRegister(registerForm);
  if (recoverForm) initRecover(recoverForm);
  if (profileForm) initProfile(profileForm);
});


// ============================================================
// FUNCIÓN: initLogin() - INICIALIZAR FORMULARIO DE LOGIN
// ============================================================
// Configura la validación en tiempo real y el envío del
// formulario de inicio de sesión.
//
// Endpoint: POST /api/auth/login
// Body: { email, contrasena }
// Éxito: Redirige al catálogo
// Error: Muestra mensaje de error
// ============================================================
function initLogin(form) {
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');

  // ---------------------------------------------------------
  // VALIDACIÓN EN TIEMPO REAL
  // ---------------------------------------------------------
  // Escuchamos el evento 'input' que se dispara cada vez que
  // el usuario escribe o borra un carácter.
  // Esto da feedback inmediato (borde verde o rojo).
  // ---------------------------------------------------------
  if (emailInput) {
    emailInput.addEventListener('input', () => {
      validateField(emailInput, REGEX.EMAIL, 'Formato de email inválido. Ej: usuario@correo.com');
    });
  }

  // Para el login, la contraseña no necesita validación de formato
  // (no queremos revelar las reglas de seguridad a un atacante),
  // solo verificamos que no esté vacío.

  // ---------------------------------------------------------
  // ENVÍO DEL FORMULARIO
  // ---------------------------------------------------------
  form.addEventListener('submit', async (event) => {
    // Prevenir el comportamiento default del formulario (recargar la página)
    event.preventDefault();

    const email = emailInput.value.trim();
    const contrasena = passwordInput.value;

    // Validar que los campos no estén vacíos
    if (!email || !contrasena) {
      showAlert('login-alerts', 'Por favor completa todos los campos.', 'warning');
      return;
    }

    // Validar formato de email
    if (!REGEX.EMAIL.test(email)) {
      showAlert('login-alerts', 'Formato de email inválido.', 'danger');
      return;
    }

    // Obtener referencia al botón y ponerlo en estado de carga
    const submitBtn = form.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, 'Iniciando sesión...');

    try {
      // Enviar petición al backend
      const response = await apiRequest('/api/auth/login', 'POST', {
        email,
        contrasena
      });

      if (response.success) {
        // Login exitoso → mostrar mensaje y redirigir al catálogo
        showAlert('login-alerts', '¡Bienvenido! Redirigiendo...', 'success');
        setTimeout(() => {
          window.location.href = '/pages/catalog.html';
        }, 1000);
      } else {
        // Error del servidor (credenciales incorrectas, etc.)
        const errorMsg = response.message || 'Email o contraseña incorrectos.';
        showAlert('login-alerts', errorMsg, 'danger');
        resetButton(submitBtn);
      }
    } catch (error) {
      showAlert('login-alerts', 'Error de conexión. Inténtalo de nuevo.', 'danger');
      resetButton(submitBtn);
    }
  });
}


// ============================================================
// FUNCIÓN: initRegister() - INICIALIZAR FORMULARIO DE REGISTRO
// ============================================================
// Configura validación en tiempo real, indicador de fortaleza
// de contraseña y envío del formulario de registro.
//
// Endpoint: POST /api/auth/registro
// Body: { email, nombre, contrasena }
// Éxito: Redirige al login con mensaje de éxito
// Error: Muestra errores de validación
// ============================================================
function initRegister(form) {
  const emailInput = document.getElementById('register-email');
  const nameInput = document.getElementById('register-name');
  const passwordInput = document.getElementById('register-password');
  const confirmPasswordInput = document.getElementById('register-confirm-password');

  // ---------------------------------------------------------
  // VALIDACIÓN EN TIEMPO REAL DE CADA CAMPO
  // ---------------------------------------------------------
  if (emailInput) {
    emailInput.addEventListener('input', () => {
      validateField(emailInput, REGEX.EMAIL, 'Formato de email inválido. Ej: usuario@correo.com');
    });
  }

  if (nameInput) {
    nameInput.addEventListener('input', () => {
      validateField(nameInput, REGEX.NAME, 'Solo letras y espacios, 2-100 caracteres.');
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      validateField(passwordInput, REGEX.PASSWORD,
        'Mínimo 8 caracteres: 1 mayúscula, 1 minúscula, 1 número y 1 especial (@$!%*?&#)');
      // Actualizar el indicador de fortaleza
      updatePasswordStrength(passwordInput.value);
      // Si ya escribió en confirmar, revalidar la coincidencia
      if (confirmPasswordInput && confirmPasswordInput.value) {
        validatePasswordMatch(passwordInput, confirmPasswordInput);
      }
    });
  }

  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('input', () => {
      validatePasswordMatch(passwordInput, confirmPasswordInput);
    });
  }

  // ---------------------------------------------------------
  // ENVÍO DEL FORMULARIO DE REGISTRO
  // ---------------------------------------------------------
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const nombre = nameInput.value.trim();
    const contrasena = passwordInput.value;
    const confirmar = confirmPasswordInput.value;

    // Validaciones del lado del cliente
    let hasErrors = false;

    if (!email || !REGEX.EMAIL.test(email)) {
      showAlert('register-alerts', 'Formato de email inválido.', 'danger');
      hasErrors = true;
    }

    if (!nombre || !REGEX.NAME.test(nombre)) {
      showAlert('register-alerts', 'Nombre inválido. Solo letras y espacios, 2-100 caracteres.', 'danger');
      hasErrors = true;
    }

    if (!contrasena || !REGEX.PASSWORD.test(contrasena)) {
      showAlert('register-alerts', 'La contraseña no cumple los requisitos de seguridad.', 'danger');
      hasErrors = true;
    }

    if (contrasena !== confirmar) {
      showAlert('register-alerts', 'Las contraseñas no coinciden.', 'danger');
      hasErrors = true;
    }

    if (hasErrors) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, 'Creando cuenta...');

    try {
      const response = await apiRequest('/api/auth/registro', 'POST', {
        email,
        nombre,
        contrasena
      });

      if (response.success) {
        // Registro exitoso → redirigir al login
        showAlert('register-alerts', '¡Cuenta creada exitosamente! Redirigiendo al login...', 'success');
        setTimeout(() => {
          window.location.href = '/pages/login.html';
        }, 2000);
      } else {
        // Mostrar errores del servidor
        if (response.errors && response.errors.length > 0) {
          // Mostrar el primer error específico
          const errorMessages = response.errors.map(e => e.message).join('<br>');
          showAlert('register-alerts', errorMessages, 'danger');
        } else {
          showAlert('register-alerts', response.message || 'Error al crear la cuenta.', 'danger');
        }
        resetButton(submitBtn);
      }
    } catch (error) {
      showAlert('register-alerts', 'Error de conexión. Inténtalo de nuevo.', 'danger');
      resetButton(submitBtn);
    }
  });
}


// ============================================================
// FUNCIÓN: initRecover() - INICIALIZAR RECUPERACIÓN DE CONTRASEÑA
// ============================================================
// Formulario simple: el usuario ingresa su email y el backend
// envía un enlace de recuperación (en un proyecto real, enviaría
// un correo electrónico).
//
// Endpoint: POST /api/auth/recuperar
// Body: { email }
// ============================================================
function initRecover(form) {
  const emailInput = document.getElementById('recover-email');

  if (emailInput) {
    emailInput.addEventListener('input', () => {
      validateField(emailInput, REGEX.EMAIL, 'Formato de email inválido.');
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();

    if (!email || !REGEX.EMAIL.test(email)) {
      showAlert('recover-alerts', 'Ingresa un email válido.', 'danger');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, 'Enviando...');

    try {
      const response = await apiRequest('/api/auth/recuperar', 'POST', { email });

      if (response.success) {
        showAlert('recover-alerts',
          'Si el email está registrado, recibirás instrucciones para recuperar tu contraseña.',
          'success');
      } else {
        // Por seguridad, mostramos un mensaje genérico (no revelamos si el email existe)
        showAlert('recover-alerts',
          'Si el email está registrado, recibirás instrucciones para recuperar tu contraseña.',
          'info');
      }
      resetButton(submitBtn);
    } catch (error) {
      showAlert('recover-alerts', 'Error de conexión. Inténtalo de nuevo.', 'danger');
      resetButton(submitBtn);
    }
  });
}


// ============================================================
// FUNCIÓN: initProfile() - INICIALIZAR EDICIÓN DE PERFIL
// ============================================================
// Carga los datos del usuario actual y permite editarlos.
// El usuario puede cambiar su nombre y/o contraseña.
//
// Endpoints:
//   GET /api/auth/perfil → cargar datos actuales
//   PUT /api/auth/perfil → guardar cambios
// Body: { nombre, contrasena_actual, contrasena_nueva }
// ============================================================
async function initProfile(form) {
  const nameInput = document.getElementById('profile-name');
  const emailDisplay = document.getElementById('profile-email');
  const currentPasswordInput = document.getElementById('profile-current-password');
  const newPasswordInput = document.getElementById('profile-new-password');

  // Cargar datos actuales del perfil
  try {
    const response = await apiRequest('/api/auth/perfil');
    if (response.success && response.data) {
      // Mostrar los datos actuales en el formulario
      if (nameInput) nameInput.value = response.data.nombre || '';
      if (emailDisplay) emailDisplay.value = response.data.email || '';
    }
  } catch (error) {
    showAlert('profile-alerts', 'Error al cargar los datos del perfil.', 'danger');
  }

  // Validación en tiempo real del nombre
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      validateField(nameInput, REGEX.NAME, 'Solo letras y espacios, 2-100 caracteres.');
    });
  }

  // Validación de la nueva contraseña (solo si la escribe)
  if (newPasswordInput) {
    newPasswordInput.addEventListener('input', () => {
      if (newPasswordInput.value) {
        validateField(newPasswordInput, REGEX.PASSWORD,
          'Mínimo 8 caracteres: 1 mayúscula, 1 minúscula, 1 número y 1 especial.');
        updatePasswordStrength(newPasswordInput.value);
      } else {
        newPasswordInput.classList.remove('is-valid', 'is-invalid');
      }
    });
  }

  // Envío del formulario
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const nombre = nameInput.value.trim();
    const contrasena_actual = currentPasswordInput ? currentPasswordInput.value : '';
    const contrasena_nueva = newPasswordInput ? newPasswordInput.value : '';

    // Validar nombre
    if (!nombre || !REGEX.NAME.test(nombre)) {
      showAlert('profile-alerts', 'Nombre inválido.', 'danger');
      return;
    }

    // Si quiere cambiar contraseña, ambos campos son obligatorios
    if (contrasena_nueva && !contrasena_actual) {
      showAlert('profile-alerts', 'Debes ingresar tu contraseña actual para cambiarla.', 'warning');
      return;
    }

    if (contrasena_nueva && !REGEX.PASSWORD.test(contrasena_nueva)) {
      showAlert('profile-alerts', 'La nueva contraseña no cumple los requisitos.', 'danger');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, 'Guardando...');

    // Construir body dinámicamente (solo enviar lo que cambió)
    const body = { nombre };
    if (contrasena_actual && contrasena_nueva) {
      body.contrasena_actual = contrasena_actual;
      body.contrasena_nueva = contrasena_nueva;
    }

    try {
      const response = await apiRequest('/api/auth/perfil', 'PUT', body);

      if (response.success) {
        showAlert('profile-alerts', 'Perfil actualizado exitosamente.', 'success');
        // Limpiar campos de contraseña
        if (currentPasswordInput) currentPasswordInput.value = '';
        if (newPasswordInput) newPasswordInput.value = '';
      } else {
        showAlert('profile-alerts', response.message || 'Error al actualizar el perfil.', 'danger');
      }
      resetButton(submitBtn);
    } catch (error) {
      showAlert('profile-alerts', 'Error de conexión.', 'danger');
      resetButton(submitBtn);
    }
  });
}


// ============================================================
// FUNCIÓN: updatePasswordStrength() - INDICADOR DE FORTALEZA
// ============================================================
// Analiza la contraseña y actualiza visualmente la barra de
// fortaleza. Evalúa 4 criterios:
// 1. Longitud >= 8
// 2. Tiene mayúsculas y minúsculas
// 3. Tiene números
// 4. Tiene caracteres especiales
//
// La barra se colorea según el puntaje:
// 0-1: Débil (rojo), 2: Regular (naranja), 3: Buena (amarillo), 4: Fuerte (verde)
// ============================================================
function updatePasswordStrength(password) {
  const strengthBar = document.querySelector('.password-strength-bar');
  const strengthText = document.querySelector('.password-strength-text');

  if (!strengthBar || !strengthText) return;

  // Evaluar cada criterio
  let score = 0;
  if (password.length >= 8) score++;                          // Criterio 1: longitud
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++; // Criterio 2: may+min
  if (/\d/.test(password)) score++;                            // Criterio 3: números
  if (/[@$!%*?&#]/.test(password)) score++;                    // Criterio 4: especiales

  // Definir niveles de fortaleza
  const levels = [
    { className: '', text: '', color: '' },                        // 0: sin contraseña
    { className: 'strength-weak', text: 'Débil', color: '#dc3545' },        // 1
    { className: 'strength-fair', text: 'Regular', color: '#fd7e14' },      // 2
    { className: 'strength-good', text: 'Buena', color: '#ffc107' },        // 3
    { className: 'strength-strong', text: '¡Fuerte!', color: '#28a745' }    // 4
  ];

  const level = levels[score] || levels[0];

  // Actualizar las clases de la barra
  strengthBar.className = 'password-strength-bar ' + level.className;
  strengthText.textContent = password ? `Fortaleza: ${level.text}` : '';
  strengthText.style.color = level.color;
}


// ============================================================
// FUNCIÓN: validatePasswordMatch() - VERIFICAR COINCIDENCIA
// ============================================================
// Compara la contraseña con su confirmación y actualiza el
// feedback visual. Se usa en el registro y cambio de contraseña.
// ============================================================
function validatePasswordMatch(passwordInput, confirmInput) {
  const messageDiv = confirmInput.parentElement.querySelector('.validation-message');

  if (!confirmInput.value) {
    confirmInput.classList.remove('is-valid', 'is-invalid');
    if (messageDiv) messageDiv.style.display = 'none';
    return false;
  }

  if (passwordInput.value === confirmInput.value) {
    confirmInput.classList.remove('is-invalid');
    confirmInput.classList.add('is-valid');
    if (messageDiv) {
      messageDiv.textContent = 'Las contraseñas coinciden';
      messageDiv.style.display = 'block';
      messageDiv.style.color = '#28a745';
    }
    return true;
  } else {
    confirmInput.classList.remove('is-valid');
    confirmInput.classList.add('is-invalid');
    if (messageDiv) {
      messageDiv.textContent = 'Las contraseñas no coinciden';
      messageDiv.style.display = 'block';
      messageDiv.style.color = '#dc3545';
    }
    return false;
  }
}
