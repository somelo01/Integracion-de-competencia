// Controlador productos: lista y busca productos activos del catálogo.
// SOLO muestra productos con activo=1.

const { pool } = require('../config/db');


// LISTAR PRODUCTOS
// Devuelve una lista paginada de productos activos.
const listarProductos = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    const [countResult] = await pool.query(
      'SELECT COUNT(*) AS total FROM gestion_productos WHERE activo = 1'
    );
    const totalProductos = countResult[0].total;

    const [productos] = await pool.query(
      'SELECT id_producto, nombre, categoria, precio, stock, talla, color, descripcion, imagen_url, fecha_creacion FROM gestion_productos WHERE activo = 1 ORDER BY fecha_creacion DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const totalPaginas = Math.ceil(totalProductos / limit);

    return res.status(200).json({
      success: true,
      message: 'Productos obtenidos exitosamente.',
      data: {
        productos: productos,
        paginacion: {
          paginaActual: page,
          totalPaginas: totalPaginas,
          totalProductos: totalProductos,
          productosPorPagina: limit
        }
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al listar productos:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener productos.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// BUSCAR PRODUCTOS
// Busca productos cuyo nombre o descripción contengan el término de búsqueda usando LIKE.
const buscarProductos = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un término de búsqueda (?q=término).',
        data: null,
        errors: [{ field: 'q', message: 'Término de búsqueda requerido' }]
      });
    }

    const searchTerm = `%${q.trim()}%`;

    const [productos] = await pool.query(
      'SELECT id_producto, nombre, categoria, precio, stock, talla, color, descripcion, imagen_url FROM gestion_productos WHERE activo = 1 AND (nombre LIKE ? OR descripcion LIKE ?) ORDER BY nombre ASC',
      [searchTerm, searchTerm]
    );

    return res.status(200).json({
      success: true,
      message: `Se encontraron ${productos.length} producto(s) para "${q.trim()}".`,
      data: {
        productos: productos,
        terminoBusqueda: q.trim(),
        totalResultados: productos.length
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al buscar productos:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al buscar productos.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// FILTRAR PRODUCTOS
// Filtra productos según múltiples criterios opcionales.
const filtrarProductos = async (req, res) => {
  try {
    const { categoria, precio_min, precio_max, talla, color } = req.query;

    let query = 'SELECT id_producto, nombre, categoria, precio, stock, talla, color, descripcion, imagen_url FROM gestion_productos WHERE activo = 1';
    const params = [];

    if (categoria && categoria.trim()) {
      query += ' AND categoria = ?';
      params.push(categoria.trim());
    }

    if (precio_min && !isNaN(precio_min)) {
      query += ' AND precio >= ?';
      params.push(parseFloat(precio_min));
    }

    if (precio_max && !isNaN(precio_max)) {
      query += ' AND precio <= ?';
      params.push(parseFloat(precio_max));
    }

    if (talla && talla.trim()) {
      query += ' AND talla = ?';
      params.push(talla.trim());
    }

    if (color && color.trim()) {
      query += ' AND color = ?';
      params.push(color.trim());
    }

    query += ' ORDER BY precio ASC';

    const [productos] = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      message: `Se encontraron ${productos.length} producto(s) con los filtros aplicados.`,
      data: {
        productos: productos,
        filtrosAplicados: { categoria, precio_min, precio_max, talla, color },
        totalResultados: productos.length
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al filtrar productos:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al filtrar productos.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// LISTAR CATEGORÍAS DISPONIBLES
// Devuelve la lista de categorías únicas de productos activos
const listarCategorias = async (req, res) => {
  try {
    const [categorias] = await pool.query(
      'SELECT DISTINCT categoria FROM gestion_productos WHERE activo = 1 ORDER BY categoria ASC'
    );

    const listaCategorias = categorias.map(row => row.categoria);

    return res.status(200).json({
      success: true,
      message: 'Categorías obtenidas exitosamente.',
      data: {
        categorias: listaCategorias,
        total: listaCategorias.length
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al listar categorías:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener categorías.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};


// OBTENER UN PRODUCTO POR ID
// Devuelve los detalles completos de un producto específico si está activo.
const obtenerProducto = async (req, res) => {
  try {
    const { id } = req.params;

    const [productos] = await pool.query(
      'SELECT id_producto, nombre, categoria, precio, stock, talla, color, descripcion, imagen_url, fecha_creacion FROM gestion_productos WHERE id_producto = ? AND activo = 1',
      [id]
    );

    if (productos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado.',
        data: null,
        errors: null
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Producto obtenido exitosamente.',
      data: productos[0],
      errors: null
    });

  } catch (error) {
    console.error('Error al obtener producto:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener producto.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// Exportar controladores
module.exports = {
  listarProductos,
  buscarProductos,
  filtrarProductos,
  listarCategorias,
  obtenerProducto
};