// ============================================================
// CONTROLADOR: PAGOS (paymentController.js)
// ============================================================
// Maneja la integración con Transbank Webpay Plus para procesar
// pagos de los pedidos. Webpay Plus es la pasarela de pago más
// usada en Chile.
//
// RELACIÓN CON DIAGRAMAS DEL PROYECTO:
//   - Diagrama de Secuencia: Proceso de Compra (imagen 5):
//     Muestra el flujo completo:
//     Cliente → Backend → Webpay → Backend → Cliente
//   - ERD (imagen 4): Tablas "pagos" y "facturas"
//   - Diagrama de Estados (imagen 3): Transiciones de pago:
//     Pendiente → Aprobado / Rechazado / Cancelado
//   - Casos de Uso (imagen 2): "Pagar con Webpay"
//
// ¿CÓMO FUNCIONA WEBPAY PLUS?
//   Es un flujo de 3 pasos:
//
//   PASO 1: CREAR TRANSACCIÓN (crearTransaccion)
//     - Backend envía datos del pedido a Transbank
//     - Transbank devuelve una URL + token
//     - Frontend redirige al usuario a esa URL de Transbank
//
//   PASO 2: PAGO EN WEBPAY (fuera de nuestro control)
//     - El usuario ingresa datos de su tarjeta en el sitio de Transbank
//     - Transbank procesa el pago
//     - Transbank redirige al usuario de vuelta a nuestra returnUrl
//
//   PASO 3: CONFIRMAR PAGO (confirmarPago)
//     - Webpay redirige al usuario a GET /api/pagos/confirmar?token_ws=XXX
//     - Backend llama a tx.commit(token_ws) para confirmar
//     - Actualizamos estado del pedido y pago
//     - Creamos la factura
//     - Redirigimos a página de éxito o error
//
// MODO SANDBOX (INTEGRACIÓN):
//   Usamos credenciales de prueba de Transbank:
//   - IntegrationCommerceCodes.WEBPAY_PLUS → Código de comercio de prueba
//   - IntegrationApiKeys.WEBPAY → API key de prueba
//   - Environment.Integration → Ambiente de pruebas
//
//   Tarjeta de prueba para testing:
//   - Número: 4051 8856 0044 6623
//   - CVV: 123
//   - Fecha exp: cualquier fecha futura
//   - RUT: 11.111.111-1
//   - Contraseña: 123
//
// RELACIÓN CON OTROS ARCHIVOS:
//   - routes/paymentRoutes.js → URLs que llaman estas funciones
//   - controllers/orderController.js → Los pedidos se crean antes del pago
//   - config/db.js → Pool para consultas MySQL
//   - middleware/auth.js → crearTransaccion requiere sesión
// ============================================================

const { pool } = require('../config/db');

// --- Importar Transbank SDK ---
// WebpayPlus: Clase principal para crear transacciones
// Options: Configuración del comercio
// Environment: Ambiente (Integration = sandbox, Production = real)
// IntegrationCommerceCodes: Código de comercio de prueba
// IntegrationApiKeys: API key de prueba
const {
  WebpayPlus,
  Options,
  Environment,
  IntegrationCommerceCodes,
  IntegrationApiKeys
} = require('transbank-sdk');

// --- Crear instancia de transacción Webpay ---
// Esta instancia se reutiliza para todas las operaciones de pago.
// En producción, se usarían credenciales reales del comercio.
const tx = new WebpayPlus.Transaction(
  new Options(
    IntegrationCommerceCodes.WEBPAY_PLUS,  // Código de comercio de prueba
    IntegrationApiKeys.WEBPAY,              // API key de prueba
    Environment.Integration                 // Ambiente de pruebas (sandbox)
  )
);

// ============================================================
// CREAR TRANSACCIÓN DE PAGO
// ============================================================
// Inicia una transacción en Webpay Plus para un pedido específico.
// Devuelve la URL de Webpay donde el usuario debe ir a pagar.
//
// PARÁMETROS QUE ENVÍA A TRANSBANK:
//   - buyOrder: Identificador único del pedido (string, máx 26 chars)
//   - sessionId: ID de la sesión para tracking (string)
//   - amount: Monto total a cobrar (entero, sin decimales en CLP)
//   - returnUrl: URL a donde Webpay redirige después del pago
//
// TRANSBANK RESPONDE:
//   - url: URL del formulario de pago de Webpay
//   - token: Token único de la transacción
//
// EL FRONTEND DEBE:
//   Redirigir al usuario a: url + "?token_ws=" + token
//   (O usar un formulario con POST hacia la URL de Webpay)
//
// RUTA: POST /api/pagos/crear
// MIDDLEWARE: isAuthenticated
// ============================================================
const crearTransaccion = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id_pedido } = req.body;

    // Validar que se envió el id_pedido
    if (!id_pedido) {
      return res.status(400).json({
        success: false,
        message: 'El ID del pedido es obligatorio.',
        data: null,
        errors: [{ field: 'id_pedido', message: 'ID de pedido requerido' }]
      });
    }

    // --- Paso 1: Verificar que el pedido exista y pertenezca al usuario ---
    const [pedidos] = await pool.query(
      'SELECT id_pedido, total, estado FROM pedidos WHERE id_pedido = ? AND id_usuario = ?',
      [id_pedido, userId]
    );

    if (pedidos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado.',
        data: null,
        errors: null
      });
    }

    const pedido = pedidos[0];

    // Solo se puede pagar un pedido en estado Pendiente
    if (pedido.estado !== 'Pendiente') {
      return res.status(400).json({
        success: false,
        message: `Este pedido está en estado "${pedido.estado}" y no se puede pagar.`,
        data: null,
        errors: null
      });
    }

    // --- Paso 2: Verificar que no exista ya un pago aprobado ---
    const [pagosExistentes] = await pool.query(
      'SELECT id_pago, estado FROM pagos WHERE id_pedido = ? AND estado = ?',
      [id_pedido, 'Aprobado']
    );

    if (pagosExistentes.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Este pedido ya tiene un pago aprobado.',
        data: null,
        errors: null
      });
    }

    // --- Paso 3: Preparar datos para Webpay ---
    // buyOrder: Identificador único. Usamos "PEDIDO-" + id para claridad
    const buyOrder = `PEDIDO-${id_pedido}`;

    // sessionId: ID de sesión para tracking interno de Transbank
    const sessionId = `SESION-${userId}-${Date.now()}`;

    // amount: Monto en pesos chilenos (entero, sin decimales)
    // Math.round por si el total tiene decimales
    const amount = Math.round(parseFloat(pedido.total));

    // returnUrl: URL donde Webpay redirige después del pago
    // Usamos req.protocol y req.get('host') para construirla dinámicamente
    const returnUrl = `${req.protocol}://${req.get('host')}/api/pagos/confirmar`;

    // --- Paso 4: Crear transacción en Webpay ---
    // tx.create() envía los datos a Transbank y recibe la URL del formulario
    const response = await tx.create(buyOrder, sessionId, amount, returnUrl);

    // --- Paso 5: Guardar registro de pago en nuestra BD ---
    // Estado inicial: Pendiente. Se actualizará al confirmar.
    await pool.query(
      'INSERT INTO pagos (id_pedido, monto, token_ws, estado) VALUES (?, ?, ?, ?)',
      [id_pedido, amount, response.token, 'Pendiente']
    );

    // --- Paso 6: Responder con la URL de Webpay ---
    // El frontend redirigirá al usuario a esta URL
    return res.status(200).json({
      success: true,
      message: 'Transacción creada. Rediriga al usuario a la URL de pago.',
      data: {
        url: response.url,           // URL del formulario de Webpay
        token: response.token         // Token para identificar la transacción
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al crear transacción Webpay:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al crear la transacción de pago.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// ============================================================
// CONFIRMAR PAGO (callback de Webpay)
// ============================================================
// Este endpoint es llamado AUTOMÁTICAMENTE por Webpay cuando
// el usuario completa (o cancela) el proceso de pago.
//
// ¿POR QUÉ ES GET?
//   Webpay redirige el navegador del usuario con GET a la
//   returnUrl que configuramos, agregando ?token_ws=XXX
//   al query string. Es un redirect del navegador, no una
//   llamada API del frontend.
//
// FLUJO:
//   1. Webpay redirige a: /api/pagos/confirmar?token_ws=XXX
//   2. Si no hay token_ws → el usuario canceló en Webpay
//   3. Si hay token_ws → llamamos tx.commit(token_ws)
//   4. Transbank responde con el resultado del pago
//   5. Actualizamos estado del pago y pedido en nuestra BD
//   6. Si aprobado → creamos factura
//   7. Redirigimos al usuario a la página de resultado
//
// RESPONSE CODES DE TRANSBANK:
//   response_code === 0 → Pago APROBADO
//   response_code !== 0 → Pago RECHAZADO
//
// RUTA: GET /api/pagos/confirmar?token_ws=XXX
// NOTA: No usa isAuthenticated porque es un redirect de Webpay
//       (la sesión puede no estar disponible en el redirect)
// ============================================================
const confirmarPago = async (req, res) => {
  try {
    // --- Obtener token_ws del query string ---
    // Webpay envía: /api/pagos/confirmar?token_ws=XXXXX
    // Si el usuario cancela: /api/pagos/confirmar?TBK_TOKEN=XXX (sin token_ws)
    const { token_ws, TBK_TOKEN, TBK_ORDEN_COMPRA } = req.query;

    // --- Caso: Usuario canceló en Webpay ---
    // Cuando el usuario presiona "Anular" en el formulario de Webpay,
    // se redirige sin token_ws pero con TBK_TOKEN
    if (!token_ws || TBK_TOKEN) {
      // Si hay TBK_TOKEN, actualizar el pago como Cancelado
      const cancelToken = TBK_TOKEN || null;
      if (cancelToken) {
        await pool.query(
          'UPDATE pagos SET estado = ? WHERE token_ws = ?',
          ['Cancelado', cancelToken]
        );
      }

      // Redirigir a página de error/cancelación
      return res.redirect('/pago-fallido');
    }

    // --- Paso 1: Confirmar la transacción con Transbank ---
    // tx.commit() envía el token a Transbank y recibe el resultado final
    const result = await tx.commit(token_ws);

    // --- Paso 2: Buscar nuestro registro de pago ---
    const [pagos] = await pool.query(
      'SELECT id_pago, id_pedido FROM pagos WHERE token_ws = ?',
      [token_ws]
    );

    if (pagos.length === 0) {
      console.error('Pago no encontrado para token:', token_ws);
      return res.redirect('/pago-fallido');
    }

    const pago = pagos[0];

    // --- Paso 3: Verificar resultado de Transbank ---
    // response_code === 0 significa APROBADO
    if (result.response_code === 0) {
      // ===== PAGO APROBADO =====

      // Actualizar el pago como Aprobado
      await pool.query(
        'UPDATE pagos SET estado = ?, metodo_pago = ? WHERE id_pago = ?',
        ['Aprobado', result.payment_type_code || 'Webpay', pago.id_pago]
      );

      // Actualizar el pedido como Aprobado
      await pool.query(
        'UPDATE pedidos SET estado = ? WHERE id_pedido = ?',
        ['Aprobado', pago.id_pedido]
      );

      // Crear factura automáticamente
      // El comprobante_pdf se genera como una ruta simbólica
      // En un sistema real se generaría un PDF con los datos del pedido
      const comprobantePdf = `/facturas/factura_pedido_${pago.id_pedido}.pdf`;
      await pool.query(
        'INSERT INTO facturas (id_pedido, comprobante_pdf) VALUES (?, ?)',
        [pago.id_pedido, comprobantePdf]
      );

      // Redirigir a página de éxito
      return res.redirect(`/pago-exitoso?pedido=${pago.id_pedido}`);

    } else {
      // ===== PAGO RECHAZADO =====
      // Según el Diagrama de Secuencia (imagen 5), cuando el pago
      // es rechazado se debe: "No descontar stock".
      // Como el stock YA se descontó al crear el pedido (en orderController),
      // aquí debemos RESTAURARLO.

      // Actualizar el pago como Rechazado
      await pool.query(
        'UPDATE pagos SET estado = ? WHERE id_pago = ?',
        ['Rechazado', pago.id_pago]
      );

      // Actualizar el pedido como Rechazado
      await pool.query(
        'UPDATE pedidos SET estado = ? WHERE id_pedido = ?',
        ['Rechazado', pago.id_pedido]
      );

      // --- Restaurar stock de los productos del pedido ---
      // Obtenemos los detalles del pedido para saber qué cantidades devolver
      const [detalles] = await pool.query(
        'SELECT id_producto, cantidad FROM detalle_pedido WHERE id_pedido = ?',
        [pago.id_pedido]
      );

      for (const detalle of detalles) {
        await pool.query(
          'UPDATE gestion_productos SET stock = stock + ? WHERE id_producto = ?',
          [detalle.cantidad, detalle.id_producto]
        );
      }

      // Redirigir a página de error
      return res.redirect('/pago-fallido');
    }

  } catch (error) {
    console.error('Error al confirmar pago:', error.message);
    // En caso de error, redirigir a página de error
    return res.redirect('/pago-fallido');
  }
};

// ============================================================
// OBTENER INFORMACIÓN DE PAGO DE UN PEDIDO
// ============================================================
// Devuelve los datos del pago asociado a un pedido específico.
// El frontend usa esto para mostrar el estado del pago.
//
// RUTA: GET /api/pagos/:idPedido
// MIDDLEWARE: isAuthenticated
// ============================================================
const obtenerPago = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { idPedido } = req.params;

    // --- Verificar que el pedido pertenezca al usuario ---
    const [pedidos] = await pool.query(
      'SELECT id_pedido FROM pedidos WHERE id_pedido = ? AND id_usuario = ?',
      [idPedido, userId]
    );

    if (pedidos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado.',
        data: null,
        errors: null
      });
    }

    // --- Obtener información del pago ---
    const [pagos] = await pool.query(
      'SELECT id_pago, id_pedido, estado, metodo_pago, monto, fecha_pago FROM pagos WHERE id_pedido = ? ORDER BY fecha_pago DESC LIMIT 1',
      [idPedido]
    );

    if (pagos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró información de pago para este pedido.',
        data: null,
        errors: null
      });
    }

    // --- Buscar factura asociada si existe ---
    const [facturas] = await pool.query(
      'SELECT id_factura, comprobante_pdf, fecha_emision FROM facturas WHERE id_pedido = ?',
      [idPedido]
    );

    return res.status(200).json({
      success: true,
      message: 'Información de pago obtenida exitosamente.',
      data: {
        pago: pagos[0],
        factura: facturas.length > 0 ? facturas[0] : null
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al obtener pago:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener información de pago.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// ============================================================
// EXPORTAR CONTROLADORES
// ============================================================
module.exports = {
  crearTransaccion,
  confirmarPago,
  obtenerPago
};
