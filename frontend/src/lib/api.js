import axios from 'axios';
import { toast } from 'sonner';

/* -------------------------------------------------
   CONFIGURACIÓN BÁSICA
   ------------------------------------------------- */
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL?.trim().replace(/\/+$/, '')
  ? process.env.REACT_APP_BACKEND_URL.trim().replace(/\/+$/, '')
  : 'http://localhost:4000';   

const api = axios.create({
  baseURL: BACKEND_URL,
  withCredentials: true,       
});

api.interceptors.request.use(config => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  } else {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    const { response, config } = error;
    const skipError = config?._skipAuthError;          // ← nuestro flag
    const isAuthRoute =
      config?.url?.includes('auth/login') ||
      config?.url?.includes('auth/me') ||
      config?.url?.includes('auth/register') ||
      config?.url?.includes('auth/microsoft');

    // ----- 401 -----------------------------------------------------------
    if (response?.status === 401) {
      // Si la petición es /auth/me → solo quedamos en “no autenticado”
      if (skipError) {
        // No redirigimos, no toast. Sólo devolvemos el error para que
        // el catch del caller lo pueda manejar (AuthContext lo hace).
        return Promise.reject(error);
      }

      // Para cualquier otro 401 fuera de las rutas de login/registro…
      if (!isAuthRoute) {
        window.location.href = '/login';
      }
    }

    // ----- Mensaje de error (toast) ---------------------------------------
    // No mostrar toast si la petición está marcada como “silenciosa”
    if (!skipError) {
      const mensaje =
        response?.data?.detail ||
        response?.data?.error ||
        error.message ||
        'Error inesperado';

      toast.error(mensaje);
    }

    return Promise.reject(error);
  }
);

export const toFormData = obj => {
  const form = new FormData();
  Object.entries(obj).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (value instanceof File || value instanceof Blob) {
      form.append(key, value);
    } else if (Array.isArray(value) && value[0] instanceof File) {
      value.forEach(file => form.append(key, file));
    } else {
      form.append(key, JSON.stringify(value));
    }
  });
  return form;
};

/* -------------------------------------------------
   AUTH - prefixed /api because mounted first
   ------------------------------------------------- */
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }), // si tienes otro login
  microsoft: (payload) => api.post('/auth/microsoft', payload),
  logout: () => api.post('/auth/logout'),   // este endpoint debe borrar la cookie
  getMe: (opts = {}) => api.get('/auth/me', opts),         // GET /auth/me devuelve user (no necesita token)
};

/* --------------------------------------------------------------
   ALL OTHER APIs - NO prefix (backend app.use('/api', routes))
   -------------------------------------------------------------- */
export const usersAPI = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

export const hotelsAPI = {
  getAll: () => api.get('/hotels'),
  create: (data) => api.post('/hotels', data),
  update: (id, data) => api.put(`/hotels/${id}`, data),
  delete: (id) => api.delete(`/hotels/${id}`),
};

export const solutionTypesAPI = {
  getAll: () => api.get('/solution-types'),
  create: (payload) => api.post('/solution-types', payload),
  update: (id, payload) => api.put(`/solution-types/${id}`, payload),
  delete: (id) => api.delete(`/solution-types/${id}`),
};

export const ticketsReportAPI = {
  getStats: (params = {}) => api.get('/ticketsreport/stats', { params }),
  exportReport: (params) =>
    api.get('/ticketsreport/export', {
      params,
      responseType: 'blob',
    }),
};

export const departmentsAPI = {
  getAll: () => api.get('/departments'),
  create: (data) => api.post('/departments', data),
  update: (id, data) => api.put(`/departments/${id}`, data),
  delete: (id) => api.delete(`/departments/${id}`),
};

export const ticketTypesAPI = {
  getAll: () => api.get('/ticket-types'),
  create: (data) => api.post('/ticket-types', data),
  delete: (id) => api.delete(`/ticket-types/${id}`),
};

export const ticketsAPI = {
  getAll: (params) => api.get('/tickets', { params }),
  getById: (id, opts = {}) => {
    const search = new URLSearchParams(opts).toString();
    return api.get(`/tickets/${id}${search ? `?${search}` : ''}`);
  },
  create: (data) => api.post('/tickets', data),
  update: (id, data) => api.put(`/tickets/${id}`, data),
  reopen: (id) => api.post(`/tickets/${id}/reopen`),
  addComment: (id, data) => api.post(`/tickets/${id}/comments`, data),
  assign: (id, assigneeId) => api.post(`/tickets/${id}/assign`, { assignee_id: assigneeId }),
  take: (id) => api.post(`/tickets/${id}/take`),
  deleteTicket: (id) => api.delete(`/tickets/${id}`),
  uploadAttachment: (ticketId, files) => {
    const form = new FormData();
    const arr = Array.isArray(files) ? files : [files];
    arr.forEach((file) => form.append('file', file));
    return api.post(`/tickets/${ticketId}/attachments`, form);
  },
  listAttachments: (ticketId) => api.get(`/tickets/${ticketId}/attachments`),
  deleteAttachment: (attachmentId) => api.delete(`/attachments/${attachmentId}`),
  getMetadata: () => api.get("/tickets/metadata"),
};

export const suggestionsAPI = {
  getByProjectId: (projectId) => api.get(`/suggestions/project/${projectId}`),
  getAll: (params) => api.get('/suggestions', { params }),
  getById: (id) => api.get(`/suggestions/${id}`),
  create: (data) => api.post('/suggestions', data),
  update: (id, data) => api.put(`/suggestions/${id}`, data),
  take: (id) => api.post(`/suggestions/${id}/take`),
  delete: (id) => api.delete(`/suggestions/${id}`),
  uploadAttachment: (suggestionId, files) => {
    const form = new FormData();
    const arr = Array.isArray(files) ? files : [files];
    arr.forEach((file) => form.append('file', file));
    return api.post(`/suggestions/${suggestionId}/attachments`, form);
  },
  listAttachments: (suggestionId) => api.get(`/suggestions/${suggestionId}/attachments`),
  deleteAttachment: (attachmentId) => api.delete(`/attachments/${attachmentId}`),
};

export const projectsAPI = {
  getAll: (params) => api.get('/projects', { params }),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
};

export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export const rolesAPI = {
  getAll: () => api.get('/roles'),
  create: (data) => api.post('/roles', data),
  delete: (id) => api.delete(`/roles/${id}`),
};

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
};

export const seedAPI = {
  seed: () => api.post('/seed'),
};

export const mapHotelsAPI = {
  getAll: () => api.get("/map-hotels").then(r => r.data),
  search: (text) => api.get("/map-hotels", { params: { search: text } }).then(r => r.data),
  getById: (id) => api.get(`/map-hotels/${id}`).then(r => r.data),
  create: (payload) => api.post("/map-hotels", payload).then(r => r.data),
  update: (id, payload) => api.put(`/map-hotels/${id}`, payload).then(r => r.data),
  delete: (id) => api.delete(`/map-hotels/${id}`).then(r => r.data),
};

export default api;
