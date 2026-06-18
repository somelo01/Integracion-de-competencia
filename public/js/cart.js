// cart.js - carrito de compras. Carga ítems, actualiza cantidades, elimina ítems y vacía el carrito.


// Inicia la página del carrito cuando el DOM está listo.
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar que el usuario esté autenticado
  // Si no lo está, redirectIfNotAuth() lo enviará al login
  const user = await redirectIfNotAuth();
  if (!user) return;

  // Cargar el navbar (con sesión activa)
  await loadNavbar();

  // Cargar los ítems del carrito
  loadCart();

    // Evento para vaciar todo el carrito desde el modal de confirmación.
  const confirmEmptyBtn = document.getElementById('btn-confirm-empty');
  if (confirmEmptyBtn) {
    confirmEmptyBtn.addEventListener('click', emptyCart);
  }
});


// Carga el carrito desde /api/carrito y muestra los ítems.
async function loadCart() {
  const cartBody = document.getElementById('cart-body');
  const cartSummary = document.getElementById('cart-summary');
  const emptyCartDiv = document.getElementById('empty-cart');

  if (!cartBody) return;

  // Mostrar spinner de carga
  cartBody.innerHTML = `
    <tr>
      <td colspan="6" class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Cargando carrito...</span>
        </div>
      </td>
    </tr>
  `;

  try {
    const response = await apiRequest('/api/carrito');

    if (response.success && response.data) {
      const items = Array.isArray(response.data) ? response.data : (response.data.items || []);

      if (items.length > 0) {
        // Mostrar la tabla y ocultar el mensaje de carrito vacío
        if (emptyCartDiv) emptyCartDiv.style.display = 'none';
        if (cartSummary) cartSummary.style.display = 'block';

        // Renderizar cada ítem como fila de la tabla
        renderCartItems(cartBody, items);

        // Calcular y mostrar el total
        updateCartTotal(items);
      } else {
        // Carrito vacío → mostrar mensaje y ocultar tabla/resumen
        showEmptyCart(cartBody, cartSummary, emptyCartDiv);
      }

      }
  } catch (error) {
    cartBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-danger py-4">
          Error al cargar el carrito.
        </td>
      </tr>
    `;
  }
}


// Rinde las filas del carrito con imagen, nombre, precio, cantidad y subtotal.
function renderCartItems(cartBody, items) {
  cartBody.innerHTML = items.map(item => {
    const idDetalle = item.id_detalle_carrito || item.id_detalle;
    return `
      <tr class="cart-item-row" id="cart-row-${idDetalle}">
        <!-- Imagen miniatura del producto -->
        <td>
          <img src="${item.imagen_url || '/img/placeholder.png'}"
               class="cart-item-img"
               alt="${item.nombre || 'Producto'}"
               onerror="this.src='/img/placeholder.png'">
        </td>

        <!-- Nombre del producto (con link al detalle) -->
        <td>
          <a href="/pages/product.html?id=${item.id_producto}" class="text-decoration-none fw-bold">
            ${item.nombre || 'Producto'}
          </a>
        </td>

        <!-- Precio unitario -->
        <td>${formatCurrency(item.precio)}</td>

        <!-- Input de cantidad (editable) -->
        <td>
          <input type="number"
                 class="form-control cart-quantity-input"
                 value="${item.cantidad}"
                 min="1"
                 max="99"
                 data-id="${idDetalle}"
                 data-price="${item.precio}"
                 onchange="updateQuantity(this)">
        </td>

        <!-- Subtotal (precio × cantidad) -->
        <td class="fw-bold" id="subtotal-${idDetalle}">
          ${formatCurrency(item.subtotal || (item.precio * item.cantidad))}
        </td>

        <!-- Botón eliminar -->
        <td>
          <button class="btn btn-outline-danger btn-sm"
                  onclick="removeItem(${idDetalle})"
                  title="Eliminar del carrito">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}


// Actualiza cantidad en el backend y recalcula el subtotal.
async function updateQuantity(inputElement) {
  const idDetalle = inputElement.dataset.id;
  const nuevaCantidad = parseInt(inputElement.value);
  const precioUnitario = parseFloat(inputElement.dataset.price);

  // Validar que la cantidad sea un número positivo
  if (!nuevaCantidad || nuevaCantidad < 1) {
    inputElement.value = 1; // Resetear a 1 si es inválido
    return;
  }

  try {
    const response = await apiRequest(`/api/carrito/actualizar/${idDetalle}`, 'PUT', {
      cantidad: nuevaCantidad
    });

    if (response.success) {
      // Actualizar el subtotal en la tabla (visualmente)
      const subtotalCell = document.getElementById(`subtotal-${idDetalle}`);
      if (subtotalCell) {
        subtotalCell.textContent = formatCurrency(precioUnitario * nuevaCantidad);
      }

      // Recalcular el total general
      recalculateTotal();

      // Actualizar badge del carrito en el navbar
      loadCartCount();
    } else {
      showAlert('cart-alerts', response.message || 'Error al actualizar la cantidad.', 'danger');
      // Recargar para restaurar el estado correcto
      loadCart();
    }
  } catch (error) {
    showAlert('cart-alerts', 'Error de conexión.', 'danger');
  }
}


// Elimina un ítem del carrito con confirmación y petición al backend.
async function removeItem(idDetalle) {
  // Confirmar eliminación
  if (!confirm('¿Estás seguro de eliminar este producto del carrito?')) return;

  // Animación de eliminación (la fila se desvanece)
  const row = document.getElementById(`cart-row-${idDetalle}`);
  if (row) row.classList.add('removing');

  try {
    const response = await apiRequest(`/api/carrito/eliminar/${idDetalle}`, 'DELETE');

    if (response.success) {
      // Recargar el carrito para actualizar la vista
      setTimeout(() => loadCart(), 300); // Esperar la animación
      loadCartCount(); // Actualizar badge
    } else {
      // Quitar animación si falló
      if (row) row.classList.remove('removing');
      showAlert('cart-alerts', response.message || 'Error al eliminar el producto.', 'danger');
    }
  } catch (error) {
    if (row) row.classList.remove('removing');
    showAlert('cart-alerts', 'Error de conexión.', 'danger');
  }
}


// Vacia todo el carrito desde /api/carrito/vaciar.
async function emptyCart() {
  try {
    const response = await apiRequest('/api/carrito/vaciar', 'DELETE');

    if (response.success) {
      // Cerrar el modal de confirmación
      const modal = bootstrap.Modal.getInstance(document.getElementById('emptyCartModal'));
      if (modal) modal.hide();

      // Recargar el carrito (ahora vacío)
      loadCart();
      loadCartCount();
      showAlert('cart-alerts', 'Carrito vaciado exitosamente.', 'success');
    } else {
      showAlert('cart-alerts', response.message || 'Error al vaciar el carrito.', 'danger');
    }
  } catch (error) {
    showAlert('cart-alerts', 'Error de conexión.', 'danger');
  }
}


// Calcula y muestra el total del carrito.
function updateCartTotal(items) {
  const totalElement = document.getElementById('cart-total');
  if (!totalElement) return;

  const total = items.reduce((sum, item) => {
    return sum + (item.subtotal || (item.precio * item.cantidad));
  }, 0);

  totalElement.textContent = formatCurrency(total);
}


// Recalcula el total del carrito leyendo los valores del DOM.
function recalculateTotal() {
  const totalElement = document.getElementById('cart-total');
  if (!totalElement) return;

  const inputs = document.querySelectorAll('.cart-quantity-input');
  let total = 0;

  inputs.forEach(input => {
    const price = parseFloat(input.dataset.price) || 0;
    const quantity = parseInt(input.value) || 0;
    total += price * quantity;
  });

  totalElement.textContent = formatCurrency(total);
}


// Muestra la vista de carrito vacío con enlace al catálogo.
function showEmptyCart(cartBody, cartSummary, emptyCartDiv) {
  cartBody.innerHTML = '';
  if (cartSummary) cartSummary.style.display = 'none';

  if (emptyCartDiv) {
    emptyCartDiv.style.display = 'block';
    emptyCartDiv.innerHTML = `
      <div class="empty-cart animate-in">
        <i class="bi bi-cart-x d-block"></i>
        <h4>Tu carrito está vacío</h4>
        <p class="text-muted">¡Agrega productos para comenzar tu compra!</p>
        <a href="/pages/catalog.html" class="btn btn-primary mt-2">
          <i class="bi bi-grid me-1"></i>Ir al catálogo
        </a>
      </div>
    `;
  }
}
