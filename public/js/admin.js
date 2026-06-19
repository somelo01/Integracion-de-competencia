// admin.js - panel de administración.
// Maneja dashboard, productos, usuarios, pedidos y soporte.
// Usa utils.js y llamadas a /api/admin/*.

document.addEventListener('DOMContentLoaded', async () => {
  // Verificar que sea admin
  const user = await redirectIfNotAdmin();
  if (!user) return;

  // Cargar navbar
  await loadNavbar();

  // Detectar qué página admin estamos e inicializarla
  if (document.getElementById('admin-dashboard')) initDashboard();
  if (document.getElementById('admin-products')) initAdminProducts();
  if (document.getElementById('admin-users')) initAdminUsers();
  if (document.getElementById('admin-orders')) initAdminOrders();
  if (document.getElementById('admin-support')) initAdminSupport();
});


// Dashboard: cargar estadísticas.
async function initDashboard() {
  try {
    const response = await apiRequest('/api/admin/dashboard');

    if (response.success && response.data) {
      const stats = response.data;

      // Actualizar las tarjetas de estadísticas con los datos
      updateStatCard('stat-products', stats.totalProductos || 0);
      updateStatCard('stat-orders', stats.totalPedidos || 0);
      updateStatCard('stat-tickets', stats.totalTickets || 0);
      updateStatCard('stat-users', stats.totalUsuarios || 0);
      updateStatCard('stat-pending-orders', stats.pedidosPendientes || 0);
      updateStatCard('stat-open-tickets', stats.ticketsAbiertos || 0);
    } else {
      showAlert('dashboard-alerts', 'Error al cargar las estadísticas.', 'danger');
    }
  } catch (error) {
    showAlert('dashboard-alerts', 'Error de conexión con el servidor.', 'danger');
  }
}


// Actualiza el texto de una tarjeta estadística por su ID.
function updateStatCard(elementId, value) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = value;
  }
}


// Productos admin.

// Inicia la sección de productos y enlaza el formulario.
async function initAdminProducts() {
  // Cargar tabla de productos
  loadAdminProducts();

  // Evento para el formulario del modal de crear/editar
  const productForm = document.getElementById('product-form');
  if (productForm) {
    productForm.addEventListener('submit', saveProduct);
  }
}


// Carga la lista de productos desde /api/admin/productos.
async function loadAdminProducts() {
  const tableBody = document.getElementById('products-body');
  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr><td colspan="7" class="text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
    </td></tr>
  `;

  try {
    const response = await apiRequest('/api/admin/productos');

    if (response.success && response.data) {
      const products = Array.isArray(response.data) ? response.data : (response.data.productos || []);

      if (products.length === 0) {
        tableBody.innerHTML = `
          <tr><td colspan="7" class="text-center py-4 text-muted">
            No hay productos registrados.
          </td></tr>
        `;
        return;
      }

      tableBody.innerHTML = products.map(product => `
        <tr>
          <td>${product.id_producto || product.id}</td>
          <td>
            <strong>${product.nombre}</strong>
            <br><small class="text-muted">${product.categoria || ''}</small>
          </td>
          <td>${formatCurrency(product.precio)}</td>
          <td>${product.stock}</td>
          <td>
            <span class="badge ${product.activo !== false ? 'bg-success' : 'bg-secondary'}">
              ${product.activo !== false ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td>${product.talla || '-'}</td>
          <td>
            <button class="btn btn-outline-primary btn-sm me-1"
                    onclick="editProduct(${product.id_producto || product.id})"
                    title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm"
                    onclick="deleteProduct(${product.id_producto || product.id})"
                    title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');

    } else {
      tableBody.innerHTML = `
        <tr><td colspan="7" class="text-center text-danger py-4">
          Error al cargar los productos.
        </td></tr>
      `;
    }
  } catch (error) {
    tableBody.innerHTML = `
      <tr><td colspan="7" class="text-center text-danger py-4">
        Error de conexión.
      </td></tr>
    `;
  }
}


// Abre el modal para crear un producto.
function openCreateProductModal() {
  const form = document.getElementById('product-form');
  if (form) form.reset();

  // Cambiar título del modal
  const modalTitle = document.getElementById('productModalLabel');
  if (modalTitle) modalTitle.textContent = 'Crear Nuevo Producto';

  // Limpiar el ID oculto (indica que es nuevo, no edición)
  const hiddenId = document.getElementById('product-id');
  if (hiddenId) hiddenId.value = '';

  // Abrir el modal de Bootstrap
  const modal = new bootstrap.Modal(document.getElementById('productModal'));
  modal.show();
}


// Carga un producto y abre el modal de edición.
async function editProduct(productId) {
  try {
    const response = await apiRequest(`/api/productos/${productId}`);

    if (response.success && response.data) {
      const product = response.data;

      // Llenar el formulario del modal con los datos
      document.getElementById('product-id').value = product.id_producto || product.id;
      document.getElementById('product-nombre').value = product.nombre || '';
      document.getElementById('product-categoria').value = product.categoria || '';
      document.getElementById('product-precio').value = product.precio || '';
      document.getElementById('product-stock').value = product.stock || 0;
      document.getElementById('product-descripcion').value = product.descripcion || '';
      document.getElementById('product-imagen').value = product.imagen_url || '';
      document.getElementById('product-talla').value = product.talla || '';
      document.getElementById('product-color').value = product.color || '';

      // Cambiar título del modal
      const modalTitle = document.getElementById('productModalLabel');
      if (modalTitle) modalTitle.textContent = 'Editar Producto';

      // Abrir el modal
      const modal = new bootstrap.Modal(document.getElementById('productModal'));
      modal.show();
    } else {
      showAlert('products-alerts', 'No se pudo cargar el producto.', 'danger');
    }
  } catch (error) {
    showAlert('products-alerts', 'Error de conexión.', 'danger');
  }
}


// Guarda un producto: crea o actualiza según el ID oculto.
async function saveProduct(event) {
  event.preventDefault();

  const productId = document.getElementById('product-id').value;
  const isEditing = !!productId;

  // Recolectar datos del formulario
  const body = {
    nombre: document.getElementById('product-nombre').value.trim(),
    categoria: document.getElementById('product-categoria').value.trim(),
    precio: parseFloat(document.getElementById('product-precio').value),
    stock: parseInt(document.getElementById('product-stock').value),
    descripcion: document.getElementById('product-descripcion').value.trim(),
    imagen_url: document.getElementById('product-imagen').value.trim(),
    talla: document.getElementById('product-talla').value.trim(),
    color: document.getElementById('product-color').value.trim()
  };

  // Validaciones básicas
  if (!body.nombre || body.nombre.length < 3) {
    showAlert('product-modal-alerts', 'El nombre debe tener al menos 3 caracteres.', 'danger');
    return;
  }

  if (!body.categoria) {
    showAlert('product-modal-alerts', 'La categoría es obligatoria.', 'danger');
    return;
  }

  if (isNaN(body.precio) || body.precio < 0) {
    showAlert('product-modal-alerts', 'El precio debe ser un número positivo.', 'danger');
    return;
  }

  if (isNaN(body.stock) || body.stock < 0) {
    showAlert('product-modal-alerts', 'El stock debe ser un número entero >= 0.', 'danger');
    return;
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  setButtonLoading(submitBtn, 'Guardando...');

  try {
    const url = isEditing ? `/api/admin/productos/${productId}` : '/api/admin/productos';
    const method = isEditing ? 'PUT' : 'POST';

    const response = await apiRequest(url, method, body);

    if (response.success) {
      // Cerrar modal y recargar tabla
      const modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
      if (modal) modal.hide();

      showAlert('products-alerts',
        isEditing ? 'Producto actualizado exitosamente.' : 'Producto creado exitosamente.',
        'success');

      loadAdminProducts(); // Recargar la tabla
    } else {
      const errorMsg = response.errors
        ? response.errors.map(e => e.message).join('<br>')
        : (response.message || 'Error al guardar el producto.');
      showAlert('product-modal-alerts', errorMsg, 'danger');
    }
    resetButton(submitBtn);
  } catch (error) {
    showAlert('product-modal-alerts', 'Error de conexión.', 'danger');
    resetButton(submitBtn);
  }
}


// Elimina un producto desde el admin.
async function deleteProduct(productId) {
  if (!confirm('¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.')) {
    return;
  }

  try {
    const response = await apiRequest(`/api/admin/productos/${productId}`, 'DELETE');

    if (response.success) {
      showAlert('products-alerts', 'Producto eliminado exitosamente.', 'success');
      loadAdminProducts();
    } else {
      showAlert('products-alerts', response.message || 'Error al eliminar el producto.', 'danger');
    }
  } catch (error) {
    showAlert('products-alerts', 'Error de conexión.', 'danger');
  }
}


// Sección de usuarios admin.


// Inicia la gestión de usuarios en el admin.
async function initAdminUsers() {
  loadAdminUsers();
}


// Carga usuarios desde /api/admin/usuarios.
async function loadAdminUsers() {
  const tableBody = document.getElementById('users-body');
  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr><td colspan="5" class="text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
    </td></tr>
  `;

  try {
    const response = await apiRequest('/api/admin/usuarios');

    if (response.success && response.data) {
      const users = Array.isArray(response.data.usuarios) ? response.data.usuarios : (response.data.usuarios || []);

      if (users.length === 0) {
        tableBody.innerHTML = `
          <tr><td colspan="5" class="text-center py-4 text-muted">
            No hay usuarios registrados.
          </td></tr>
        `;
        return;
      }

      tableBody.innerHTML = users.map(user => `
        <tr>
          <td>${user.id_usuario || user.id}</td>
          <td>${user.nombre}</td>
          <td>${user.email}</td>
          <td>
            <span class="badge ${user.rol === 'Admin' ? 'bg-danger' : 'bg-primary'}">
              ${user.rol}
            </span>
          </td>
          <td>
            <button class="btn btn-outline-danger btn-sm"
                    onclick="deleteUser(${user.id_usuario || user.id})"
                    title="Eliminar usuario"
                    ${user.rol === 'Admin' ? 'disabled' : ''}>
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');

    } else {
      tableBody.innerHTML = `
        <tr><td colspan="5" class="text-center text-danger py-4">
          Error al cargar los usuarios.
        </td></tr>
      `;
    }
  } catch (error) {
    tableBody.innerHTML = `
      <tr><td colspan="5" class="text-center text-danger py-4">
        Error de conexión.
      </td></tr>
    `;
  }
}


// Elimina un usuario admin.
async function deleteUser(userId) {
  if (!confirm('¿Estás seguro de eliminar este usuario? Se eliminarán también sus pedidos y datos.')) {
    return;
  }

  try {
    const response = await apiRequest(`/api/admin/usuarios/${userId}`, 'DELETE');

    if (response.success) {
      showAlert('users-alerts', 'Usuario eliminado exitosamente.', 'success');
      loadAdminUsers();
    } else {
      showAlert('users-alerts', response.message || 'Error al eliminar el usuario.', 'danger');
    }
  } catch (error) {
    showAlert('users-alerts', 'Error de conexión.', 'danger');
  }
}


// Sección de pedidos admin.


// Inicia la gestión de pedidos admin.
async function initAdminOrders() {
  loadAdminOrders();

  // Filtro de estado
  const statusFilter = document.getElementById('order-status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      loadAdminOrders(statusFilter.value);
    });
  }
}


// Carga pedidos admin desde /api/admin/pedidos.
async function loadAdminOrders(statusFilter = '') {
  const tableBody = document.getElementById('admin-orders-body');
  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr><td colspan="7" class="text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
    </td></tr>
  `;

  try {
    let url = '/api/admin/pedidos';
    if (statusFilter) {
      url += `?estado=${encodeURIComponent(statusFilter)}`;
    }

    const response = await apiRequest(url);

    if (response.success && response.data) {
      const orders = Array.isArray(response.data) ? response.data : (response.data.pedidos || []);

      if (orders.length === 0) {
        tableBody.innerHTML = `
          <tr><td colspan="7" class="text-center py-4 text-muted">
            No hay pedidos ${statusFilter ? `con estado "${statusFilter}"` : ''}.
          </td></tr>
        `;
        return;
      }

      tableBody.innerHTML = orders.map(order => `
        <tr>
          <td class="fw-bold">#${order.id_pedido || order.id}</td>
          <td>${order.usuario_nombre || order.nombre_usuario || `Usuario #${order.id_usuario}`}</td>
          <td>${formatDate(order.fecha_creacion || order.fecha_pedido || order.createdAt)}</td>
          <td>
            <span class="badge ${getStatusBadgeClass(order.estado)}">
              ${order.estado}
            </span>
          </td>
          <td class="fw-bold">${formatCurrency(order.total)}</td>
          <td>
            <!-- Dropdown para cambiar estado -->
            <select class="form-select form-select-sm" style="width: 140px;"
                    onchange="updateOrderStatus(${order.id_pedido || order.id}, this.value)"
                    data-current="${order.estado}">
              <option value="" disabled selected>Cambiar...</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Pagado">Pagado</option>
              <option value="Enviado">Enviado</option>
              <option value="Entregado">Entregado</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </td>
          <td>
            <a href="/pages/order-detail.html?id=${order.id_pedido || order.id}"
               class="btn btn-outline-primary btn-sm" title="Ver detalle">
              <i class="bi bi-eye"></i>
            </a>
          </td>
        </tr>
      `).join('');

    } else {
      tableBody.innerHTML = `
        <tr><td colspan="7" class="text-center text-danger py-4">
          Error al cargar los pedidos.
        </td></tr>
      `;
    }
  } catch (error) {
    tableBody.innerHTML = `
      <tr><td colspan="7" class="text-center text-danger py-4">
        Error de conexión.
      </td></tr>
    `;
  }
}


// Cambia el estado de un pedido admin.
async function updateOrderStatus(orderId, newStatus) {
  if (!newStatus) return;

  if (!confirm(`¿Cambiar el estado del pedido #${orderId} a "${newStatus}"?`)) {
    // Resetear el select
    loadAdminOrders();
    return;
  }

  try {
    const response = await apiRequest(`/api/admin/pedidos/${orderId}/estado`, 'PUT', {
      estado: newStatus
    });

    if (response.success) {
      showAlert('admin-orders-alerts', `Pedido #${orderId} actualizado a "${newStatus}".`, 'success');
      loadAdminOrders(); // Recargar tabla
    } else {
      showAlert('admin-orders-alerts', response.message || 'Error al actualizar el pedido.', 'danger');
      loadAdminOrders();
    }
  } catch (error) {
    showAlert('admin-orders-alerts', 'Error de conexión.', 'danger');
  }
}


// Sección de soporte admin.


// Inicia la gestión de soporte admin.
async function initAdminSupport() {
  loadAdminTickets();

  // Evento para el formulario de respuesta del modal
  const respondForm = document.getElementById('respond-form');
  if (respondForm) {
    respondForm.addEventListener('submit', respondToTicket);
  }
}


// Carga tickets admin desde /api/admin/soporte.
async function loadAdminTickets() {
  const tableBody = document.getElementById('admin-tickets-body');
  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr><td colspan="7" class="text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
    </td></tr>
  `;

  try {
    const response = await apiRequest('/api/admin/soporte');

    if (response.success && response.data) {
      const tickets = Array.isArray(response.data.tickets) ? response.data.tickets : (response.data.tickets || []);

      if (tickets.length === 0) {
        tableBody.innerHTML = `
          <tr><td colspan="7" class="text-center py-4 text-muted">
            No hay tickets de soporte.
          </td></tr>
        `;
        return;
      }

      tableBody.innerHTML = tickets.map(ticket => `
        <tr>
          <td>#${ticket.id_ticket || ticket.id}</td>
          <td>${ticket.usuario_nombre || ticket.nombre_usuario || `Usuario #${ticket.id_usuario}`}</td>
          <td>${ticket.asunto}</td>
          <td>
            <span class="badge bg-secondary">${ticket.tipo || 'General'}</span>
          </td>
          <td>
            <span class="badge ${getStatusBadgeClass(ticket.estado)}">
              ${ticket.estado}
            </span>
          </td>
          <td>${formatDate(ticket.fecha_creacion || ticket.createdAt)}</td>
          <td>
            <button class="btn btn-outline-primary btn-sm me-1"
                    onclick="openRespondModal(${ticket.id_ticket || ticket.id}, '${(ticket.asunto || '').replace(/'/g, "\\'")}')"
                    title="Responder">
              <i class="bi bi-reply"></i>
            </button>
            ${ticket.tipo === 'Reembolso' && ticket.estado !== 'Resuelto' ? `
              <button class="btn btn-outline-success btn-sm"
                      onclick="approveRefund(${ticket.id_ticket || ticket.id})"
                      title="Aprobar reembolso">
                <i class="bi bi-check-circle"></i>
              </button>
            ` : ''}
          </td>
        </tr>
      `).join('');

    } else {
      tableBody.innerHTML = `
        <tr><td colspan="7" class="text-center text-danger py-4">
          Error al cargar los tickets.
        </td></tr>
      `;
    }
  } catch (error) {
    tableBody.innerHTML = `
      <tr><td colspan="7" class="text-center text-danger py-4">
        Error de conexión.
      </td></tr>
    `;
  }
}


// Abre el modal para responder un ticket.
function openRespondModal(ticketId, asunto) {
  document.getElementById('respond-ticket-id').value = ticketId;
  document.getElementById('respond-ticket-asunto').textContent = `Ticket #${ticketId}: ${asunto}`;
  document.getElementById('respond-message').value = '';

  const modal = new bootstrap.Modal(document.getElementById('respondModal'));
  modal.show();
}


// Envía la respuesta del admin al ticket.
async function respondToTicket(event) {
  event.preventDefault();

  const ticketId = document.getElementById('respond-ticket-id').value;
  const respuesta = document.getElementById('respond-message').value.trim();
  const nuevoEstado = document.getElementById('respond-status').value;

  if (!respuesta) {
    showAlert('respond-alerts', 'Escribe una respuesta.', 'warning');
    return;
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  setButtonLoading(submitBtn, 'Enviando...');

  try {
    const response = await apiRequest(`/api/admin/soporte/${ticketId}`, 'PUT', {
      respuesta_admin: respuesta,
      estado: nuevoEstado || 'En Proceso'
    });

    if (response.success) {
      // Cerrar modal y recargar tabla
      const modal = bootstrap.Modal.getInstance(document.getElementById('respondModal'));
      if (modal) modal.hide();

      showAlert('admin-support-alerts', 'Respuesta enviada exitosamente.', 'success');
      loadAdminTickets();
    } else {
      showAlert('respond-alerts', response.message || 'Error al responder.', 'danger');
    }
    resetButton(submitBtn);
  } catch (error) {
    showAlert('respond-alerts', 'Error de conexión.', 'danger');
    resetButton(submitBtn);
  }
}


// Aprueba el reembolso y cierra el ticket.
async function approveRefund(ticketId) {
  if (!confirm('¿Aprobar este reembolso? El ticket se marcará como Resuelto.')) {
    return;
  }

  try {
    const response = await apiRequest(`/api/admin/soporte/${ticketId}`, 'PUT', {
      respuesta_admin: 'Reembolso aprobado por el administrador.',
      estado: 'Resuelto'
    });

    if (response.success) {
      showAlert('admin-support-alerts', 'Reembolso aprobado exitosamente.', 'success');
      loadAdminTickets();
    } else {
      showAlert('admin-support-alerts', response.message || 'Error al aprobar el reembolso.', 'danger');
    }
  } catch (error) {
    showAlert('admin-support-alerts', 'Error de conexión.', 'danger');
  }
}
