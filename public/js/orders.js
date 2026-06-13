// ============================================================
// ORDERS.JS - LÓGICA DE PEDIDOS DEL USUARIO
// ============================================================
// Maneja dos páginas:
//   1. orders.html       → Lista de pedidos del usuario
//   2. order-detail.html → Detalle de un pedido específico
//
// DEPENDE DE: utils.js (apiRequest, showAlert, formatCurrency,
//             getQueryParam, getStatusBadgeClass, formatDate)
//
// ENDPOINTS USADOS:
//   GET /api/pedidos?page=N      → lista paginada de pedidos
//   GET /api/pedidos/:id         → detalle de un pedido
//   PUT /api/pedidos/:id/cancelar → cancelar un pedido
//
// Referencia: Imagen 5 - Diagrama de estados de pedidos
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

  // Detectar si estamos en la lista de pedidos o en el detalle
  const ordersList = document.getElementById('orders-list');
  const orderDetail = document.getElementById('order-detail');

  if (ordersList) {
    loadOrders();
  }

  if (orderDetail) {
    loadOrderDetail();
  }
});


// ============================================================
// VARIABLE: Página actual de pedidos
// ============================================================
let ordersPage = 1;


// ============================================================
// FUNCIÓN: loadOrders() - CARGAR LISTA DE PEDIDOS
// ============================================================
// Obtiene todos los pedidos del usuario autenticado y los
// muestra en una tabla con: ID, fecha, estado, total y acciones.
//
// Endpoint: GET /api/pedidos?page=N
// ============================================================
async function loadOrders() {
  const tableBody = document.getElementById('orders-body');
  if (!tableBody) return;

  // Spinner de carga
  tableBody.innerHTML = `
    <tr>
      <td colspan="5" class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Cargando pedidos...</span>
        </div>
      </td>
    </tr>
  `;

  try {
    const response = await apiRequest(`/api/pedidos?page=${ordersPage}`);

    if (response.success && response.data) {
      const orders = Array.isArray(response.data) ? response.data : (response.data.pedidos || []);

      if (orders.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center py-4">
              <i class="bi bi-bag" style="font-size: 3rem; color: #ccc;"></i>
              <p class="text-muted mt-2">Aún no tienes pedidos.</p>
              <a href="/pages/catalog.html" class="btn btn-primary btn-sm mt-1">
                <i class="bi bi-grid me-1"></i>Ir al catálogo
              </a>
            </td>
          </tr>
        `;
        return;
      }

      // Renderizar cada pedido como fila de la tabla
      tableBody.innerHTML = orders.map(order => `
        <tr>
          <!-- ID del pedido -->
          <td class="fw-bold">#${order.id_pedido || order.id}</td>

          <!-- Fecha de creación -->
          <td>${formatDate(order.fecha_creacion || order.fecha_pedido || order.createdAt)}</td>

          <!-- Estado con badge coloreado -->
          <td>
            <span class="badge ${getStatusBadgeClass(order.estado)}">
              ${order.estado}
            </span>
          </td>

          <!-- Total del pedido -->
          <td class="fw-bold">${formatCurrency(order.total)}</td>

          <!-- Acciones -->
          <td>
            <a href="/pages/order-detail.html?id=${order.id_pedido || order.id}"
               class="btn btn-outline-primary btn-sm me-1"
               title="Ver detalle">
              <i class="bi bi-eye"></i> Ver
            </a>
            ${order.estado === 'Pendiente' ? `
              <button class="btn btn-outline-danger btn-sm"
                      onclick="cancelOrder(${order.id_pedido || order.id})"
                      title="Cancelar pedido">
                <i class="bi bi-x-circle"></i>
              </button>
            ` : ''}
          </td>
        </tr>
      `).join('');

    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-danger py-4">
            Error al cargar los pedidos.
          </td>
        </tr>
      `;
    }
  } catch (error) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-danger py-4">
          Error de conexión con el servidor.
        </td>
      </tr>
    `;
  }
}


// ============================================================
// FUNCIÓN: loadOrderDetail() - CARGAR DETALLE DE UN PEDIDO
// ============================================================
// Obtiene toda la información de un pedido específico:
// datos generales, lista de productos, estado y acciones.
//
// URL: /pages/order-detail.html?id=42
// Endpoint: GET /api/pedidos/42
// ============================================================
async function loadOrderDetail() {
  const container = document.getElementById('order-detail');
  if (!container) return;

  // Leer el ID del pedido desde la URL
  const orderId = getQueryParam('id');

  if (!orderId) {
    container.innerHTML = `
      <div class="text-center py-5">
        <h4 class="text-danger">Pedido no encontrado</h4>
        <a href="/pages/orders.html" class="btn btn-primary mt-2">
          <i class="bi bi-arrow-left me-1"></i>Volver a mis pedidos
        </a>
      </div>
    `;
    return;
  }

  // Spinner de carga
  container.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Cargando pedido...</span>
      </div>
    </div>
  `;

  try {
    const response = await apiRequest(`/api/pedidos/${orderId}`);

    if (response.success && response.data) {
      // Si el backend devuelve { pedido, detalles }, aplanamos el objeto para la vista
      const order = response.data.pedido ? {
        ...response.data.pedido,
        detalles: response.data.detalles
      } : response.data;
      renderOrderDetail(container, order);
    } else {
      container.innerHTML = `
        <div class="text-center py-5">
          <h4 class="text-danger">Pedido no encontrado</h4>
          <p class="text-muted">${response.message || ''}</p>
          <a href="/pages/orders.html" class="btn btn-primary mt-2">
            <i class="bi bi-arrow-left me-1"></i>Volver a mis pedidos
          </a>
        </div>
      `;
    }
  } catch (error) {
    container.innerHTML = `
      <div class="text-center py-5">
        <p class="text-danger">Error al cargar el pedido.</p>
      </div>
    `;
  }
}


// ============================================================
// FUNCIÓN: renderOrderDetail() - RENDERIZAR DETALLE DEL PEDIDO
// ============================================================
// Genera el HTML completo de la página de detalle de pedido:
// información general, tabla de productos y botones de acción.
// ============================================================
function renderOrderDetail(container, order) {
  // Obtener los detalles (productos) del pedido
  const details = order.detalles || order.productos || [];

  container.innerHTML = `
    <div class="animate-in">
      <!-- Encabezado con ID y estado -->
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h3>
          <i class="bi bi-bag me-2"></i>Pedido #${order.id_pedido || order.id}
        </h3>
        <span class="badge ${getStatusBadgeClass(order.estado)} fs-6">
          ${order.estado}
        </span>
      </div>

      <!-- Información general del pedido -->
      <div class="card mb-4">
        <div class="card-body">
          <div class="row">
            <div class="col-md-4">
              <p><strong>Fecha:</strong><br>${formatDate(order.fecha_creacion || order.fecha_pedido || order.createdAt)}</p>
            </div>
            <div class="col-md-4">
              <p><strong>Estado:</strong><br>${order.estado}</p>
            </div>
            <div class="col-md-4">
              <p><strong>Total:</strong><br><span class="cart-total">${formatCurrency(order.total)}</span></p>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabla de productos del pedido -->
      <h5 class="mb-3"><i class="bi bi-box-seam me-2"></i>Productos del pedido</h5>
      <div class="table-responsive">
        <table class="table table-striped">
          <thead class="table-dark">
            <tr>
              <th>Producto</th>
              <th>Precio Unitario</th>
              <th>Cantidad</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${details.length > 0 ? details.map(item => `
              <tr>
                <td>${item.nombre || item.producto_nombre || 'Producto'}</td>
                <td>${formatCurrency(item.precio_unitario || item.precio)}</td>
                <td>${item.cantidad}</td>
                <td class="fw-bold">${formatCurrency(item.subtotal || ((item.precio_unitario || item.precio) * item.cantidad))}</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="4" class="text-center text-muted">
                  No hay detalles disponibles para este pedido.
                </td>
              </tr>
            `}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="text-end fw-bold">Total:</td>
              <td class="fw-bold cart-total">${formatCurrency(order.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Contenedor de alertas -->
      <div id="order-alerts"></div>

      <!-- Botones de acción -->
      <div class="d-flex gap-2 mt-3">
        <a href="/pages/orders.html" class="btn btn-outline-secondary">
          <i class="bi bi-arrow-left me-1"></i>Volver a mis pedidos
        </a>

        ${order.estado === 'Pendiente' ? `
          <button class="btn btn-danger" onclick="cancelOrder(${order.id_pedido || order.id})">
            <i class="bi bi-x-circle me-1"></i>Cancelar pedido
          </button>
        ` : ''}

        ${['Entregado', 'Pagado', 'Enviado'].includes(order.estado) ? `
          <a href="/pages/support.html?tipo=Reembolso&pedido=${order.id_pedido || order.id}"
             class="btn btn-outline-warning">
            <i class="bi bi-arrow-counterclockwise me-1"></i>Solicitar reembolso
          </a>
        ` : ''}
      </div>
    </div>
  `;
}


// ============================================================
// FUNCIÓN: cancelOrder() - CANCELAR UN PEDIDO
// ============================================================
// Cambia el estado del pedido a "Cancelado". Solo se permite
// cancelar pedidos con estado "Pendiente".
//
// Endpoint: PUT /api/pedidos/:id/cancelar
// ============================================================
async function cancelOrder(orderId) {
  // Confirmar la cancelación con el usuario
  if (!confirm('¿Estás seguro de cancelar este pedido? Esta acción no se puede deshacer.')) {
    return;
  }

  try {
    const response = await apiRequest(`/api/pedidos/${orderId}/cancelar`, 'PUT');

    if (response.success) {
      // Mostrar éxito y recargar la página
      const alertContainer = document.getElementById('order-alerts') || document.getElementById('orders-alerts');
      if (alertContainer) {
        showAlert(alertContainer.id, 'Pedido cancelado exitosamente.', 'success');
      }

      // Recargar según la página en que estemos
      const ordersList = document.getElementById('orders-list');
      if (ordersList) {
        setTimeout(() => loadOrders(), 1500);
      } else {
        setTimeout(() => loadOrderDetail(), 1500);
      }
    } else {
      const alertId = document.getElementById('order-alerts') ? 'order-alerts' : 'orders-alerts';
      showAlert(alertId, response.message || 'No se pudo cancelar el pedido.', 'danger');
    }
  } catch (error) {
    alert('Error de conexión. Inténtalo de nuevo.');
  }
}
