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
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authAPI = {
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  register: (data: unknown) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users'),
  getRoles: () => api.get('/auth/roles'),
};

// Customers
export const customersAPI = {
  getAll: (params?: unknown) => api.get('/customers', { params }),
  getOne: (id: string) => api.get(`/customers/${id}`),
  create: (data: unknown) => api.post('/customers', data),
  update: (id: string, data: unknown) => api.put(`/customers/${id}`, data),
  delete: (id: string) => api.delete(`/customers/${id}`),
  createContact: (customerId: string, data: unknown) => api.post(`/customers/${customerId}/contacts`, data),
};

// Sales
export const salesAPI = {
  getOpportunities: (params?: unknown) => api.get('/sales/opportunities', { params }),
  getOpportunity: (id: string) => api.get(`/sales/opportunities/${id}`),
  createOpportunity: (data: unknown) => api.post('/sales/opportunities', data),
  updateOpportunity: (id: string, data: unknown) => api.put(`/sales/opportunities/${id}`, data),
  updateStage: (id: string, data: unknown) => api.patch(`/sales/opportunities/${id}/stage`, data),
  addActivity: (id: string, data: unknown) => api.post(`/sales/opportunities/${id}/activities`, data),
  getLeads: () => api.get('/sales/leads'),
  createLead: (data: unknown) => api.post('/sales/leads', data),
};

// Shipments
export const shipmentsAPI = {
  getAll: (params?: unknown) => api.get('/shipments', { params }),
  getOne: (id: string) => api.get(`/shipments/${id}`),
  create: (data: unknown) => api.post('/shipments', data),
  updateStatus: (id: string, data: unknown) => api.patch(`/shipments/${id}/status`, data),
  updateMilestone: (shipmentId: string, milestoneId: string, data: unknown) =>
    api.patch(`/shipments/${shipmentId}/milestones/${milestoneId}`, data),
};

// Tickets
export const ticketsAPI = {
  getAll: (params?: unknown) => api.get('/tickets', { params }),
  getOne: (id: string) => api.get(`/tickets/${id}`),
  create: (data: unknown) => api.post('/tickets', data),
  update: (id: string, data: unknown) => api.patch(`/tickets/${id}`, data),
  addComment: (id: string, data: unknown) => api.post(`/tickets/${id}/comments`, data),
};

// Finance
export const financeAPI = {
  getInvoices: (params?: unknown) => api.get('/finance/invoices', { params }),
  getInvoice: (id: string) => api.get(`/finance/invoices/${id}`),
  createInvoice: (data: unknown) => api.post('/finance/invoices', data),
  recordPayment: (data: unknown) => api.post('/finance/payments', data),
  getCosts: (shipmentId: string) => api.get(`/finance/shipments/${shipmentId}/costs`),
  addCost: (shipmentId: string, data: unknown) => api.post(`/finance/shipments/${shipmentId}/costs`, data),
};

// AI
export const aiAPI = {
  getInsights: () => api.get('/ai/insights'),
  predictDelay: (shipmentId: string) => api.get(`/ai/predict/shipment/${shipmentId}`),
  customerRisk: (customerId: string) => api.get(`/ai/risk/customer/${customerId}`),
  forecastRevenue: () => api.get('/ai/forecast/revenue'),
  scoreDeal: (opportunityId: string) => api.get(`/ai/score/deal/${opportunityId}`),
};

// Dashboard
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getRevenueChart: (params?: unknown) => api.get('/dashboard/revenue-chart', { params }),
  getShipmentChart: () => api.get('/dashboard/shipment-chart'),
  getSalesFunnel: () => api.get('/dashboard/sales-funnel'),
  getCustomerProfitability: () => api.get('/dashboard/customer-profitability'),
  getKPIs: (params?: unknown) => api.get('/dashboard/kpis', { params }),
};
