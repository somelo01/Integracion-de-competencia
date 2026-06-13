// ============================================================
// SUPPORT.JS - LÓGICA DE SOPORTE Y TICKETS
// ============================================================
// Maneja la página support.html que tiene dos secciones:
//   1. Formulario para crear un nuevo ticket de soporte
//   2. Lista de tickets existentes del usuario
//
// TIPOS DE TICKET:
//   - Consulta: pregunta general
//   - Reembolso: solicitud de devolución (requiere ID de pedido)
//   - Problema Técnico: error en la plataforma
//   - Otro: cualquier otro tema
//
// DEPENDE DE: utils.js
//
// ENDPOINTS USADOS:
//   POST /api/soporte/crear → crear un ticket
//   GET  /api/soporte       → lista de tickets del usuario
//   GET  /api/soporte/:id   → detalle de un ticket
//
// Referencia: Imagen 7 - Diagrama del sistema de soporte
// ============================================================


// ============================================================
// INICIALIZACIÓN AL CARGAR LA PÁGINA
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar autenticación
  const user = await redirectIfNotAuth();
  if (!user) return;

  // Cargar navbar
  await loadNavbar();

  // Inicializar el formulario de soporte
  initSupportForm();

  // Cargar tickets existentes del usuario
  loadTickets();

  // Pre-llenar datos si vienen de una redirección
  // (ej: desde el detalle de un pedido para solicitar reembolso)
  prefillFromUrl();
});


// ============================================================
// FUNCIÓN: initSupportForm() - INICIALIZAR FORMULARIO
// ============================================================
// Configura el formulario de creación de ticket con:
// - Selector de tipo (muestra/oculta campo de pedido)
// - Validación de campos
// - Envío del formulario
// ============================================================
function initSupportForm() {
  const form = document.getElementById('support-form');
  if (!form) return;

  const tipoSelect = document.getElementById('support-tipo');
  const pedidoGroup = document.getElementById('pedido-group');

  // ---------------------------------------------------------
  // EVENTO: Cambiar tipo de ticket
  // ---------------------------------------------------------
  // Si el tipo es "Reembolso", mostrar el campo de selección
  // de pedido (obligatorio para reembolsos).
  // Para otros tipos, ocultarlo.
  // ---------------------------------------------------------
  if (tipoSelect) {
    tipoSelect.addEventListener('change', () => {
      if (tipoSelect.value === 'Reembolso') {
        if (pedidoGroup) pedidoGroup.style.display = 'block';
        // Cargar la lista de pedidos del usuario
        loadUserOrdersForSelect();
      } else {
        if (pedidoGroup) pedidoGroup.style.display = 'none';
      }
    });
  }

  // ---------------------------------------------------------
  // ENVÍO DEL FORMULARIO
  // ---------------------------------------------------------
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const asunto = document.getElementById('support-asunto')?.value.trim();
    const tipo = document.getElementById('support-tipo')?.value;
    const comentarios = document.getElementById('support-comentarios')?.value.trim();
    const idPedido = document.getElementById('support-pedido')?.value;

    // Validar campos obligatorios
    if (!asunto || asunto.length < 5) {
      showAlert('support-alerts', 'El asunto debe tener al menos 5 caracteres.', 'warning');
      return;
    }

    if (!tipo) {
      showAlert('support-alerts', 'Selecciona un tipo de ticket.', 'warning');
      return;
    }

    // Si es reembolso, el pedido es obligatorio
    if (tipo === 'Reembolso' && !idPedido) {
      showAlert('support-alerts', 'Para un reembolso, debes seleccionar un pedido.', 'warning');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, 'Enviando ticket...');

    // Construir el body de la petición
    const body = {
      asunto: asunto,
      tipo: tipo,
      comentarios: comentarios || ''
    };

    // Solo incluir id_pedido si es reembolso
    if (tipo === 'Reembolso' && idPedido) {
      body.id_pedido = parseInt(idPedido);
    }

    try {
      const response = await apiRequest('/api/soporte/crear', 'POST', body);

      if (response.success) {
        showAlert('support-alerts', '¡Ticket creado exitosamente! Te responderemos pronto.', 'success');
        form.reset(); // Limpiar el formulario
        if (pedidoGroup) pedidoGroup.style.display = 'none';
        // Recargar la lista de tickets para incluir el nuevo
        loadTickets();
      } else {
        const errorMsg = response.errors
          ? response.errors.map(e => e.message).join('<br>')
          : (response.message || 'Error al crear el ticket.');
        showAlert('support-alerts', errorMsg, 'danger');
      }
      resetButton(submitBtn);
    } catch (error) {
      showAlert('support-alerts', 'Error de conexión. Inténtalo de nuevo.', 'danger');
      resetButton(submitBtn);
    }
  });
}


// ============================================================
// FUNCIÓN: loadUserOrdersForSelect() - CARGAR PEDIDOS PARA SELECT
// ============================================================
// Carga los pedidos del usuario y los pone como opciones en
// el <select> de pedido (para reembolsos).
//
// Endpoint: GET /api/pedidos
// ============================================================
async function loadUserOrdersForSelect() {
  const selectElement = document.getElementById('support-pedido');
  if (!selectElement) return;

  // Limpiar opciones existentes (excepto la primera "Selecciona")
  selectElement.innerHTML = '<option value="">Selecciona un pedido...</option>';

  try {
    const response = await apiRequest('/api/pedidos');

    if (response.success && response.data) {
      const orders = Array.isArray(response.data) ? response.data : (response.data.pedidos || []);

      orders.forEach(order => {
        const option = document.createElement('option');
        option.value = order.id_pedido || order.id;
        option.textContent = `Pedido #${order.id_pedido || order.id} - ${formatCurrency(order.total)} - ${order.estado}`;
        selectElement.appendChild(option);
      });
    }
  } catch (error) {
    console.warn('No se pudieron cargar los pedidos:', error);
  }
}


// ============================================================
// FUNCIÓN: loadTickets() - CARGAR LISTA DE TICKETS
// ============================================================
// Obtiene todos los tickets de soporte del usuario y los
// muestra en una tabla/lista con estado coloreado.
//
// Endpoint: GET /api/soporte
// ============================================================
async function loadTickets() {
  const container = document.getElementById('tickets-list');
  if (!container) return;

  try {
    const response = await apiRequest('/api/soporte');

    if (response.success && response.data) {
      const tickets = Array.isArray(response.data) ? response.data : [];

      if (tickets.length === 0) {
        container.innerHTML = `
          <div class="text-center py-4 text-muted">
            <i class="bi bi-chat-dots" style="font-size: 2rem;"></i>
            <p class="mt-2">No tienes tickets de soporte aún.</p>
          </div>
        `;
        return;
      }

      // Renderizar cada ticket como una tarjeta
      container.innerHTML = tickets.map(ticket => `
        <div class="card mb-3 cursor-pointer" onclick="toggleTicketDetail(${ticket.id_ticket || ticket.id})">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h6 class="card-title mb-1">
                  <i class="bi bi-ticket-detailed me-1"></i>
                  #${ticket.id_ticket || ticket.id} - ${ticket.asunto}
                </h6>
                <small class="text-muted">
                  ${ticket.tipo || 'General'} • ${formatDate(ticket.fecha_creacion || ticket.createdAt)}
                </small>
              </div>
              <span class="badge ${getStatusBadgeClass(ticket.estado)}">
                ${ticket.estado}
              </span>
            </div>

            <!-- Detalle expandible del ticket -->
            <div id="ticket-detail-${ticket.id_ticket || ticket.id}" style="display:none;" class="mt-3 pt-3 border-top">
              <p><strong>Comentarios:</strong></p>
              <p class="text-muted">${ticket.comentarios || 'Sin comentarios.'}</p>

              ${ticket.respuesta_admin ? `
                <div class="alert alert-info mt-2">
                  <strong><i class="bi bi-reply me-1"></i>Respuesta del administrador:</strong>
                  <p class="mb-0 mt-1">${ticket.respuesta_admin}</p>
                </div>
              ` : ''}

              ${ticket.id_pedido ? `
                <p><small class="text-muted">Pedido asociado: #${ticket.id_pedido}</small></p>
              ` : ''}
            </div>
          </div>
        </div>
      `).join('');

    } else {
      container.innerHTML = `
        <div class="text-center py-4 text-muted">
          <p>Error al cargar los tickets.</p>
        </div>
      `;
    }
  } catch (error) {
    container.innerHTML = `
      <div class="text-center py-4 text-danger">
        <p>Error de conexión al cargar los tickets.</p>
      </div>
    `;
  }
}


// ============================================================
// FUNCIÓN: toggleTicketDetail() - EXPANDIR/COLAPSAR TICKET
// ============================================================
// Muestra u oculta el detalle de un ticket al hacer click.
// Es una alternativa simple a un accordion de Bootstrap.
// ============================================================
function toggleTicketDetail(ticketId) {
  const detail = document.getElementById(`ticket-detail-${ticketId}`);
  if (detail) {
    // Toggle de display: none <-> block
    detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
  }
}


// ============================================================
// FUNCIÓN: prefillFromUrl() - PRE-LLENAR DESDE URL
// ============================================================
// Si el usuario llega desde un pedido (ej: botón "Solicitar
// reembolso"), la URL trae parámetros para pre-llenar el form:
// /pages/support.html?tipo=Reembolso&pedido=42
// ============================================================
function prefillFromUrl() {
  const tipo = getQueryParam('tipo');
  const pedido = getQueryParam('pedido');

  if (tipo) {
    const tipoSelect = document.getElementById('support-tipo');
    if (tipoSelect) {
      tipoSelect.value = tipo;
      // Disparar el evento change para que muestre el campo de pedido si es Reembolso
      tipoSelect.dispatchEvent(new Event('change'));
    }
  }

  if (pedido) {
    // Esperar a que se carguen los pedidos, luego seleccionar el correcto
    setTimeout(() => {
      const pedidoSelect = document.getElementById('support-pedido');
      if (pedidoSelect) {
        pedidoSelect.value = pedido;
      }
    }, 1000);
  }
}
