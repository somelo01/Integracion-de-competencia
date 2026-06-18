// Controlador auth: gestiona registro, login, perfil, logout y recuperación.
// Usa bcrypt para hash de contraseñas y validación previa en middleware.
// Rutas en routes/authRoutes.js y pool de MySQL en config/db.js.

const bcrypt = require('bcryptjs');       // Librería para hashear contraseñas
const crypto = require('crypto');         // Módulo nativo de Node.js para generar tokens seguros
const { pool } = require('../config/db'); // Pool de conexiones MySQL

// registrar: crea usuario, hashea contraseña y crea carrito.
// Uso: POST /api/auth/registro
// Middleware previo: validateRegister
const registrar = async (req, res) => {
  try {
    const { email, nombre, contrasena } = req.body;

    // --- Paso 1: Verificar si el email ya está registrado ---
    // Usamos consulta parametrizada con ? para prevenir SQL Injection
    const [existingUsers] = await pool.query(
      'SELECT id_usuario FROM usuarios WHERE email = ?',
      [email]
    );

    // Si encontramos al menos un usuario con ese email, rechazar
    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'El email ya está registrado. Intente con otro o inicie sesión.',
        data: null,
        errors: [{ field: 'email', message: 'Email ya registrado' }]
      });
    }

    // --- Paso 2: Hashear la contraseña ---
    // genSalt(10) genera una sal con 10 rondas (buen balance seguridad/velocidad)
    // hash() combina la contraseña + sal y genera el hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(contrasena, salt);

    // --- Paso 3: Insertar el usuario en la BD ---
    // rol_usuario por defecto es 'Cliente' (definido en schema.sql)
    const [result] = await pool.query(
      'INSERT INTO usuarios (email, nombre, contrasena) VALUES (?, ?, ?)',
      [email, nombre, hashedPassword]
    );

    // result.insertId contiene el ID auto-generado del nuevo usuario
    const newUserId = result.insertId;

    // --- Paso 4: Crear el carrito de compras para el nuevo usuario ---
    // Relación 1:1 entre usuarios y carrito_compras (ERD imagen 4)
    await pool.query(
      'INSERT INTO carrito_compras (id_usuario) VALUES (?)',
      [newUserId]
    );

    // --- Paso 5: Responder con éxito ---
    return res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente. Ya puede iniciar sesión.',
      data: {
        id_usuario: newUserId,
        email: email,
        nombre: nombre
      },
      errors: null
    });

  } catch (error) {
    console.error('Error en registro:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al registrar usuario.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// login: valida credenciales y crea la sesión del usuario.
// Uso: POST /api/auth/login
// Middleware previo: validateLogin
const login = async (req, res) => {
  try {
    const { email, contrasena } = req.body;

    // --- Paso 1: Buscar usuario por email ---
    // Traemos todos los campos que necesitamos para la sesión
    const [users] = await pool.query(
      'SELECT id_usuario, email, nombre, contrasena, rol_usuario FROM usuarios WHERE email = ?',
      [email]
    );

    // Si no encontramos ningún usuario con ese email
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas. Verifique su email y contraseña.',
        data: null,
        errors: null
      });
    }

    const user = users[0];

    // --- Paso 2: Verificar la contraseña ---
    // bcrypt.compare() compara la contraseña en texto plano con el hash
    // almacenado en la BD. Internamente extrae la sal del hash y la usa
    // para hashear la contraseña enviada, luego compara los hashes.
    const isPasswordValid = await bcrypt.compare(contrasena, user.contrasena);

    if (!isPasswordValid) {
      // IMPORTANTE: Usamos el mismo mensaje genérico que cuando el email
      // no existe. Esto evita que un atacante descubra qué emails están
      // registrados (enumeración de usuarios).
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas. Verifique su email y contraseña.',
        data: null,
        errors: null
      });
    }

    // --- Paso 3: Crear la sesión ---
    // Guardar datos del usuario en req.session. Express-session
    // automáticamente los persiste en MySQL (via express-mysql-session)
    // y envía la cookie connect.sid al navegador.
    req.session.userId = user.id_usuario;
    req.session.userName = user.nombre;
    req.session.email = user.email;
    req.session.rol = user.rol_usuario;

    // --- Paso 4: Responder con éxito ---
    return res.status(200).json({
      success: true,
      message: `Bienvenido/a, ${user.nombre}`,
      data: {
        id_usuario: user.id_usuario,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol_usuario
      },
      errors: null
    });

  } catch (error) {
    console.error('Error en login:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al iniciar sesión.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// logout: destruye la sesión del usuario.
// Uso: POST /api/auth/logout
// Middleware previo: isAuthenticated
const logout = async (req, res) => {
  try {
    // destroy() elimina la sesión de la tabla 'sessions' en MySQL
    req.session.destroy((err) => {
      if (err) {
        console.error('Error al cerrar sesión:', err.message);
        return res.status(500).json({
          success: false,
          message: 'Error al cerrar sesión.',
          data: null,
          errors: [{ message: err.message }]
        });
      }

      // Eliminar la cookie del navegador
      // 'connect.sid' es el nombre por defecto de la cookie de express-session
      res.clearCookie('connect.sid');

      return res.status(200).json({
        success: true,
        message: 'Sesión cerrada exitosamente.',
        data: null,
        errors: null
      });
    });
  } catch (error) {
    console.error('Error en logout:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al cerrar sesión.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// obtenerPerfil: devuelve datos del usuario autenticado.
// Uso: GET /api/auth/perfil
// Middleware previo: isAuthenticated
const obtenerPerfil = async (req, res) => {
  try {
    // req.session.userId fue establecido durante el login
    const [users] = await pool.query(
      'SELECT id_usuario, email, nombre, rol_usuario, verificacion_email, fecha_creacion FROM usuarios WHERE id_usuario = ?',
      [req.session.userId]
    );

    // Verificación de seguridad: el usuario debería existir si tiene sesión
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado.',
        data: null,
        errors: null
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Perfil obtenido exitosamente.',
      data: users[0],
      errors: null
    });

  } catch (error) {
    console.error('Error al obtener perfil:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener perfil.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// editarPerfil: actualiza nombre y/o contraseña del usuario.
// Uso: PUT /api/auth/perfil
// Middleware previo: isAuthenticated
const editarPerfil = async (req, res) => {
  try {
    const { nombre, contrasena } = req.body;
    const userId = req.session.userId;

    // Al menos un campo debe ser enviado para actualizar
    if (!nombre && !contrasena) {
      return res.status(400).json({
        success: false,
        message: 'Debe enviar al menos un campo para actualizar (nombre o contrasena).',
        data: null,
        errors: [{ field: 'general', message: 'No hay datos para actualizar' }]
      });
    }

    // Construir la consulta dinámicamente según qué campos se envíen
    // Usamos arrays para construir el SET y los valores de forma segura
    const updates = [];
    const values = [];

    if (nombre && nombre.trim()) {
      updates.push('nombre = ?');
      values.push(nombre.trim());
    }

    if (contrasena) {
      // Si se envía nueva contraseña, hashearla
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(contrasena, salt);
      updates.push('contrasena = ?');
      values.push(hashedPassword);
    }

    // Agregar el userId al final del array de valores (para el WHERE)
    values.push(userId);

    // Ejecutar la actualización
    await pool.query(
      `UPDATE usuarios SET ${updates.join(', ')} WHERE id_usuario = ?`,
      values
    );

    // Si se actualizó el nombre, actualizar también la sesión
    if (nombre && nombre.trim()) {
      req.session.userName = nombre.trim();
    }

    return res.status(200).json({
      success: true,
      message: 'Perfil actualizado exitosamente.',
      data: null,
      errors: null
    });

  } catch (error) {
    console.error('Error al editar perfil:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al editar perfil.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// Solicitar recuperación de contraseña.
// Genera token seguro y guarda en recuperar_acceso.
// RUTA: POST /api/auth/recuperar
const solicitarRecuperacion = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El email es obligatorio.',
        data: null,
        errors: [{ field: 'email', message: 'Email requerido' }]
      });
    }

    // --- Paso 1: Verificar que el email existe ---
    const [users] = await pool.query(
      'SELECT id_usuario FROM usuarios WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (users.length === 0) {
      // SEGURIDAD: Respondemos con éxito aunque el email no exista.
      // Esto evita que un atacante descubra qué emails están registrados.
      return res.status(200).json({
        success: true,
        message: 'Si el email existe, se enviará un enlace de recuperación.',
        data: null,
        errors: null
      });
    }

    const userId = users[0].id_usuario;

    // --- Paso 2: Generar token aleatorio ---
    // 32 bytes → 64 caracteres hexadecimales
    const token = crypto.randomBytes(32).toString('hex');

    // --- Paso 3: Calcular fecha de expiración (1 hora desde ahora) ---
    const expiracion = new Date(Date.now() + 3600000); // 3600000 ms = 1 hora

    // --- Paso 4: Guardar en la tabla recuperar_acceso ---
    // El campo 'usado' empieza en 0 (definido en schema.sql)
    await pool.query(
      'INSERT INTO recuperar_acceso (id_usuario, token, expiracion) VALUES (?, ?, ?)',
      [userId, token, expiracion]
    );

    // --- Paso 5: Responder ---
    // En producción, NO devolver el token. Aquí lo hacemos por ser educativo.
    return res.status(200).json({
      success: true,
      message: 'Token de recuperación generado. En producción se enviaría por email.',
      data: {
        token: token,
        expiracion: expiracion,
        // URL que el usuario usaría (simulada)
        url_recuperacion: `/api/auth/reset/${token}`
      },
      errors: null
    });

  } catch (error) {
    console.error('Error al solicitar recuperación:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// Restablecer contraseña con token.
// Busca token válido, actualiza contraseña y marca como usado.
// RUTA: POST /api/auth/reset/:token
const restablecerContrasena = async (req, res) => {
  try {
    const { token } = req.params;
    const { contrasena } = req.body;

    // Validar que se envió la nueva contraseña
    if (!contrasena) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña es obligatoria.',
        data: null,
        errors: [{ field: 'contrasena', message: 'Contraseña requerida' }]
      });
    }

    // --- Paso 1: Buscar el token en la BD ---
    // Verificamos que no esté usado Y que no haya expirado
    const [tokens] = await pool.query(
      'SELECT id_recuperacion, id_usuario FROM recuperar_acceso WHERE token = ? AND usado = 0 AND expiracion > NOW()',
      [token]
    );

    if (tokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido o expirado. Solicite uno nuevo.',
        data: null,
        errors: null
      });
    }

    const { id_recuperacion, id_usuario } = tokens[0];

    // --- Paso 2: Hashear la nueva contraseña ---
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(contrasena, salt);

    // --- Paso 3: Actualizar la contraseña del usuario ---
    await pool.query(
      'UPDATE usuarios SET contrasena = ? WHERE id_usuario = ?',
      [hashedPassword, id_usuario]
    );

    // --- Paso 4: Marcar el token como usado ---
    // Esto evita que el mismo token se use más de una vez
    await pool.query(
      'UPDATE recuperar_acceso SET usado = 1 WHERE id_recuperacion = ?',
      [id_recuperacion]
    );

    return res.status(200).json({
      success: true,
      message: 'Contraseña actualizada exitosamente. Ya puede iniciar sesión.',
      data: null,
      errors: null
    });

  } catch (error) {
    console.error('Error al restablecer contraseña:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// Verificar sesión activa.
// Retorna datos de usuario si la sesión existe.
// RUTA: GET /api/auth/session
const verificarSesion = async (req, res) => {
  try {
    // Si hay datos de sesión, el usuario está logueado
    if (req.session && req.session.userId) {
      return res.status(200).json({
        success: true,
        message: 'Sesión activa.',
        data: {
          id_usuario: req.session.userId,
          nombre: req.session.userName,
          email: req.session.email,
          rol: req.session.rol
        },
        errors: null
      });
    }

    // No hay sesión activa
    return res.status(200).json({
      success: false,
      message: 'No hay sesión activa.',
      data: null,
      errors: null
    });

  } catch (error) {
    console.error('Error al verificar sesión:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al verificar sesión.',
      data: null,
      errors: [{ message: error.message }]
    });
  }
};

// Exportar controladores
module.exports = {
  registrar,
  login,
  logout,
  obtenerPerfil,
  editarPerfil,
  solicitarRecuperacion,
  restablecerContrasena,
  verificarSesion
};
