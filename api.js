/**
 * api.js – Frontend API client
 * All calls go to the Express backend (http://localhost:3000/api/*)
 * Falls back gracefully if server is unreachable.
 */

const Api = (() => {
 const BASE = '/api';
  async function request(method, path, body) {
    try {
      const res = await fetch(BASE + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Request failed');
      return json.data;
    } catch (e) {
      console.error(`API ${method} ${path} →`, e.message);
      throw e;
    }
  }

  const get = (path) => request('GET', path);
  const post = (path, body) => request('POST', path, body);
  const put = (path, body) => request('PUT', path, body);
  const del = (path) => request('DELETE', path);

  /* ── AUTH ── */
  const Auth = {
    login: (username, password) => post('/auth/login', { username, password }),
    signup: (data) => post('/auth/signup', data),
    getPending: () => get('/auth/pending'),
    getUsers: () => get('/auth/users'),
    approve: (username) => put(`/auth/approve/${username}`),
    reject: (username) => del(`/auth/reject/${username}`),
  };

  const Bins = {
    getAll: () => get('/bins'),
    add: (data) => post('/bins', data),
    updateFill: (id, fill) => put(`/bins/${id}/fill`, { fill }),
    remove: (id) => del(`/bins/${id}`),
    collect: (id) => post(`/bins/${id}/collect`),
  };

  /* ── TRUCKS ── */
  const Trucks = {
    getAll: () => get('/trucks'),
    add: (data) => post('/trucks', data),
    update: (id, data) => put(`/trucks/${id}`, data),
    remove: (id) => del(`/trucks/${id}`),
    reset: () => post('/trucks/reset'),
  };

  /* ── REPORTS ── */
  const Reports = {
    getAll: () => get('/reports'),
    add: (data) => post('/reports', data),
    updateStatus: (id, st) => put(`/reports/${id}/status`, { status: st }),
  };

  /* ── NOTIFICATIONS ── */
  const Notifs = {
    getAll: (role, driverId) => {
      const q = new URLSearchParams({ role: role || 'all', ...(driverId ? { driverId } : {}) });
      return get('/notifications?' + q);
    },
    add: (data) => post('/notifications', data),
    markRead: (id) => put(`/notifications/${id}/read`),
    markAllRead: (role, driverId) => put('/notifications/mark-all-read', { role, driverId }),
  };

  return { Auth, Bins, Trucks, Reports, Notifs };
})();
