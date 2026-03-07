import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // Try refresh token on 401 (but not on login/refresh routes themselves)
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh-token')
    ) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const resp = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });
          const newToken = resp.data?.data?.token;
          if (newToken) {
            localStorage.setItem('token', newToken);
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          }
        } catch {
          // refresh failed – fall through to logout
        }
      }
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────
export const authAPI = {
  // ── Bootstrap ─────────────────────────────────────────────
  /** GET /auth/setup-status → { needsSetup: boolean } */
  setupStatus: () => api.get('/auth/setup-status'),
  /** POST /auth/setup-admin → create first Admin (only when needsSetup=true) */
  setupAdmin: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => api.post('/auth/setup-admin', data),

  // ── Standard Auth ─────────────────────────────────────────
  login: (data: { email: string; password: string; rememberMe?: boolean }) =>
    api.post('/auth/login', data),
  // NOTE: public /register has been removed – use POST /auth/users (Admin-only)
  logout: (data?: { refreshToken?: string }) => api.post('/auth/logout', data || {}),
  me: () => api.get('/auth/me'),
  refreshToken: (token: string) => api.post('/auth/refresh-token', { refreshToken: token }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),

  // User Management (Admin only)
  getUsers: (params?: {
    search?: string;
    role?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => api.get('/auth/users', { params }),
  createUser: (data: unknown) => api.post('/auth/users', data),
  updateUser: (id: string, data: unknown) => api.put(`/auth/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/auth/users/${id}`),
  unlockUser: (id: string) => api.patch(`/auth/users/${id}/unlock`),
  adminResetPassword: (id: string, newPassword: string) =>
    api.patch(`/auth/users/${id}/reset-password`, { newPassword }),

  // Roles
  getRoles: () => api.get('/auth/roles'),

  // Preferences
  updatePreferences: (data: { language?: string; timezone?: string }) =>
    api.patch('/auth/preferences', data),

  // Audit logs (Admin only)
  getLoginAuditLogs: (params?: {
    userId?: string;
    result?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) => api.get('/auth/audit/login', { params }),

  getActivityLogs: (params?: {
    userId?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) => api.get('/auth/audit/activity', { params }),
};

// ── Customers ────────────────────────────────────────────────
export const customersAPI = {
  getAll: (params?: unknown) => api.get('/customers', { params }),
  getOne: (id: string) => api.get(`/customers/${id}`),
  create: (data: unknown) => api.post('/customers', data),
  update: (id: string, data: unknown) => api.put(`/customers/${id}`, data),
  delete: (id: string) => api.delete(`/customers/${id}`),
  createContact: (customerId: string, data: unknown) =>
    api.post(`/customers/${customerId}/contacts`, data),
};

// ── Sales ────────────────────────────────────────────────────
export const salesAPI = {
  getOpportunities: (params?: unknown) => api.get('/sales/opportunities', { params }),
  getOpportunity: (id: string) => api.get(`/sales/opportunities/${id}`),
  createOpportunity: (data: unknown) => api.post('/sales/opportunities', data),
  updateOpportunity: (id: string, data: unknown) =>
    api.put(`/sales/opportunities/${id}`, data),
  updateStage: (id: string, data: unknown) =>
    api.patch(`/sales/opportunities/${id}/stage`, data),
  addActivity: (id: string, data: unknown) =>
    api.post(`/sales/opportunities/${id}/activities`, data),
  getLeads: () => api.get('/sales/leads'),
  createLead: (data: unknown) => api.post('/sales/leads', data),
  updateLead: (id: string, data: unknown) => api.put(`/sales/leads/${id}`, data),
};

// ── Shipments ────────────────────────────────────────────────
export const shipmentsAPI = {
  getAll: (params?: unknown) => api.get('/shipments', { params }),
  getOne: (id: string) => api.get(`/shipments/${id}`),
  create: (data: unknown) => api.post('/shipments', data),
  updateStatus: (id: string, data: unknown) =>
    api.patch(`/shipments/${id}/status`, data),
  updateMilestone: (shipmentId: string, milestoneId: string, data: unknown) =>
    api.patch(`/shipments/${shipmentId}/milestones/${milestoneId}`, data),
};

// ── Tickets ──────────────────────────────────────────────────
export const ticketsAPI = {
  getAll: (params?: unknown) => api.get('/tickets', { params }),
  getOne: (id: string) => api.get(`/tickets/${id}`),
  create: (data: unknown) => api.post('/tickets', data),
  update: (id: string, data: unknown) => api.patch(`/tickets/${id}`, data),
  addComment: (id: string, data: unknown) => api.post(`/tickets/${id}/comments`, data),
};

// ── Finance ──────────────────────────────────────────────────
export const financeAPI = {
  getInvoices: (params?: unknown) => api.get('/finance/invoices', { params }),
  getInvoice: (id: string) => api.get(`/finance/invoices/${id}`),
  createInvoice: (data: unknown) => api.post('/finance/invoices', data),
  recordPayment: (data: unknown) => api.post('/finance/payments', data),
  getCosts: (shipmentId: string) =>
    api.get(`/finance/shipments/${shipmentId}/costs`),
  addCost: (shipmentId: string, data: unknown) =>
    api.post(`/finance/shipments/${shipmentId}/costs`, data),
};

// ── AI ───────────────────────────────────────────────────────
export const aiAPI = {
  getInsights: () => api.get('/ai/insights'),
  predictDelay: (shipmentId: string) => api.get(`/ai/predict/shipment/${shipmentId}`),
  customerRisk: (customerId: string) => api.get(`/ai/risk/customer/${customerId}`),
  forecastRevenue: () => api.get('/ai/forecast/revenue'),
  scoreDeal: (opportunityId: string) => api.get(`/ai/score/deal/${opportunityId}`),
};

// ── Dashboard ────────────────────────────────────────────────
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getRevenueChart: (params?: unknown) => api.get('/dashboard/revenue-chart', { params }),
  getShipmentChart: () => api.get('/dashboard/shipment-chart'),
  getSalesFunnel: () => api.get('/dashboard/sales-funnel'),
  getCustomerProfitability: () => api.get('/dashboard/customer-profitability'),
  getKPIs: (params?: unknown) => api.get('/dashboard/kpis', { params }),
  getSalesTeamPerformance: (params?: unknown) => api.get('/dashboard/sales-team-performance', { params }),
};

// ── Tasks ────────────────────────────────────────────────────
export const tasksAPI = {
  getAll:    (params?: unknown) => api.get('/tasks', { params }),
  getOne:    (id: string) => api.get(`/tasks/${id}`),
  getById:   (id: string) => api.get(`/tasks/${id}`),
  getStats:  ()                 => api.get('/tasks/stats'),
  create:    (data: unknown)    => api.post('/tasks', data),
  update:    (id: string, data: unknown) => api.put(`/tasks/${id}`, data),
  complete:  (id: string, data?: unknown) => api.patch(`/tasks/${id}/complete`, data || {}),
  delete:    (id: string)       => api.delete(`/tasks/${id}`),
  // Checklist
  getChecklist:        (taskId: string) => api.get(`/tasks/${taskId}/checklist`),
  addChecklistItem:    (taskId: string, data: unknown) => api.post(`/tasks/${taskId}/checklist`, data),
  toggleChecklistItem: (taskId: string, itemId: string, isDone: boolean) =>
    api.patch(`/tasks/${taskId}/checklist/${itemId}`, { isDone }),
  deleteChecklistItem: (taskId: string, itemId: string) =>
    api.delete(`/tasks/${taskId}/checklist/${itemId}`),
};

// ── Deals ────────────────────────────────────────────────────
export const dealsAPI = {
  getAll:     (params?: unknown) => api.get('/deals', { params }),
  getOne:     (id: string) => api.get(`/deals/${id}`),
  getPipeline: () => api.get('/deals/pipeline'),
  create:     (data: unknown) => api.post('/deals', data),
  update:     (id: string, data: unknown) => api.put(`/deals/${id}`, data),
  updateStage: (id: string, data: unknown) => api.patch(`/deals/${id}/stage`, data),
  delete:     (id: string) => api.delete(`/deals/${id}`),
  getActivities: (id: string) => api.get(`/deals/${id}/activities`),
  addActivity: (id: string, data: unknown) => api.post(`/deals/${id}/activities`, data),
};

// ── RFQs ─────────────────────────────────────────────────────
export const rfqsAPI = {
  getAll:  (params?: unknown) => api.get('/rfqs', { params }),
  getOne:  (id: string) => api.get(`/rfqs/${id}`),
  create:  (data: unknown) => api.post('/rfqs', data),
  update:  (id: string, data: unknown) => api.put(`/rfqs/${id}`, data),
};

// ── Quotations ───────────────────────────────────────────────
export const quotationsAPI = {
  getAll:  (params?: unknown) => api.get('/quotations', { params }),
  getOne:  (id: string) => api.get(`/quotations/${id}`),
  create:  (data: unknown) => api.post('/quotations', data),
  update:  (id: string, data: unknown) => api.put(`/quotations/${id}`, data),
  delete:  (id: string) => api.delete(`/quotations/${id}`),
};

// ── Documents ────────────────────────────────────────────────
export const documentsAPI = {
  getAll:    (params?: unknown) => api.get('/documents', { params }),
  getOne:    (id: string) => api.get(`/documents/${id}`),
  upload:    (formData: FormData) => api.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  createUrl: (data: unknown) => api.post('/documents', data),
  delete:    (id: string) => api.delete(`/documents/${id}`),
  download:  (id: string) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
};
