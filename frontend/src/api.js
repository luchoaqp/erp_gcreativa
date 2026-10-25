// Usa la misma dirección con la que se abrió la página (localhost o la IP de la PC), puerto 5080.
// Se puede forzar con VITE_API_URL en frontend/.env
// - Modo desarrollo (puertos 5190/5173/4173): API en el puerto 5080 de la misma PC.
// - App instalada / servida por el backend o por un túnel HTTPS: la API está en el mismo origen (/api).
const DEV_PORTS = ['5190', '5173', '4173'];
const API_BASE_URL = import.meta.env.VITE_API_URL || (DEV_PORTS.includes(window.location.port)
  ? `${window.location.protocol}//${window.location.hostname}:5080/api`
  : `${window.location.origin}/api`);

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token_tienda_regalos');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Redirigir o limpiar sesión si es inválido
        if (endpoint !== '/auth/login') {
          localStorage.removeItem('token_tienda_regalos');
          localStorage.removeItem('user_tienda_regalos');
          window.location.reload();
        }
      }
      throw new Error(data.message || `Error en la petición (${response.status})`);
    }

    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

export const authAPI = {
  login: (email, password) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => apiFetch('/auth/me')
};

export const dashboardAPI = {
  getStats: () => apiFetch('/dashboard/stats')
};

export const productsAPI = {
  getAll: (params = '') => apiFetch(`/products${params}`),
  getById: (id) => apiFetch(`/products/${id}`),
  getLotes: (params = '') => apiFetch(`/products/lotes${params}`),
  updateLote: (id, data) => apiFetch(`/products/lotes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  pendingThumbs: () => apiFetch('/products/imagenes/pendientes'),
  saveThumb: (id, thumb) => apiFetch(`/products/${id}/miniatura`, { method: 'POST', body: JSON.stringify({ thumb }) }),
  create: (data) => apiFetch('/products', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiFetch(`/products/${id}`, { method: 'DELETE' }),
  setActive: (id, activo) => apiFetch(`/products/${id}/activo`, { method: 'PATCH', body: JSON.stringify({ activo }) }),
  packs: (params = '') => apiFetch(`/products/packs/list${params}`),
  reviewPack: (id, actualizar_precios) => apiFetch(`/products/packs/${id}/revisar`, { method: 'POST', body: JSON.stringify({ actualizar_precios }) }),
  brands: () => apiFetch('/products/brands'),
  createBrand: (nombre) => apiFetch('/products/brands', { method: 'POST', body: JSON.stringify({ nombre }) }),
  suppliers: () => apiFetch('/products/suppliers-lite'),
  nextCode: () => apiFetch('/products/next-code'),
  importExcel: (archivo, dry_run) => apiFetch('/products/excel/importar', { method: 'POST', body: JSON.stringify({ archivo, dry_run }) }),
  // Descarga un .xlsx generado por el servidor
  downloadExcel: async (tipo, nombre) => {
    const token = localStorage.getItem('token_tienda_regalos');
    const r = await fetch(`${API_BASE_URL}/products/excel/${tipo}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.message || 'No se pudo descargar el archivo'); }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
};

export const ordersAPI = {
  getAll: (params = '') => apiFetch(`/orders${params}`),
  getById: (id) => apiFetch(`/orders/${id}`),
  create: (data) => apiFetch('/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id, data) => apiFetch(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
  getDiseno: (id) => apiFetch(`/orders/${id}/diseno`),
  saveDiseno: (id, data) => apiFetch(`/orders/${id}/diseno`, { method: 'PUT', body: JSON.stringify(data) })
};

export const kardexAPI = {
  movements: (params = '') => apiFetch(`/kardex/movimientos${params}`),
  valued: (params = '') => apiFetch(`/kardex/valorizado${params}`)
};

export const reportHubAPI = {
  list: () => apiFetch('/report-hub'),
  run: (key, params = '') => apiFetch(`/report-hub/${key}${params}`)
};

export const shippingAPI = {
  list: (params = '') => apiFetch(`/shipping${params}`),
  saveData: (id, data) => apiFetch(`/shipping/${id}/datos`, { method: 'PUT', body: JSON.stringify(data) }),
  getGuide: (id) => apiFetch(`/shipping/${id}/guia`),
  couriers: () => apiFetch('/shipping/couriers'),
  saveCourier: (id, data) => apiFetch(id ? `/shipping/couriers/${id}` : '/shipping/couriers', { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) }),
  agencies: (params = '') => apiFetch(`/shipping/agencias${params}`),
  saveAgency: (id, data) => apiFetch(id ? `/shipping/agencias/${id}` : '/shipping/agencias', { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) }),
  deleteAgency: (id) => apiFetch(`/shipping/agencias/${id}`, { method: 'DELETE' }),
  importAgencies: (data) => apiFetch('/shipping/agencias/importar', { method: 'POST', body: JSON.stringify(data) }),
  saveGuide: (id, data) => apiFetch(`/shipping/${id}/guia`, { method: 'PUT', body: JSON.stringify(data) })
};

export const categoriesAPI = {
  getAll: () => apiFetch('/categories'),
  create: (data) => apiFetch('/categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiFetch(`/categories/${id}`, { method: 'DELETE' }),
  createOccasion: (data) => apiFetch('/categories/occasions', { method: 'POST', body: JSON.stringify(data) }),
  updateOccasion: (id, data) => apiFetch(`/categories/occasions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOccasion: (id) => apiFetch(`/categories/occasions/${id}`, { method: 'DELETE' })
};

export const usersAPI = {
  getAll: () => apiFetch('/users'),
  getRoles: () => apiFetch('/users/roles'),
  create: (data) => apiFetch('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleStatus: (id, estado) => apiFetch(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ estado }) }),
  delete: (id) => apiFetch(`/users/${id}`, { method: 'DELETE' })
};

export const customersAPI = {
  getAll: (params = '') => apiFetch(`/customers${params}`),
  create: (data) => apiFetch('/customers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiFetch(`/customers/${id}`, { method: 'DELETE' }),
  bulkEstado: (ids, estado) => apiFetch('/customers/bulk-estado', { method: 'POST', body: JSON.stringify({ ids, estado }) })
};

export const suppliersAPI = {
  getAll: (params = '') => apiFetch(`/suppliers${params}`),
  create: (data) => apiFetch('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiFetch(`/suppliers/${id}`, { method: 'DELETE' }),
  bulkEstado: (ids, estado) => apiFetch('/suppliers/bulk-estado', { method: 'POST', body: JSON.stringify({ ids, estado }) })
};

export const customerTypesAPI = {
  getAll: () => apiFetch('/customer-types'),
  create: (data) => apiFetch('/customer-types', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/customer-types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiFetch(`/customer-types/${id}`, { method: 'DELETE' })
};

export const purchasesAPI = {
  list: (params = '') => apiFetch(`/purchases${params}`),
  getById: (id) => apiFetch(`/purchases/${id}`),
  create: (data) => apiFetch('/purchases', { method: 'POST', body: JSON.stringify(data) }),
  addPayment: (id, data) => apiFetch(`/purchases/${id}/pagos`, { method: 'POST', body: JSON.stringify(data) }),
  annul: (id) => apiFetch(`/purchases/${id}/anular`, { method: 'POST' }),
  searchSuppliers: (q) => apiFetch(`/purchases/suppliers?search=${encodeURIComponent(q)}`),
  quickSupplier: (data) => apiFetch('/purchases/suppliers', { method: 'POST', body: JSON.stringify(data) })
};

export const expensesAPI = {
  list: (params = '') => apiFetch(`/expenses${params}`),
  getById: (id) => apiFetch(`/expenses/${id}`),
  nextCode: () => apiFetch('/expenses/next-code'),
  create: (data) => apiFetch('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  annul: (id) => apiFetch(`/expenses/${id}/anular`, { method: 'POST' })
};

export const catalogsAPI = {
  list: () => apiFetch('/catalogs'),
  create: (data) => apiFetch('/catalogs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/catalogs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => apiFetch(`/catalogs/${id}`, { method: 'DELETE' })
};

export const workshopAPI = {
  list: () => apiFetch('/workshop'),
  getById: (id) => apiFetch(`/workshop/${id}`),
  create: (data) => apiFetch('/workshop', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/workshop/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => apiFetch(`/workshop/${id}`, { method: 'DELETE' }),
  addRecord: (id, data) => apiFetch(`/workshop/${id}/registros`, { method: 'POST', body: JSON.stringify(data) }),
  removeRecord: (id, rid) => apiFetch(`/workshop/${id}/registros/${rid}`, { method: 'DELETE' })
};

export const lookupAPI = {
  document: (tipo, numero) => apiFetch(`/lookup/${tipo}/${numero}`)
};

export const quotesAPI = {
  getAll: (params = '') => apiFetch(`/quotes${params}`),
  getById: (id) => apiFetch(`/quotes/${id}`),
  create: (data) => apiFetch('/quotes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/quotes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  annul: (id) => apiFetch(`/quotes/${id}/anular`, { method: 'POST' }),
  convert: (id, data) => apiFetch(`/quotes/${id}/convertir`, { method: 'POST', body: JSON.stringify(data) }),
  getConfig: () => apiFetch('/quotes/config'),
  updateConfig: (data) => apiFetch('/quotes/config', { method: 'PUT', body: JSON.stringify(data) })
};

export const salesAPI = {
  list: (params = '') => apiFetch(`/sales${params}`),
  getById: (id) => apiFetch(`/sales/${id}`),
  docConfig: () => apiFetch('/sales/doc-config'),
  update: (id, data) => apiFetch(`/sales/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  duplicate: (id) => apiFetch(`/sales/${id}/duplicar`, { method: 'POST' }),
  addPayment: (id, data) => apiFetch(`/sales/${id}/pagos`, { method: 'POST', body: JSON.stringify(data) }),
  deletePayment: (id, pagoId) => apiFetch(`/sales/${id}/pagos/${pagoId}`, { method: 'DELETE' }),
  saveComprobanteDraft: (id, data) => apiFetch(`/sales/${id}/comprobante-borrador`, { method: 'PUT', body: JSON.stringify(data) }),
  createComprobante: (id, data) => apiFetch(`/sales/${id}/comprobantes`, { method: 'POST', body: JSON.stringify(data) }),
  annulComprobante: (id, cid) => apiFetch(`/sales/${id}/comprobantes/${cid}/anular`, { method: 'POST' }),
  annulSale: (id) => apiFetch(`/sales/${id}/anular`, { method: 'POST' })
};

export const settingsAPI = {
  get: () => apiFetch('/settings'),
  update: (data) => apiFetch('/settings', { method: 'PUT', body: JSON.stringify(data) })
};

export const backupAPI = {
  create: () => apiFetch('/backup/download'),
  getHistory: () => apiFetch('/backup/history'),
  getSummary: () => apiFetch('/backup/summary'),
  restore: (data) => apiFetch('/backup/restore', { method: 'POST', body: JSON.stringify(data) }),
  reset: (payload) => apiFetch('/backup/reset', { method: 'POST', body: JSON.stringify(payload) })
};
