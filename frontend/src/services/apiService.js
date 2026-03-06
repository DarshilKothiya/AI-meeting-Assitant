/**
 * API service for HTTP communication with the backend
 */
import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);

    if (error.response) {
      const message =
        error.response.data?.detail ||
        error.response.data?.error ||
        error.message;
      throw new Error(message);
    } else if (error.request) {
      throw new Error('No response from server. Please check your connection.');
    } else {
      throw new Error(error.message);
    }
  }
);

class ApiService {
  async getSystemHealth() {
    const response = await api.get('/health');
    return response.data;
  }

  async getAudioDevices() {
    const response = await api.get('/audio/devices');
    return response.data;
  }

  async getConnectionStats() {
    const response = await api.get('/system/connections');
    return response.data;
  }

  async startSession(request = {}) {
    const response = await api.post('/sessions/start', request);
    return response.data;
  }

  async stopSession(sessionId) {
    const response = await api.post('/sessions/stop', { session_id: sessionId });
    return response.data;
  }

  async getActiveSessions() {
    const response = await api.get('/sessions/active');
    return response.data;
  }

  async getSessionStatus(sessionId) {
    const response = await api.get(`/sessions/${sessionId}/status`);
    return response.data;
  }

  async checkConnection() {
    try {
      await api.get('/health');
      return true;
    } catch (error) {
      return false;
    }
  }

  async waitForHealthy(maxAttempts = 10, delay = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const status = await this.getSystemHealth();
        if (status.status === 'healthy') {
          return true;
        }
      } catch (error) {
        console.log(`Health check attempt ${attempt}/${maxAttempts} failed:`, error);
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return false;
  }
}

export const apiService = new ApiService();
