// Controlador pagos: integra Transbank Webpay Plus en sandbox.

const { pool } = require('../config/db');

const {
  WebpayPlus,
  Options,
  Environment,
  IntegrationCommerceCodes,
  IntegrationApiKeys
} = require('transbank-sdk');

// Instancia Webpay para crear y confirmar transacciones.
const tx = new WebpayPlus.Transaction(
  new Options(
    IntegrationCommerceCodes.WEBPAY_PLUS,  // Código de comercio de prueba
    IntegrationApiKeys.WEBPAY,              // API key de prueba
    Environment.Integration                 // Ambiente de pruebas (sandbox)
  )
);

// crearTransaccion: inicia pago Webpay para un pedido.
// Uso: POST /api/pagos/crear
// Middleware: isAuthenticated
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

// confirmarPago: procesa el callback de Webpay tras el pago.
// Uso: GET /api/pagos/confirmar?token_ws=XXX
// No requiere isAuthenticated porque viene del redirect de Webpay.
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

// Obtener información de pago de un pedido
// Devuelve los datos del pago asociado a un pedido específico.
// El frontend usa esto para mostrar el estado del pago.
// RUTA: GET /api/pagos/:idPedido
// MIDDLEWARE: isAuthenticated
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

// Exportar controladores
module.exports = {
  crearTransaccion,
  confirmarPago,
  obtenerPago
};
