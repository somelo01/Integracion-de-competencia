// catalog.js - muestra el catálogo, filtros, búsqueda y detalle de producto.


// Inicia el catálogo según la página activa.
document.addEventListener('DOMContentLoaded', () => {
  // Detectar en qué página estamos y ejecutar la función correspondiente
  const productGrid = document.getElementById('product-grid');
  const productDetail = document.getElementById('product-detail');
  const featuredGrid = document.getElementById('featured-products');

  // Página de catálogo completo
  if (productGrid) {
    initCatalog();
  }

  // Página de detalle de producto
  if (productDetail) {
    initProductDetail();
  }

  // Sección de productos destacados en landing page
  if (featuredGrid) {
    loadFeaturedProducts();
  }
});


// Estado global de paginación del catálogo.
let currentPage = 1;
const productsPerPage = 12;


// Configura búsqueda, filtros y carga inicial del catálogo.
async function initCatalog() {
  // Cargar la lista de categorías para el filtro lateral
  await loadCategories();

  // Cargar productos de la primera página
  loadProducts();

  // Búsqueda con debounce para no enviar peticiones por cada tecla.
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    // Crear versión "debounced" de la función de búsqueda
    const debouncedSearch = debounce((query) => {
      currentPage = 1; // Reiniciar a página 1 al buscar
      if (query.trim().length >= 2) {
        searchProducts(query.trim());
      } else if (query.trim().length === 0) {
        loadProducts(); // Si borra todo, mostrar todos los productos
      }
    }, 400);

    searchInput.addEventListener('input', (e) => {
      debouncedSearch(e.target.value);
    });
  }

  // Botón para aplicar filtros.
  const filterBtn = document.getElementById('btn-apply-filters');
  if (filterBtn) {
    filterBtn.addEventListener('click', () => {
      currentPage = 1;
      applyFilters();
    });
  }

  // Botón de limpiar filtros
  const clearBtn = document.getElementById('btn-clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearFilters();
    });
  }
}


// Carga productos paginados y muestra tarjetas en el grid.
async function loadProducts() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  // Mostrar spinner de carga mientras se obtienen los datos
  grid.innerHTML = `
    <div class="col-12 text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Cargando productos...</span>
      </div>
      <p class="mt-2 text-muted">Cargando productos...</p>
    </div>
  `;

  try {
    const response = await apiRequest(`/api/productos?page=${currentPage}&limit=${productsPerPage}`);

    if (response.success && response.data) {
      // response.data puede ser un array de productos o un objeto con { productos, total, paginas }
      const products = Array.isArray(response.data) ? response.data : (response.data.productos || []);
      const totalPages = response.data.paginas || 1;

      if (products.length === 0) {
        grid.innerHTML = `
          <div class="col-12 text-center py-5">
            <i class="bi bi-search" style="font-size: 3rem; color: #ccc;"></i>
            <p class="text-muted mt-2">No se encontraron productos.</p>
          </div>
        `;
        return;
      }

      // Renderizar las tarjetas de producto
      renderProductCards(grid, products);

      // Renderizar la paginación
      renderPagination(totalPages);
    } else {
      grid.innerHTML = `
        <div class="col-12 text-center py-5">
          <p class="text-danger">Error al cargar los productos.</p>
        </div>
      `;
    }
  } catch (error) {
    grid.innerHTML = `
      <div class="col-12 text-center py-5">
        <p class="text-danger">Error de conexión con el servidor.</p>
      </div>
    `;
  }
}


// Busca productos por texto y actualiza el grid.
async function searchProducts(query) {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  grid.innerHTML = `
    <div class="col-12 text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Buscando...</span>
      </div>
      <p class="mt-2 text-muted">Buscando "${query}"...</p>
    </div>
  `;

  try {
    // Usar encodeURIComponent para manejar caracteres especiales en la búsqueda
    const response = await apiRequest(`/api/productos/buscar?q=${encodeURIComponent(query)}`);

    if (response.success && response.data) {
      const products = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.productos)
          ? response.data.productos
          : [];

      if (products.length === 0) {
        grid.innerHTML = `
          <div class="col-12 text-center py-5">
            <i class="bi bi-search" style="font-size: 3rem; color: #ccc;"></i>
            <p class="text-muted mt-2">No se encontraron resultados para "${query}".</p>
            <button class="btn btn-outline-primary mt-2" onclick="loadProducts()">
              <i class="bi bi-arrow-left me-1"></i>Ver todos los productos
            </button>
          </div>
        `;
        return;
      }

      renderProductCards(grid, products);
      // Ocultar paginación en búsqueda
      const paginationContainer = document.getElementById('pagination-container');
      if (paginationContainer) paginationContainer.innerHTML = '';
    }
  } catch (error) {
    grid.innerHTML = `
      <div class="col-12 text-center py-5">
        <p class="text-danger">Error al buscar productos.</p>
      </div>
    `;
  }
}


// Aplica filtros y actualiza el catálogo con resultados filtrados.
async function applyFilters() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  // Leer valores de los filtros
  const categoria = document.getElementById('filter-category')?.value || '';
  const precioMin = document.getElementById('filter-price-min')?.value || '';
  const precioMax = document.getElementById('filter-price-max')?.value || '';
  const talla = document.getElementById('filter-size')?.value || '';
  const color = document.getElementById('filter-color')?.value || '';

  // Construir la query string solo con filtros que tengan valor
  const params = new URLSearchParams();
  if (categoria) params.append('categoria', categoria);
  if (precioMin) params.append('precio_min', precioMin);
  if (precioMax) params.append('precio_max', precioMax);
  if (talla) params.append('talla', talla);
  if (color) params.append('color', color);

  // Si no hay filtros, cargar todos los productos
  if (params.toString() === '') {
    loadProducts();
    return;
  }

  grid.innerHTML = `
    <div class="col-12 text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Filtrando...</span>
      </div>
    </div>
  `;

  try {
    const response = await apiRequest(`/api/productos/filtrar?${params.toString()}`);

    if (response.success && response.data) {
      const products = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.productos)
          ? response.data.productos
          : [];

      if (products.length === 0) {
        grid.innerHTML = `
          <div class="col-12 text-center py-5">
            <i class="bi bi-funnel" style="font-size: 3rem; color: #ccc;"></i>
            <p class="text-muted mt-2">No se encontraron productos con esos filtros.</p>
            <button class="btn btn-outline-primary mt-2" onclick="clearFilters()">
              <i class="bi bi-x-circle me-1"></i>Limpiar filtros
            </button>
          </div>
        `;
        return;
      }

      renderProductCards(grid, products);
    }
  } catch (error) {
    grid.innerHTML = `
      <div class="col-12 text-center py-5">
        <p class="text-danger">Error al filtrar productos.</p>
      </div>
    `;
  }
}


// Limpia los filtros y recarga los productos.
function clearFilters() {
  // Limpiar cada control de filtro
  const filterCategory = document.getElementById('filter-category');
  const filterPriceMin = document.getElementById('filter-price-min');
  const filterPriceMax = document.getElementById('filter-price-max');
  const filterSize = document.getElementById('filter-size');
  const filterColor = document.getElementById('filter-color');
  const searchInput = document.getElementById('search-input');

  if (filterCategory) filterCategory.value = '';
  if (filterPriceMin) filterPriceMin.value = '';
  if (filterPriceMax) filterPriceMax.value = '';
  if (filterSize) filterSize.value = '';
  if (filterColor) filterColor.value = '';
  if (searchInput) searchInput.value = '';

  currentPage = 1;
  loadProducts();
}


// Carga categorías para el filtro lateral.
async function loadCategories() {
  const categorySelect = document.getElementById('filter-category');
  if (!categorySelect) return;

  try {
    const response = await apiRequest('/api/productos/categorias');

    if (response.success && response.data) {
      const categories = Array.isArray(response.data) ? response.data : [];

      // Agregar cada categoría como opción del <select>
      categories.forEach(cat => {
        const option = document.createElement('option');
        // cat puede ser un string o un objeto { categoria: 'nombre' }
        option.value = typeof cat === 'string' ? cat : cat.categoria;
        option.textContent = typeof cat === 'string' ? cat : cat.categoria;
        categorySelect.appendChild(option);
      });
    }
  } catch (error) {
    console.warn('No se pudieron cargar las categorías:', error);
  }
}


// Genera las tarjetas de producto en el grid.
function renderProductCards(container, products) {
  // Generar HTML de cada tarjeta usando template literals
  container.innerHTML = products.map(product => `
    <div class="col-6 col-md-4 col-lg-3 mb-4 animate-in">
      <div class="card product-card h-100">
        <!-- Imagen del producto (clickeable → ir al detalle) -->
        <a href="/pages/product.html?id=${product.id_producto || product.id}">
          <img src="${product.imagen_url || '/img/placeholder.png'}"
               class="card-img-top"
               alt="${product.nombre || 'Producto'}"
               onerror="this.src='/img/placeholder.png'">
        </a>
        <div class="card-body d-flex flex-column">
          <!-- Categoría del producto -->
          <span class="product-category mb-1">${product.categoria || 'Sin categoría'}</span>

          <!-- Nombre del producto (clickeable) -->
          <a href="/pages/product.html?id=${product.id_producto || product.id}"
             class="text-decoration-none">
            <h6 class="card-title">${product.nombre || 'Producto'}</h6>
          </a>

          <!-- Precio -->
          <p class="product-price mt-auto mb-2">${formatCurrency(product.precio)}</p>

          <!-- Botón agregar al carrito -->
          <button class="btn btn-add-cart btn-sm w-100"
                  onclick="event.stopPropagation(); addToCartFromCatalog(${product.id_producto || product.id})">
            <i class="bi bi-cart-plus me-1"></i>Agregar
          </button>
        </div>
      </div>
    </div>
  `).join('');
}


// Muestra la paginación del catálogo.
function renderPagination(totalPages) {
  const container = document.getElementById('pagination-container');
  if (!container || totalPages <= 1) {
    if (container) container.innerHTML = '';
    return;
  }

  let paginationHTML = '<nav><ul class="pagination justify-content-center">';

  // Botón "Anterior"
  paginationHTML += `
    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;">
        <i class="bi bi-chevron-left"></i> Anterior
      </a>
    </li>
  `;

  // Números de página
  for (let i = 1; i <= totalPages; i++) {
    paginationHTML += `
      <li class="page-item ${currentPage === i ? 'active' : ''}">
        <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
      </li>
    `;
  }

  // Botón "Siguiente"
  paginationHTML += `
    <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;">
        Siguiente <i class="bi bi-chevron-right"></i>
      </a>
    </li>
  `;

  paginationHTML += '</ul></nav>';
  container.innerHTML = paginationHTML;
}


// Cambia la página y recarga productos.
function changePage(page) {
  currentPage = page;
  loadProducts();
  // Scroll suave hacia arriba para ver los nuevos productos
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


// Agrega un producto al carrito desde el catálogo.
async function addToCartFromCatalog(productId) {
  try {
    const response = await apiRequest('/api/carrito/agregar', 'POST', {
      id_producto: productId,
      cantidad: 1
    });

    if (response.success) {
      // Mostrar feedback visual temporal
      showToast('Producto agregado al carrito');
      // Actualizar el contador del carrito en el navbar
      loadCartCount();
    } else {
      // Si no está logueado, redirigir al login
      if (response.message && response.message.toLowerCase().includes('sesión')) {
        window.location.href = '/pages/login.html';
        return;
      }
      showToast(response.message || 'Error al agregar al carrito', 'danger');
    }
  } catch (error) {
    showToast('Error de conexión', 'danger');
  }
}


// Muestra un toast temporal en pantalla.
function showToast(message, type = 'success') {
  // Crear o encontrar el contenedor de toasts
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
    toastContainer.style.zIndex = '1080';
    document.body.appendChild(toastContainer);
  }

  const bgClass = type === 'success' ? 'bg-success' : 'bg-danger';
  const icon = type === 'success' ? 'bi-check-circle' : 'bi-exclamation-circle';

  const toastHTML = `
    <div class="toast align-items-center text-white ${bgClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          <i class="bi ${icon} me-2"></i>${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
      </div>
    </div>
  `;

  toastContainer.insertAdjacentHTML('beforeend', toastHTML);

  // Obtener el último toast añadido y mostrarlo con Bootstrap
  const toastElement = toastContainer.lastElementChild;
  const bsToast = new bootstrap.Toast(toastElement, { delay: 3000 });
  bsToast.show();

  // Limpiar el toast del DOM después de que se oculte
  toastElement.addEventListener('hidden.bs.toast', () => {
    toastElement.remove();
  });
}


// Carga y muestra los datos del producto desde la URL.
async function initProductDetail() {
  const container = document.getElementById('product-detail');
  if (!container) return;

  // Leer el ID del producto desde la URL
  const productId = getQueryParam('id');

  if (!productId || !REGEX.ID.test(productId)) {
    container.innerHTML = `
      <div class="text-center py-5">
        <h3 class="text-danger">Producto no encontrado</h3>
        <p class="text-muted">El ID del producto es inválido.</p>
        <a href="/pages/catalog.html" class="btn btn-primary mt-2">
          <i class="bi bi-arrow-left me-1"></i>Volver al catálogo
        </a>
      </div>
    `;
    return;
  }

  // Mostrar spinner mientras carga
  container.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Cargando producto...</span>
      </div>
    </div>
  `;

  try {
    const response = await apiRequest(`/api/productos/${productId}`);

    if (response.success && response.data) {
      const product = response.data;
      renderProductDetail(container, product);
    } else {
      container.innerHTML = `
        <div class="text-center py-5">
          <h3 class="text-danger">Producto no encontrado</h3>
          <a href="/pages/catalog.html" class="btn btn-primary mt-2">
            <i class="bi bi-arrow-left me-1"></i>Volver al catálogo
          </a>
        </div>
      `;
    }
  } catch (error) {
    container.innerHTML = `
      <div class="text-center py-5">
        <p class="text-danger">Error al cargar el producto.</p>
      </div>
    `;
  }
}


// Renderiza la página de detalle de un producto.
function renderProductDetail(container, product) {
  container.innerHTML = `
    <div class="row animate-in">
      <!-- Columna izquierda: imagen del producto -->
      <div class="col-md-6 mb-4">
        <img src="${product.imagen_url || '/img/placeholder.png'}"
             class="img-fluid rounded shadow"
             alt="${product.nombre}"
             style="max-height: 500px; width: 100%; object-fit: cover;"
             onerror="this.src='/img/placeholder.png'">
      </div>

      <!-- Columna derecha: información del producto -->
      <div class="col-md-6">
        <!-- Categoría como badge -->
        <span class="badge bg-secondary mb-2">${product.categoria || 'Sin categoría'}</span>

        <!-- Nombre del producto -->
        <h2 class="fw-bold mb-3">${product.nombre}</h2>

        <!-- Precio grande -->
        <p class="product-price fs-3 mb-3">${formatCurrency(product.precio)}</p>

        <!-- Descripción -->
        <p class="text-muted mb-4">${product.descripcion || 'Sin descripción disponible.'}</p>

        <!-- Información adicional (talla, color si existen) -->
        ${product.talla ? `<p><strong>Talla:</strong> ${product.talla}</p>` : ''}
        ${product.color ? `<p><strong>Color:</strong> ${product.color}</p>` : ''}

        <!-- Stock disponible -->
        <p class="mb-3">
          <strong>Disponibilidad:</strong>
          ${product.stock > 0
            ? `<span class="text-success"><i class="bi bi-check-circle me-1"></i>En stock (${product.stock} disponibles)</span>`
            : '<span class="text-danger"><i class="bi bi-x-circle me-1"></i>Agotado</span>'}
        </p>

        <!-- Contenedor de alertas para esta página -->
        <div id="product-alerts"></div>

        <!-- Selector de cantidad y botón agregar -->
        ${product.stock > 0 ? `
          <div class="d-flex align-items-center gap-3 mb-4">
            <label for="product-quantity" class="fw-bold">Cantidad:</label>
            <input type="number" id="product-quantity"
                   class="form-control cart-quantity-input"
                   value="1" min="1" max="${product.stock}">
          </div>
          <button class="btn btn-add-cart btn-lg w-100"
                  id="btn-add-to-cart"
                  data-product-id="${product.id_producto || product.id}">
            <i class="bi bi-cart-plus me-2"></i>Agregar al Carrito
          </button>
        ` : `
          <button class="btn btn-secondary btn-lg w-100" disabled>
            <i class="bi bi-x-circle me-2"></i>Producto Agotado
          </button>
        `}

        <!-- Link para volver al catálogo -->
        <a href="/pages/catalog.html" class="btn btn-outline-secondary mt-3 w-100">
          <i class="bi bi-arrow-left me-1"></i>Volver al catálogo
        </a>
      </div>
    </div>
  `;

  // Evento para agregar el producto al carrito desde el detalle.
  const addBtn = document.getElementById('btn-add-to-cart');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const quantityInput = document.getElementById('product-quantity');
      const cantidad = parseInt(quantityInput.value);

      // Validar cantidad
      if (!cantidad || cantidad < 1) {
        showAlert('product-alerts', 'La cantidad debe ser al menos 1.', 'warning');
        return;
      }

      setButtonLoading(addBtn, 'Agregando...');

      try {
        const response = await apiRequest('/api/carrito/agregar', 'POST', {
          id_producto: parseInt(addBtn.dataset.productId),
          cantidad: cantidad
        });

        if (response.success) {
          showAlert('product-alerts', `¡${cantidad} producto(s) agregado(s) al carrito!`, 'success');
          loadCartCount(); // Actualizar badge del carrito
        } else {
          if (response.message && response.message.toLowerCase().includes('sesión')) {
            window.location.href = '/pages/login.html';
            return;
          }
          showAlert('product-alerts', response.message || 'Error al agregar al carrito.', 'danger');
        }
        resetButton(addBtn);
      } catch (error) {
        showAlert('product-alerts', 'Error de conexión.', 'danger');
        resetButton(addBtn);
      }
    });
  }
}


// Carga productos destacados para la página principal.
async function loadFeaturedProducts() {
  const grid = document.getElementById('featured-products');
  if (!grid) return;

  try {
    // Cargar solo los primeros 4 productos
    const response = await apiRequest('/api/productos?page=1&limit=4');

    if (response.success && response.data) {
      const products = Array.isArray(response.data) ? response.data : (response.data.productos || []);

      if (products.length > 0) {
        renderProductCards(grid, products);
      } else {
        grid.innerHTML = `
          <div class="col-12 text-center">
            <p class="text-muted">Próximamente: nuevos productos.</p>
          </div>
        `;
      }
    }
  } catch (error) {
    grid.innerHTML = `
      <div class="col-12 text-center">
        <p class="text-muted">No se pudieron cargar los productos destacados.</p>
      </div>
    `;
  }
}
