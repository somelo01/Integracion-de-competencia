// ============================================================
// CHECKOUT.JS - LÓGICA DE CONFIRMACIÓN Y PAGO
// ============================================================
// Maneja la página checkout.html: muestra un resumen del pedido
// y procesa el pago a través de Webpay (Transbank).
//
// FLUJO DE PAGO:
// 1. El usuario llega desde el carrito con sus productos
// 2. Se muestra un resumen (productos, cantidades, total)
// 3. El usuario hace click en "Confirmar y Pagar"
// 4. Se crea el pedido: POST /api/pedidos/crear
// 5. Se inicia la transacción de pago: POST /api/pagos/crear
// 6. Se redirige al usuario a la URL de Webpay para pagar
// 7. Webpay redirige de vuelta a nuestra app (GET /api/pagos/confirmar)
//
// DEPENDE DE: utils.js (apiRequest, showAlert, formatCurrency, etc.)
//
// Referencia: Imagen 6 - Diagrama de flujo de pago con Webpay
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

  // Cargar resumen del pedido
  loadCheckoutSummary();

  // Configurar el botón de pago
  const payBtn = document.getElementById('btn-pay');
  if (payBtn) {
    payBtn.addEventListener('click', processPayment);
  }
});


// ============================================================
// FUNCIÓN: loadCheckoutSummary() - CARGAR RESUMEN DE COMPRA
// ============================================================
// Obtiene los ítems del carrito y los muestra como resumen
// de la compra en formato de lista. No es editable (para
// editar, el usuario debe volver al carrito).
//
// Endpoint: GET /api/carrito
// ============================================================
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
          return sum + (item.subtotal || (item.precio * item.cantidad));
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


// ============================================================
// FUNCIÓN: processPayment() - PROCESAR PAGO
// ============================================================
// Ejecuta el flujo completo de pago:
// 1. Crear el pedido desde el carrito
// 2. Crear la transacción de pago (Webpay)
// 3. Redirigir a Webpay para que el usuario pague
//
// Endpoints:
//   POST /api/pedidos/crear → crea el pedido, retorna { id_pedido, ... }
//   POST /api/pagos/crear → inicia Webpay, retorna { url, token }
//
// ¿POR QUÉ DOS PETICIONES?
// Porque son operaciones separadas:
// 1. Crear el pedido registra la intención de compra en nuestra BD
// 2. Crear el pago comunica con Transbank para obtener la URL de pago
// Si la primera falla (ej: stock insuficiente), no queremos
// iniciar una transacción de pago innecesaria.
// ============================================================
async function processPayment() {
  const payBtn = document.getElementById('btn-pay');
  setButtonLoading(payBtn, 'Procesando pago...');

  try {
    // ---------------------------------------------------------
    // PASO 1: Crear el pedido
    // ---------------------------------------------------------
    // El backend toma los ítems del carrito del usuario,
    // los convierte en un pedido con estado "Pendiente" y
    // vacía el carrito.
    // ---------------------------------------------------------
    const orderResponse = await apiRequest('/api/pedidos/crear', 'POST');

    if (!orderResponse.success) {
      showAlert('checkout-alerts', orderResponse.message || 'Error al crear el pedido.', 'danger');
      resetButton(payBtn);
      return;
    }

    // Obtener el ID del pedido creado
    const pedido = orderResponse.data;
    const idPedido = pedido.id_pedido || pedido.id;

    // ---------------------------------------------------------
    // PASO 2: Crear la transacción de pago con Webpay
    // ---------------------------------------------------------
    // El backend comunica con la API de Transbank para crear
    // una transacción. Nos devuelve una URL y un token.
    // La URL es donde debemos enviar al usuario para que pague.
    // ---------------------------------------------------------
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

    // ---------------------------------------------------------
    // PASO 3: Redirigir a Webpay
    // ---------------------------------------------------------
    // Webpay espera que redirijamos al usuario a su URL con
    // el token como parámetro. El usuario ingresa sus datos
    // de pago en la página de Webpay (no en la nuestra).
    // Después de pagar, Webpay redirige de vuelta a nuestra app
    // a la URL de confirmación.
    // ---------------------------------------------------------
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
