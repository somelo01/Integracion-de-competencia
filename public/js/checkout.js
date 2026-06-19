// checkout.js - resumen de pedido y pago con Webpay.


// Inicia checkout y configura el botón de pago.
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar autenticación
  const user = await redirectIfNotAuth();
  if (!user) return;

  // Cargar navbar
  await loadNavbar();

  // Cargar resumen del pedido
  loadCheckoutSummary();

  // Configurar el botón de pago
  const payBtn = document.getElementById('btn-pay');
  if (payBtn) {
    payBtn.addEventListener('click', processPayment);
  }
});


// Carga el resumen de compra desde el carrito.
async function loadCheckoutSummary() {
  const summaryBody = document.getElementById('checkout-items');
  const totalElement = document.getElementById('checkout-total');

  if (!summaryBody) return;

  // Spinner de carga
  summaryBody.innerHTML = `
    <tr>
      <td colspan="4" class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Cargando...</span>
        </div>
      </td>
    </tr>
  `;

  try {
    const response = await apiRequest('/api/carrito');

    if (response.success && response.data) {
      const items = Array.isArray(response.data) ? response.data : (response.data.items || []);

      if (items.length > 0) {
        // Renderizar cada ítem en la tabla de resumen
        summaryBody.innerHTML = items.map(item => `
          <tr>
            <td>
              <div class="d-flex align-items-center">
                <img src="${item.imagen_url || '/img/placeholder.png'}"
                     class="cart-item-img me-2"
                     alt="${item.nombre}"
                     onerror="this.src='/img/placeholder.png'">
                <span>${item.nombre || 'Producto'}</span>
              </div>
            </td>
            <td class="text-center">${item.cantidad}</td>
            <td>${formatCurrency(item.precio)}</td>
            <td class="fw-bold">${formatCurrency(item.subtotal || (item.precio * item.cantidad))}</td>
          </tr>
        `).join('');

        // Calcular y mostrar el total
        const total = items.reduce((sum, item) => {
          const subtotal = Number(item.subtotal !== undefined && item.subtotal !== null ? item.subtotal : (item.precio * item.cantidad));
          return sum + (isNaN(subtotal) ? 0 : subtotal);
        }, 0);

        if (totalElement) {
          totalElement.textContent = formatCurrency(total);
        }

      } else {
        // Carrito vacío → no se puede hacer checkout
        summaryBody.innerHTML = `
          <tr>
            <td colspan="4" class="text-center py-4">
              <p class="text-muted">Tu carrito está vacío.</p>
              <a href="/pages/catalog.html" class="btn btn-primary btn-sm">
                Ir al catálogo
              </a>
            </td>
          </tr>
        `;

        // Deshabilitar botón de pago
        const payBtn = document.getElementById('btn-pay');
        if (payBtn) payBtn.disabled = true;
      }
    }
  } catch (error) {
    summaryBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-danger py-4">
          Error al cargar el resumen.
        </td>
      </tr>
    `;
  }
}


// Procesa el pago: crea pedido y transacción, luego redirige a Webpay.
async function processPayment() {
  const payBtn = document.getElementById('btn-pay');
  setButtonLoading(payBtn, 'Procesando pago...');

  try {
    // Crear el pedido en el backend y vaciar el carrito.
    const orderResponse = await apiRequest('/api/pedidos/crear', 'POST');

    if (!orderResponse.success) {
      showAlert('checkout-alerts', orderResponse.message || 'Error al crear el pedido.', 'danger');
      resetButton(payBtn);
      return;
    }

    // Obtener el ID del pedido creado
    const pedido = orderResponse.data;
    const idPedido = pedido.id_pedido || pedido.id;

    // Crear la transacción de pago y obtener la URL de Webpay.
    const payResponse = await apiRequest('/api/pagos/crear', 'POST', {
      id_pedido: idPedido
    });

    if (!payResponse.success) {
      showAlert('checkout-alerts',
        payResponse.message || 'Error al iniciar el pago. Tu pedido fue creado, puedes pagarlo después.',
        'warning');
      resetButton(payBtn);
      return;
    }

    // Redirigir al usuario a Webpay con el token recibido.
    const payData = payResponse.data;

    if (payData.url && payData.token) {
      // Construir la URL de redirección a Webpay
      const webpayUrl = `${payData.url}?token_ws=${payData.token}`;

      // Mostrar mensaje antes de redirigir
      showAlert('checkout-alerts', 'Redirigiendo a Webpay...', 'info');

      // Redirigir al usuario a Webpay
      setTimeout(() => {
        window.location.href = webpayUrl;
      }, 1000);
    } else {
      // Fallback: si no hay URL de Webpay, redirigir al detalle del pedido
      showAlert('checkout-alerts',
        'Pedido creado exitosamente. Redirigiendo al detalle del pedido...',
        'success');
      setTimeout(() => {
        window.location.href = `/pages/order-detail.html?id=${idPedido}`;
      }, 2000);
    }

  } catch (error) {
    showAlert('checkout-alerts', 'Error de conexión. Inténtalo de nuevo.', 'danger');
    resetButton(payBtn);
  }
}
