import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const message = error.response?.data?.error || error.message || 'An error occurred';
    return Promise.reject(new Error(message));
  }
);

// API Methods
export const apiClient = {
  // Sessions
  getSessions: () => api.get('/sessions'),
  getSession: (sessionId) => api.get(`/sessions/${sessionId}`),
  createSession: (name) => api.post('/sessions', { name }),
  connectSession: (sessionId) => api.post(`/sessions/${sessionId}/connect`),
  disconnectSession: (sessionId) => api.post(`/sessions/${sessionId}/disconnect`),
  deleteSession: (sessionId) => api.delete(`/sessions/${sessionId}`),
  getSessionQR: (sessionId) => api.get(`/sessions/${sessionId}/qr`),
  getSessionStats: (sessionId) => api.get(`/sessions/${sessionId}/stats`),

  // Messages
  getMessages: (sessionId, params = {}) => api.get(`/messages/${sessionId}`, { params }),
  getMessage: (sessionId, messageId) => api.get(`/messages/${sessionId}/${messageId}`),
  sendMessage: (sessionId, data) => api.post(`/messages/${sessionId}/send`, data),
  sendMedia: (sessionId, data) => api.post(`/messages/${sessionId}/send-media`, data),
  getMessagesByDateRange: (sessionId, params) => api.get(`/messages/${sessionId}/date-range`, { params }),
  getConversation: (sessionId, phone, params) => api.get(`/messages/${sessionId}/conversation/${phone}`, { params }),

  // Files
  uploadFile: (sessionId, formData) => api.post(`/files/${sessionId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getFiles: (sessionId, params = {}) => api.get(`/files/${sessionId}`, { params }),
  getFile: (fileId) => api.get(`/files/info/${fileId}`),
  deleteFile: (fileId) => api.delete(`/files/${fileId}`),
  downloadFile: (fileId) => api.get(`/files/download/${fileId}`, { responseType: 'blob' }),
  getFileStatus: (sessionId, fileId) => api.get(`/files/${sessionId}/status/${fileId}`),

  // Webhook
  webhookSend: (data) => api.post('/webhook/send', data),
  webhookSendMedia: (data) => api.post('/webhook/send-media', data),
  webhookBroadcast: (data) => api.post('/webhook/broadcast', data),
  webhookHealth: () => api.get('/webhook/health'),
  webhookInfo: () => api.get('/webhook/info'),
};

export default api;
