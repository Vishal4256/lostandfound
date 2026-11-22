import axios from 'axios';

let rawBaseUrl = (import.meta.env.VITE_API_URL || '').trim();

// Normalize URL: strip trailing slashes and /api suffix if present,
// since all frontend endpoints already prefix with '/api/...'
if (rawBaseUrl.endsWith('/api/')) {
  rawBaseUrl = rawBaseUrl.slice(0, -5);
} else if (rawBaseUrl.endsWith('/api')) {
  rawBaseUrl = rawBaseUrl.slice(0, -4);
}
rawBaseUrl = rawBaseUrl.replace(/\/+$/, '');

// If running in production (not localhost) and VITE_API_URL was omitted, fallback to Render backend
if (!rawBaseUrl && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  rawBaseUrl = 'https://lostandfound-f74b.onrender.com';
}

const API_BASE_URL = rawBaseUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach Authorization Bearer token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('findit_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Global response interceptor for 401 handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // If token expired, clear invalid auth
      const currentToken = localStorage.getItem('findit_token');
      if (currentToken) {
        localStorage.removeItem('findit_token');
        localStorage.removeItem('findit_user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
export { API_BASE_URL };
