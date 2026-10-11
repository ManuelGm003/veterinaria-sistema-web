/**
 * VetSalud API Client Layer
 * Handles communication with the Express/Prisma backend
 */

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? `${window.location.origin}/api`
    : 'http://localhost:4000/api';

const Api = {
    getToken() {
        return localStorage.getItem('vetsalud_token');
    },

    setToken(token) {
        localStorage.setItem('vetsalud_token', token);
    },

    getUser() {
        const u = localStorage.getItem('vetsalud_user');
        return u ? JSON.parse(u) : null;
    },

    setUser(user) {
        localStorage.setItem('vetsalud_user', JSON.stringify(user));
    },

    clearAuth() {
        localStorage.removeItem('vetsalud_token');
        localStorage.removeItem('vetsalud_user');
    },

    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.message || data.error || data.mensaje || `Error ${res.status}`);
            }

            return data;
        } catch (err) {
            console.warn(`[Api Error at ${endpoint}]:`, err.message);
            throw err;
        }
    },

    // 1. Auth (RF-01)
    async login(email, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },

    // 2. Dashboard (RF-16)
    async getDashboard() {
        return this.request('/dashboard');
    },

    // 3. Productos (RF-03)
    async getProductos(search = '', categoriaId = '') {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (categoriaId) params.append('categoriaId', categoriaId);
        return this.request(`/productos?${params.toString()}`);
    },

    async createProducto(data) {
        return this.request('/productos', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async updateProducto(id, data) {
        return this.request(`/productos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async deleteProducto(id) {
        return this.request(`/productos/${id}`, { method: 'DELETE' });
    },

    // 4. Categorías (RF-04)
    async getCategorias() {
        return this.request('/categorias');
    },

    async createCategoria(data) {
        return this.request('/categorias', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    // 5. Proveedores (RF-05)
    async getProveedores() {
        return this.request('/proveedores');
    },

    async createProveedor(data) {
        return this.request('/proveedores', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    // 6. Inventario y Lotes (RF-06, RF-07, RF-09, RF-10, RF-11)
    async getLotes(idProducto = '') {
        const query = idProducto ? `?idProducto=${idProducto}` : '';
        return this.request(`/inventario/lotes${query}`);
    },

    async registrarEntrada(data) {
        return this.request('/inventario/entradas', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async getEntradas() {
        return this.request('/inventario/entradas');
    },

    async ajustarLote(idLote, nuevaCantidad, motivo) {
        return this.request(`/inventario/lotes/${idLote}/ajuste`, {
            method: 'PUT',
            body: JSON.stringify({ nuevaCantidad, motivo })
        });
    },

    // 7. Prescripciones Médicas (RF-13)
    async validarPrescripcion(codigo) {
        return this.request(`/prescripciones/validar/${encodeURIComponent(codigo)}`);
    },

    async getPrescripciones() {
        return this.request('/prescripciones');
    },

    async createPrescripcion(data) {
        return this.request('/prescripciones', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    // 8. Ventas / POS (RF-08, RF-12, RF-13)
    async registrarVenta(data) {
        return this.request('/ventas', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async getVentas(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.request(`/ventas${qs ? '?' + qs : ''}`);
    },

    async anularVenta(id) {
        return this.request(`/ventas/${id}`, { method: 'DELETE' });
    },

    // 9. Usuarios & Roles (RF-02)
    async getUsuarios() {
        return this.request('/usuarios');
    },

    async getRoles() {
        return this.request('/usuarios/roles');
    },

    async createUsuario(data) {
        return this.request('/usuarios', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async toggleUsuario(id) {
        return this.request(`/usuarios/${id}/toggle`, { method: 'PATCH' });
    },

    // 10. Reportes (RF-14, RF-15)
    async getReporteVentas(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.request(`/reportes/ventas${qs ? '?' + qs : ''}`);
    },

    async getReporteInventario() {
        return this.request('/reportes/inventario');
    },

    // 11. Configuración
    async getConfiguracion() {
        return this.request('/configuracion');
    },

    async updateConfiguracion(data) {
        return this.request('/configuracion', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
};

window.Api = Api;
