import axios from 'axios';

const API_BASE_URL = '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Sessions API
export const sessionsApi = {
  getAll: () => api.get('/sessions'),
  getById: (id) => api.get(`/sessions/${id}`),
  create: (data) => api.post('/sessions', data),
  disconnect: (id) => api.delete(`/sessions/${id}`),
  getStats: () => api.get('/sessions/stats'),
};

// Messages API
export const messagesApi = {
  getBySession: (sessionId, params) => api.get(`/messages/${sessionId}`, { params }),
  getById: (id) => api.get(`/messages/msg/${id}`),
  send: (sessionId, data) => api.post(`/messages/${sessionId}/send`, data),
  getStats: (sessionId) => api.get(`/messages/${sessionId}/stats`),
  delete: (id) => api.delete(`/messages/msg/${id}`),
};

// Files API
export const filesApi = {
  getBySession: (sessionId, params) => api.get(`/files/${sessionId}`, { params }),
  getById: (id) => api.get(`/files/file/${id}`),
  upload: (sessionId, formData) => api.post(`/uploads/${sessionId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  getStats: (sessionId) => api.get(`/files/${sessionId}/stats`),
  delete: (id) => api.delete(`/files/file/${id}`),
};

// Stats API
export const statsApi = {
  getOverview: () => api.get('/stats/overview'),
  getQueueStats: () => api.get('/stats/queue'),
};

// Blast API
export const blastApi = {
  create: (data) => api.post('/blast', data),
  quickSend: (data) => api.post('/blast/quick-send', data),
  getAll: (params) => api.get('/blast', { params }),
  getStatus: (jobId) => api.get(`/blast/status/${jobId}`),
  cancel: (jobId) => api.delete(`/blast/${jobId}`),
};

// Bot API
export const botApi = {
  getAll: (sessionId) => api.get(`/bot/${sessionId}`),
  getById: (id) => api.get(`/bot/detail/${id}`),
  create: (data) => api.post('/bot', data),
  update: (id, data) => api.put(`/bot/${id}`, data),
  delete: (id) => api.delete(`/bot/${id}`),
  toggle: (id) => api.patch(`/bot/${id}/toggle`),
  test: (data) => api.post('/bot/test', data),
};

// Contacts API
export const contactsApi = {
  getAll: (sessionId, params) => api.get(`/contacts/${sessionId}`, { params }),
  getById: (id) => api.get(`/contacts/detail/${id}`),
  create: (data) => api.post('/contacts', data),
  update: (id, data) => api.put(`/contacts/${id}`, data),
  delete: (id) => api.delete(`/contacts/${id}`),
  import: (data) => api.post('/contacts/import', data),
  getTags: (sessionId) => api.get(`/contacts/tags/${sessionId}`),
};

export default api;
