/**
 * VetSalud Application Controller
 * Handles Navigation, State, Reactive UI, POS Cart, Prescription Verification & Chart.js
 */

const App = {
    currentUser: null,
    currentSection: 'dashboard',
    chartVentas7Dias: null,
    chartCategoriasPie: null,

    init() {
        this.setupEventListeners();
        this.checkAuth();
        this.updateDateDisplay();
    },

    updateDateDisplay() {
        const el = document.getElementById('nav-date-display');
        if (el) {
            const now = new Date();
            el.textContent = now.toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }
    },

    setupEventListeners() {
        // Form login
        const formLogin = document.getElementById('form-login');
        if (formLogin) {
            formLogin.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Close modal on background click
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    Modals.close(modal.id);
                }
            });
        });
    },

    checkAuth() {
        const user = Api.getUser();
        if (user) {
            this.currentUser = user;
            this.showMainApp();
        } else {
            this.showLogin();
        }
    },

    showLogin() {
        const overlay = document.getElementById('login-overlay');
        if (overlay) overlay.style.display = 'flex';
    },

    showMainApp() {
        const overlay = document.getElementById('login-overlay');
        if (overlay) overlay.style.display = 'none';

        // Update profile in sidebar
        if (this.currentUser) {
            document.getElementById('sidebar-user-name').textContent = this.currentUser.nombre;
            document.getElementById('sidebar-user-role').textContent = this.currentUser.rol || 'Administrador';
            
            const initials = this.currentUser.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            document.getElementById('sidebar-avatar').textContent = initials || 'VS';

            // Rol permissions adjustment (Bodeguero / Cajero UI tweaks)
            const navUsuarios = document.getElementById('nav-item-usuarios');
            if (navUsuarios && this.currentUser.rol === 'Cajero') {
                navUsuarios.style.display = 'none';
            } else if (navUsuarios) {
                navUsuarios.style.display = 'flex';
            }
        }

        // Initial data loads
        this.navigateTo('dashboard');
        this.loadDashboardData();
        this.loadSelectOptions();
    },

    setDemoUser(role) {
        if (role === 'admin') {
            document.getElementById('login-email').value = 'admin@veterinaria.com';
            document.getElementById('login-password').value = 'admin123';
        } else if (role === 'cajero') {
            document.getElementById('login-email').value = 'cajero@veterinaria.com';
            document.getElementById('login-password').value = 'cajero123';
        } else if (role === 'bodeguero') {
            document.getElementById('login-email').value = 'bodeguero@veterinaria.com';
            document.getElementById('login-password').value = 'bodeguero123';
        }
    },

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const res = await Api.login(email, password);
            Api.setToken(res.token);
            Api.setUser(res.usuario);
            this.currentUser = res.usuario;
            this.showToast('¡Bienvenido! Sesión iniciada con éxito', 'success');
            this.showMainApp();
        } catch (err) {
            this.showToast(`Error al iniciar sesión: ${err.message}`, 'error');
        }
    },

    logout() {
        Api.clearAuth();
        this.currentUser = null;
        this.showLogin();
        this.showToast('Sesión cerrada correctamente', 'info');
    },

    navigateTo(sectionId) {
        this.currentSection = sectionId;

        // Highlight nav item
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === sectionId) {
                item.classList.add('active');
            }
        });

        // Hide all sections, show target
        document.querySelectorAll('.page-section').forEach(sec => {
            sec.classList.remove('active');
        });

        const target = document.getElementById(`section-${sectionId}`);
        if (target) {
            target.classList.add('active');
        }

        // Update breadcrumbs
        const titles = {
            'dashboard': 'Dashboard Principal',
            'pos': 'Punto de Venta (POS)',
            'productos': 'Gestión de Productos',
            'categorias': 'Gestión de Categorías',
            'proveedores': 'Gestión de Proveedores',
            'inventario': 'Inventario, Lotes y Entradas',
            'prescripciones': 'Prescripciones Médicas',
            'reportes': 'Reportes de Ventas e Inventario',
            'usuarios': 'Gestión de Usuarios',
            'configuracion': 'Configuración del Sistema'
        };
        document.getElementById('breadcrumb-title').textContent = titles[sectionId] || sectionId;

        // Load section specific data
        switch (sectionId) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'productos':
                this.loadProductos();
                break;
            case 'categorias':
                this.loadCategorias();
                break;
            case 'proveedores':
                this.loadProveedores();
                break;
            case 'inventario':
                this.loadInventario();
                break;
            case 'pos':
                POS.init();
                break;
            case 'prescripciones':
                this.loadPrescripciones();
                break;
            case 'reportes':
                this.loadReportes();
                break;
            case 'usuarios':
                this.loadUsuarios();
                break;
            case 'configuracion':
                this.loadConfiguracion();
                break;
        }
    },

    toggleTheme() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('vetsalud_theme', isDark ? 'dark' : 'light');
        const icon = document.querySelector('#btn-theme-toggle i');
        if (icon) {
            icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
        // Redraw charts with adapted themes
        if (this.currentSection === 'dashboard') {
            this.loadDashboardData();
        }
    },

    toggleSidebar() {
        document.getElementById('app-sidebar').classList.toggle('open');
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            'success': 'fa-circle-check',
            'error': 'fa-circle-exclamation',
            'warning': 'fa-triangle-exclamation',
            'info': 'fa-circle-info'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fa-solid ${icons[type] || 'fa-info'}"></i> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    // =========================================================================
    // DASHBOARD DATA & CHARTS
    // =========================================================================
    async loadDashboardData() {
        try {
            const data = await Api.getDashboard();
            
            // 1. KPIs
            document.getElementById('kpi-ventas-dia').textContent = `C$ ${Number(data.kpis.ventasDelDia).toLocaleString('es-NI', { minimumFractionDigits: 2 })}`;
            document.getElementById('kpi-total-productos').textContent = data.kpis.totalProductos;
            document.getElementById('kpi-stock-bajo').textContent = data.kpis.stockBajo;
            document.getElementById('kpi-proximos-vencer').textContent = data.kpis.proximosAVencer;

            // 2. Gráfico 7 Días
            this.renderVentasChart(data.ventasUltimos7Dias);

            // 3. Gráfico Categorías Pie
            this.renderCategoriasChart(data.categoriasStats);

            // 4. Alertas y notificaciones del sistema (Page 14 Wireframe)
            const alertList = document.getElementById('dashboard-alert-list');
            alertList.innerHTML = '';
            
            if (data.alertasRecientes && data.alertasRecientes.length > 0) {
                document.getElementById('badge-total-alertas').textContent = `${data.alertasRecientes.length} Alertas`;
                data.alertasRecientes.forEach(al => {
                    const nivelClass = al.nivel.toLowerCase();
                    const icon = al.tipo === 'vencimiento' ? 'fa-calendar-xmark' : (al.tipo === 'stock' ? 'fa-box-archive' : 'fa-receipt');
                    
                    const item = document.createElement('div');
                    item.className = `alert-item ${nivelClass}`;
                    item.innerHTML = `
                        <i class="fa-solid ${icon}"></i>
                        <div class="alert-content">
                            <strong>[${al.nivel}]</strong> ${al.mensaje}
                        </div>
                        <div class="alert-time">${new Date(al.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    `;
                    alertList.appendChild(item);
                });
            } else {
                alertList.innerHTML = '<div style="color:var(--text-muted); padding: 12px; text-align:center;">No hay alertas críticas en este momento.</div>';
            }
        } catch (err) {
            console.error('Error cargando dashboard:', err);
        }
    },

    renderVentasChart(dias) {
        const ctx = document.getElementById('chart-ventas-7dias');
        if (!ctx) return;

        if (this.chartVentas7Dias) {
            this.chartVentas7Dias.destroy();
        }

        const labels = dias.map(d => d.dia);
        const values = dias.map(d => d.total);

        this.chartVentas7Dias = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Ventas (C$)',
                    data: values,
                    borderColor: '#0d9488',
                    backgroundColor: 'rgba(13, 148, 136, 0.15)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 3,
                    pointBackgroundColor: '#0d9488',
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: v => 'C$ ' + v
                        }
                    }
                }
            }
        });
    },

    renderCategoriasChart(stats) {
        const ctx = document.getElementById('chart-categorias-pie');
        if (!ctx) return;

        if (this.chartCategoriasPie) {
            this.chartCategoriasPie.destroy();
        }

        const labels = stats.map(s => s.nombre);
        const data = stats.map(s => s.total > 0 ? s.total : s.cantidadProductos * 50);

        this.chartCategoriasPie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: ['#0d9488', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12 }
                    }
                }
            }
        });
    },

    // =========================================================================
    // PRODUCTOS (RF-03)
    // =========================================================================
    async loadProductos() {
        const search = document.getElementById('filtro-producto-search').value;
        const categoriaId = document.getElementById('filtro-producto-categoria').value;

        try {
            const productos = await Api.getProductos(search, categoriaId);
            const tbody = document.getElementById('tbody-productos');
            tbody.innerHTML = '';

            if (productos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 20px;">No se encontraron productos.</td></tr>';
                return;
            }

            productos.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${p.codigoBarras || `P-${p.id}`}</strong></td>
                    <td>
                        <div style="font-weight: 700;">${p.nombre}</div>
                        <div style="font-size: 11.5px; color: var(--text-muted);">${p.descripcion || ''}</div>
                    </td>
                    <td><span class="badge badge-info">${p.categoria?.nombre || 'General'}</span></td>
                    <td>${p.tipo}</td>
                    <td>C$ ${Number(p.precioCompra).toFixed(2)}</td>
                    <td style="font-weight: 700; color: var(--primary);">C$ ${Number(p.precioVenta).toFixed(2)}</td>
                    <td>
                        <span class="badge ${p.stockTotal <= p.stockMinimo ? 'badge-danger' : 'badge-success'}">
                            ${p.stockTotal} unid.
                        </span>
                    </td>
                    <td>
                        ${p.requierePrescripcion 
                            ? '<span class="badge badge-receta-obligatoria"><i class="fa-solid fa-file-medical"></i> Obligatoria (RF-13)</span>' 
                            : '<span class="badge badge-receta-libre"><i class="fa-solid fa-check"></i> Venta Libre</span>'}
                    </td>
                    <td><span class="badge badge-success">Activo</span></td>
                    <td style="text-align:center;">
                        <button class="btn btn-secondary btn-sm" onclick="App.editProducto(${p.id})"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-danger btn-sm" onclick="App.deleteProducto(${p.id})"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (err) {
            this.showToast('Error cargando productos', 'error');
        }
    },

    async saveProducto(e) {
        e.preventDefault();
        const id = document.getElementById('prod-id').value;
        const data = {
            nombre: document.getElementById('prod-nombre').value,
            codigoBarras: document.getElementById('prod-codigo').value,
            idCategoria: document.getElementById('prod-categoria').value,
            tipo: document.getElementById('prod-tipo').value,
            idProveedor: document.getElementById('prod-proveedor').value,
            precioCompra: document.getElementById('prod-precio-compra').value,
            precioVenta: document.getElementById('prod-precio-venta').value,
            stockMinimo: document.getElementById('prod-stock-min').value,
            requierePrescripcion: document.getElementById('prod-requiere-receta').checked
        };

        try {
            if (id) {
                await Api.updateProducto(id, data);
                this.showToast('Producto actualizado correctamente', 'success');
            } else {
                await Api.createProducto(data);
                this.showToast('Producto registrado exitosamente', 'success');
            }
            Modals.close('modal-producto');
            this.loadProductos();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async editProducto(id) {
        try {
            const res = await Api.request(`/productos/${id}`);
            document.getElementById('modal-producto-title').textContent = 'Editar Producto';
            document.getElementById('prod-id').value = res.id;
            document.getElementById('prod-nombre').value = res.nombre;
            document.getElementById('prod-codigo').value = res.codigoBarras || '';
            document.getElementById('prod-categoria').value = res.idCategoria;
            document.getElementById('prod-tipo').value = res.tipo;
            document.getElementById('prod-proveedor').value = res.idProveedor || '';
            document.getElementById('prod-precio-compra').value = res.precioCompra;
            document.getElementById('prod-precio-venta').value = res.precioVenta;
            document.getElementById('prod-stock-min').value = res.stockMinimo;
            document.getElementById('prod-requiere-receta').checked = res.requierePrescripcion;

            Modals.open('modal-producto');
        } catch (err) {
            this.showToast('Error cargando datos del producto', 'error');
        }
    },

    async deleteProducto(id) {
        if (!confirm('¿Desea desactivar este producto del catálogo?')) return;
        try {
            await Api.deleteProducto(id);
            this.showToast('Producto eliminado', 'success');
            this.loadProductos();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    // =========================================================================
    // CATEGORÍAS (RF-04)
    // =========================================================================
    async loadCategorias() {
        try {
            const list = await Api.getCategorias();
            const tbody = document.getElementById('tbody-categorias');
            tbody.innerHTML = '';

            list.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>#${c.id}</td>
                    <td><strong>${c.nombre}</strong></td>
                    <td>${c.descripcion || '-'}</td>
                    <td><span class="badge badge-info">${c._count?.productos || 0} productos</span></td>
                    <td><span class="badge badge-success">Activo</span></td>
                    <td style="text-align:center;">
                        <button class="btn btn-secondary btn-sm" onclick="App.deleteCategoria(${c.id})"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
        }
    },

    async saveCategoria(e) {
        e.preventDefault();
        const data = {
            nombre: document.getElementById('cat-nombre').value,
            descripcion: document.getElementById('cat-descripcion').value
        };
        try {
            await Api.createCategoria(data);
            this.showToast('Categoría creada', 'success');
            Modals.close('modal-categoria');
            this.loadCategorias();
            this.loadSelectOptions();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async deleteCategoria(id) {
        if (!confirm('¿Eliminar esta categoría?')) return;
        try {
            await Api.request(`/categorias/${id}`, { method: 'DELETE' });
            this.showToast('Categoría eliminada', 'success');
            this.loadCategorias();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    // =========================================================================
    // PROVEEDORES (RF-05)
    // =========================================================================
    async loadProveedores() {
        try {
            const list = await Api.getProveedores();
            const tbody = document.getElementById('tbody-proveedores');
            tbody.innerHTML = '';

            list.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>#${p.id}</td>
                    <td><strong>${p.nombre}</strong></td>
                    <td>${p.telefono || '-'}</td>
                    <td>${p.email || '-'}</td>
                    <td>${p.direccion || '-'}</td>
                    <td><span class="badge badge-success">Activo</span></td>
                    <td style="text-align:center;">
                        <button class="btn btn-secondary btn-sm" onclick="App.deleteProveedor(${p.id})"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
        }
    },

    async saveProveedor(e) {
        e.preventDefault();
        const data = {
            nombre: document.getElementById('prov-nombre').value,
            telefono: document.getElementById('prov-telefono').value,
            email: document.getElementById('prov-email').value,
            direccion: document.getElementById('prov-direccion').value
        };
        try {
            await Api.createProveedor(data);
            this.showToast('Proveedor registrado con éxito', 'success');
            Modals.close('modal-proveedor');
            this.loadProveedores();
            this.loadSelectOptions();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async deleteProveedor(id) {
        if (!confirm('¿Eliminar este proveedor?')) return;
        try {
            await Api.request(`/proveedores/${id}`, { method: 'DELETE' });
            this.showToast('Proveedor eliminado', 'success');
            this.loadProveedores();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    // =========================================================================
    // INVENTARIO, LOTES Y ENTRADAS (RF-06, RF-07, RF-09, RF-11)
    // =========================================================================
    async loadInventario() {
        try {
            // Lotes
            const lotes = await Api.getLotes();
            const tbodyLotes = document.getElementById('tbody-lotes');
            tbodyLotes.innerHTML = '';

            lotes.forEach(l => {
                const tr = document.createElement('tr');
                let badgeClass = 'badge-success';
                if (l.estadoVencimiento === 'Crítico') badgeClass = 'badge-danger';
                else if (l.estadoVencimiento === 'Próximo a Vencer') badgeClass = 'badge-warning';
                else if (l.estadoVencimiento === 'Vencido') badgeClass = 'badge-danger';

                tr.innerHTML = `
                    <td><strong>${l.numeroLote}</strong></td>
                    <td>${l.producto?.nombre}</td>
                    <td><span class="badge badge-info">${l.producto?.categoria?.nombre || '-'}</span></td>
                    <td>${new Date(l.fechaVencimiento).toLocaleDateString()}</td>
                    <td><strong>${l.diasParaVencer} días</strong></td>
                    <td><span class="badge badge-purple">${l.cantidad} unid.</span></td>
                    <td><span class="badge ${badgeClass}">${l.estadoVencimiento}</span></td>
                    <td style="text-align:center;">
                        <button class="btn btn-secondary btn-sm" onclick="App.openAjusteModal(${l.id}, '${l.numeroLote}', '${l.producto?.nombre}', ${l.cantidad})">
                            <i class="fa-solid fa-sliders"></i> Ajustar
                        </button>
                    </td>
                `;
                tbodyLotes.appendChild(tr);
            });

            // Entradas
            const entradas = await Api.getEntradas();
            const tbodyEnt = document.getElementById('tbody-entradas');
            tbodyEnt.innerHTML = '';

            entradas.forEach(e => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>ENT-${e.id}</strong></td>
                    <td>${new Date(e.fecha).toLocaleDateString()}</td>
                    <td>${e.proveedor?.nombre || 'Proveedor Directo'}</td>
                    <td><span class="badge badge-success">${e.totalProductos} unid.</span></td>
                    <td>${e.observaciones || '-'}</td>
                `;
                tbodyEnt.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
        }
    },

    openAjusteModal(id, lote, prodNombre, cant) {
        document.getElementById('ajuste-lote-id').value = id;
        document.getElementById('ajuste-lote-info').textContent = `Lote: ${lote} | Producto: ${prodNombre} (Stock actual: ${cant})`;
        document.getElementById('ajuste-cantidad').value = cant;
        Modals.open('modal-ajuste-lote');
    },

    async saveAjusteLote(e) {
        e.preventDefault();
        const id = document.getElementById('ajuste-lote-id').value;
        const nuevaCantidad = document.getElementById('ajuste-cantidad').value;
        const motivo = document.getElementById('ajuste-motivo').value;

        try {
            await Api.ajustarLote(id, nuevaCantidad, motivo);
            this.showToast('Stock del lote ajustado correctamente', 'success');
            Modals.close('modal-ajuste-lote');
            this.loadInventario();
            this.loadDashboardData();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async saveEntradaInventario(e) {
        e.preventDefault();
        const data = {
            idProveedor: document.getElementById('ent-proveedor').value,
            fecha: document.getElementById('ent-fecha').value,
            observaciones: document.getElementById('ent-obs').value,
            productos: [{
                idProducto: document.getElementById('ent-producto').value,
                numeroLote: document.getElementById('ent-lote-num').value,
                fechaVencimiento: document.getElementById('ent-vencimiento').value,
                cantidad: document.getElementById('ent-cantidad').value,
                precioCompra: document.getElementById('ent-precio-compra').value
            }]
        };

        try {
            await Api.registrarEntrada(data);
            this.showToast('Entrada de inventario y lote registrados exitosamente', 'success');
            Modals.close('modal-entrada');
            this.loadInventario();
            this.loadDashboardData();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    // =========================================================================
    // PRESCRIPCIONES MÉDICAS (RF-13)
    // =========================================================================
    async loadPrescripciones() {
        try {
            const list = await Api.getPrescripciones();
            const tbody = document.getElementById('tbody-prescripciones');
            tbody.innerHTML = '';

            list.forEach(p => {
                const tr = document.createElement('tr');
                const meds = p.detalles?.map(d => `${d.producto?.nombre} (Cant: ${d.cantidad})`).join(', ') || 'N/A';
                
                tr.innerHTML = `
                    <td><strong>${p.numero}</strong></td>
                    <td>${new Date(p.fecha).toLocaleDateString()}</td>
                    <td>${p.cliente}</td>
                    <td>${p.veterinario}</td>
                    <td><span style="font-size:12px;">${meds}</span></td>
                    <td>
                        <span class="badge ${p.estado === 'Activa' ? 'badge-success' : 'badge-warning'}">
                            ${p.estado}
                        </span>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
        }
    },

    async verificarRecetaDirecta() {
        const codigo = document.getElementById('input-check-receta').value;
        const resBox = document.getElementById('resultado-check-receta');
        if (!codigo) return;

        try {
            const res = await Api.validarPrescripcion(codigo);
            if (res.valido) {
                resBox.innerHTML = `
                    <div style="padding: 10px; background-color: var(--success-light); color: var(--success); border-radius: var(--radius-md); font-weight: 600;">
                        <i class="fa-solid fa-check"></i> <strong>Receta Válida:</strong> ${res.prescripcion.numero} | Tutor: ${res.prescripcion.cliente} | Veterinario: ${res.prescripcion.veterinario} | Estado: ${res.prescripcion.estado}
                    </div>
                `;
            }
        } catch (err) {
            resBox.innerHTML = `
                <div style="padding: 10px; background-color: var(--danger-light); color: var(--danger); border-radius: var(--radius-md); font-weight: 600;">
                    <i class="fa-solid fa-xmark"></i> <strong>Inválida:</strong> ${err.message}
                </div>
            `;
        }
    },

    async savePrescripcion(e) {
        e.preventDefault();
        const data = {
            numero: document.getElementById('rec-codigo').value,
            cliente: document.getElementById('rec-cliente').value,
            veterinario: document.getElementById('rec-veterinario').value,
            observaciones: document.getElementById('rec-observaciones').value,
            detalles: [{
                idProducto: document.getElementById('rec-producto').value,
                cantidad: document.getElementById('rec-cantidad').value,
                indicaciones: document.getElementById('rec-indicaciones').value
            }]
        };

        try {
            await Api.createPrescripcion(data);
            this.showToast('Prescripción médica guardada', 'success');
            Modals.close('modal-prescripcion');
            this.loadPrescripciones();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    // =========================================================================
    // REPORTES (RF-14 & RF-15)
    // =========================================================================
    async loadReportes() {
        try {
            // Inventario
            const repInv = await Api.getReporteInventario();
            document.getElementById('rep-costo-total').textContent = `C$ ${Number(repInv.resumen.valorTotalCosto).toFixed(2)}`;
            document.getElementById('rep-venta-total').textContent = `C$ ${Number(repInv.resumen.valorTotalVenta).toFixed(2)}`;
            document.getElementById('rep-margen-total').textContent = `C$ ${Number(repInv.resumen.margenGananciaEstimado).toFixed(2)}`;

            // Ventas
            const repVentas = await Api.getReporteVentas();
            const tbody = document.getElementById('tbody-reporte-ventas');
            tbody.innerHTML = '';

            repVentas.ventas.forEach(v => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>TICK-${v.id}</strong></td>
                    <td>${new Date(v.fecha).toLocaleString()}</td>
                    <td>${v.cliente}</td>
                    <td>${v.usuario?.nombre || 'Caja 1'}</td>
                    <td><span class="badge badge-info">${v.metodoPago}</span></td>
                    <td><strong>C$ ${Number(v.total).toFixed(2)}</strong></td>
                    <td><span class="badge ${v.estado === 'Completada' ? 'badge-success' : 'badge-danger'}">${v.estado}</span></td>
                    <td style="text-align:center;">
                        <button class="btn btn-secondary btn-sm" onclick="App.reimprimirTicket(${v.id})"><i class="fa-solid fa-print"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
        }
    },

    async reimprimirTicket(id) {
        try {
            const v = await Api.request(`/ventas/${id}`);
            POS.renderTicketModal(v);
        } catch (err) {
            this.showToast('Error cargando venta para ticket', 'error');
        }
    },

    // =========================================================================
    // USUARIOS (RF-02)
    // =========================================================================
    async loadUsuarios() {
        try {
            const list = await Api.getUsuarios();
            const tbody = document.getElementById('tbody-usuarios');
            tbody.innerHTML = '';

            list.forEach(u => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>#${u.id}</td>
                    <td><strong>${u.nombre}</strong></td>
                    <td>${u.email}</td>
                    <td><span class="badge badge-purple">${u.rol}</span></td>
                    <td><span class="badge ${u.estado ? 'badge-success' : 'badge-danger'}">${u.estado ? 'Activo' : 'Inactivo'}</span></td>
                    <td>${u.ultimaConexion ? new Date(u.ultimaConexion).toLocaleString() : 'Sin conexión reciente'}</td>
                    <td style="text-align:center;">
                        <button class="btn btn-secondary btn-sm" onclick="App.toggleUsuario(${u.id})">
                            <i class="fa-solid fa-power-off"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
        }
    },

    async toggleUsuario(id) {
        try {
            await Api.toggleUsuario(id);
            this.showToast('Estado del usuario actualizado', 'success');
            this.loadUsuarios();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async saveUsuario(e) {
        e.preventDefault();
        const data = {
            nombre: document.getElementById('usr-nombre').value,
            email: document.getElementById('usr-email').value,
            password: document.getElementById('usr-password').value,
            rolId: document.getElementById('usr-rol').value
        };

        try {
            await Api.createUsuario(data);
            this.showToast('Usuario creado correctamente', 'success');
            Modals.close('modal-usuario');
            this.loadUsuarios();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    // =========================================================================
    // CONFIGURACIÓN
    // =========================================================================
    async loadConfiguracion() {
        try {
            const c = await Api.getConfiguracion();
            document.getElementById('conf-nombre').value = c.nombreVeterinaria;
            document.getElementById('conf-ruc').value = c.ruc || '';
            document.getElementById('conf-telefono').value = c.telefono || '';
            document.getElementById('conf-email').value = c.email || '';
            document.getElementById('conf-direccion').value = c.direccion || '';
            document.getElementById('conf-moneda').value = c.monedaSimbolo || 'C$';
            document.getElementById('conf-stock-min').value = c.stockMinimoAlerta || 5;
            document.getElementById('conf-dias-vence').value = c.diasAlertaVencimiento || 30;
        } catch (err) {
            console.error(err);
        }
    },

    async saveConfiguracion(e) {
        e.preventDefault();
        const data = {
            nombreVeterinaria: document.getElementById('conf-nombre').value,
            ruc: document.getElementById('conf-ruc').value,
            telefono: document.getElementById('conf-telefono').value,
            email: document.getElementById('conf-email').value,
            direccion: document.getElementById('conf-direccion').value,
            monedaSimbolo: document.getElementById('conf-moneda').value,
            stockMinimoAlerta: document.getElementById('conf-stock-min').value,
            diasAlertaVencimiento: document.getElementById('conf-dias-vence').value
        };

        try {
            await Api.updateConfiguracion(data);
            this.showToast('Configuración guardada exitosamente', 'success');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async loadSelectOptions() {
        try {
            const [cats, provs, prods] = await Promise.all([
                Api.getCategorias(),
                Api.getProveedores(),
                Api.getProductos()
            ]);

            // Categorias selects
            const fillSelect = (id, items) => {
                const el = document.getElementById(id);
                if (!el) return;
                const hasBlank = el.querySelector('option[value=""]');
                el.innerHTML = hasBlank ? '<option value="">Todas las categorías</option>' : '';
                items.forEach(it => {
                    const opt = document.createElement('option');
                    opt.value = it.id;
                    opt.textContent = it.nombre;
                    el.appendChild(opt);
                });
            };

            fillSelect('filtro-producto-categoria', cats);
            fillSelect('prod-categoria', cats);
            fillSelect('prod-proveedor', provs);
            fillSelect('ent-proveedor', provs);
            fillSelect('ent-producto', prods);
            fillSelect('rec-producto', prods);
        } catch (err) {
            console.warn('Error loading options:', err);
        }
    }
};

// =============================================================================
// POS (PUNTO DE VENTA) CONTROLLER (RF-08, RF-12, RF-13)
// =============================================================================
const POS = {
    cart: [],
    recetaValidada: null,
    catalog: [],

    async init() {
        this.cart = [];
        this.recetaValidada = null;
        this.renderCart();
        this.setupAutocomplete();
        try {
            this.catalog = await Api.getProductos();
        } catch (err) {
            console.error(err);
        }
    },

    setupAutocomplete() {
        const input = document.getElementById('pos-search-input');
        const list = document.getElementById('pos-autocomplete');
        if (!input || !list) return;

        input.addEventListener('input', () => {
            const query = input.value.trim().toLowerCase();
            if (!query) {
                list.style.display = 'none';
                return;
            }

            const matches = this.catalog.filter(p => 
                p.nombre.toLowerCase().includes(query) || 
                (p.codigoBarras && p.codigoBarras.toLowerCase().includes(query))
            );

            list.innerHTML = '';
            if (matches.length === 0) {
                list.style.display = 'none';
                return;
            }

            matches.slice(0, 6).forEach(p => {
                const item = document.createElement('div');
                item.className = 'pos-autocomplete-item';
                item.innerHTML = `
                    <div>
                        <strong>${p.nombre}</strong> <span style="font-size: 11px; color: var(--text-muted);">(Stock: ${p.stockTotal})</span>
                        ${p.requierePrescripcion ? '<span class="badge badge-receta-obligatoria" style="font-size:10px; margin-left:6px;">Receta RF-13</span>' : ''}
                    </div>
                    <strong style="color: var(--primary);">C$ ${Number(p.precioVenta).toFixed(2)}</strong>
                `;
                item.onclick = () => {
                    this.addToCart(p);
                    input.value = '';
                    list.style.display = 'none';
                };
                list.appendChild(item);
            });
            list.style.display = 'block';
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.triggerQuickAdd();
            }
        });

        // Hide list on outer click
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !list.contains(e.target)) {
                list.style.display = 'none';
            }
        });
    },

    triggerQuickAdd() {
        const input = document.getElementById('pos-search-input');
        const query = input.value.trim().toLowerCase();
        if (!query) return;

        const match = this.catalog.find(p => 
            p.nombre.toLowerCase().includes(query) || 
            (p.codigoBarras && p.codigoBarras.toLowerCase().includes(query))
        );

        if (match) {
            this.addToCart(match);
            input.value = '';
            document.getElementById('pos-autocomplete').style.display = 'none';
        } else {
            App.showToast('Producto no encontrado en el catálogo', 'warning');
        }
    },

    addToCart(product) {
        if (product.stockTotal <= 0) {
            App.showToast(`No hay stock disponible para ${product.nombre}`, 'error');
            return;
        }

        const existing = this.cart.find(i => i.id === product.id);
        if (existing) {
            if (existing.cantidad + 1 > product.stockTotal) {
                App.showToast(`Stock máximo alcanzado para este producto (${product.stockTotal})`, 'warning');
                return;
            }
            existing.cantidad++;
        } else {
            // Asignar primer lote disponible si existe
            const lote = product.lotes && product.lotes[0] ? product.lotes[0] : null;
            this.cart.push({
                id: product.id,
                codigo: product.codigoBarras || `P-${product.id}`,
                nombre: product.nombre,
                precio: Number(product.precioVenta),
                cantidad: 1,
                idLote: lote ? lote.id : null,
                numeroLote: lote ? lote.numeroLote : 'L-AUTO',
                requierePrescripcion: product.requierePrescripcion,
                stockTotal: product.stockTotal
            });
        }

        this.renderCart();
    },

    updateQuantity(id, delta) {
        const item = this.cart.find(i => i.id === id);
        if (!item) return;

        const newQty = item.cantidad + delta;
        if (newQty <= 0) {
            this.removeFromCart(id);
            return;
        }
        if (newQty > item.stockTotal) {
            App.showToast(`Solo quedan ${item.stockTotal} unidades en almacén`, 'warning');
            return;
        }

        item.cantidad = newQty;
        this.renderCart();
    },

    removeFromCart(id) {
        this.cart = this.cart.filter(i => i.id !== id);
        this.renderCart();
    },

    clearCart() {
        this.cart = [];
        this.recetaValidada = null;
        this.renderCart();
        App.showToast('Carrito vaciado', 'info');
    },

    renderCart() {
        const tbody = document.getElementById('pos-cart-tbody');
        tbody.innerHTML = '';

        let subtotal = 0;
        let tieneMedicamentoRestringido = false;

        if (this.cart.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 28px; color: var(--text-muted);"><i class="fa-solid fa-cart-shopping" style="font-size: 24px; margin-bottom: 8px; display:block;"></i>El carrito de ventas está vacío. Escanee un producto o use el buscador.</td></tr>';
        } else {
            this.cart.forEach(item => {
                const itemSubtotal = item.precio * item.cantidad;
                subtotal += itemSubtotal;

                if (item.requierePrescripcion) {
                    tieneMedicamentoRestringido = true;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${item.codigo}</strong></td>
                    <td><strong>${item.nombre}</strong></td>
                    <td><span class="badge badge-info">${item.numeroLote}</span></td>
                    <td>
                        ${item.requierePrescripcion 
                            ? '<span class="badge badge-receta-obligatoria"><i class="fa-solid fa-triangle-exclamation"></i> Requiere Receta</span>' 
                            : '<span class="badge badge-receta-libre">Libre</span>'}
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <button class="btn btn-secondary btn-sm" style="padding: 2px 7px;" onclick="POS.updateQuantity(${item.id}, -1)">-</button>
                            <span style="font-weight: 700; min-width: 20px; text-align: center;">${item.cantidad}</span>
                            <button class="btn btn-secondary btn-sm" style="padding: 2px 7px;" onclick="POS.updateQuantity(${item.id}, 1)">+</button>
                        </div>
                    </td>
                    <td>C$ ${item.precio.toFixed(2)}</td>
                    <td style="font-weight: 800; color: var(--primary);">C$ ${itemSubtotal.toFixed(2)}</td>
                    <td style="text-align: center;">
                        <button class="btn btn-danger btn-sm" onclick="POS.removeFromCart(${item.id})">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Control del banner de validación de receta médica (RF-13)
        const prescBanner = document.getElementById('pos-prescription-banner');
        const badgePrescNav = document.getElementById('badge-pos-prescription');

        if (tieneMedicamentoRestringido) {
            prescBanner.classList.add('active');
            if (badgePrescNav) badgePrescNav.style.display = 'inline-block';
        } else {
            prescBanner.classList.remove('active');
            if (badgePrescNav) badgePrescNav.style.display = 'none';
        }

        // Totales
        document.getElementById('pos-summary-subtotal').textContent = `C$ ${subtotal.toFixed(2)}`;
        document.getElementById('pos-summary-total').textContent = `C$ ${subtotal.toFixed(2)}`;
        document.getElementById('pos-summary-items-count').textContent = `${this.cart.reduce((s, i) => s + i.cantidad, 0)} unidades`;

        this.calculateChange();
    },

    calculateChange() {
        const subtotal = this.cart.reduce((s, i) => s + (i.precio * i.cantidad), 0);
        const pagaCon = parseFloat(document.getElementById('pos-paga-con').value) || 0;
        const cambioEl = document.getElementById('pos-summary-cambio');

        if (pagaCon >= subtotal && subtotal > 0) {
            cambioEl.textContent = `C$ ${(pagaCon - subtotal).toFixed(2)}`;
            cambioEl.style.color = 'var(--success)';
        } else {
            cambioEl.textContent = 'C$ 0.00';
            cambioEl.style.color = 'var(--text-muted)';
        }
    },

    async validarReceta() {
        const input = document.getElementById('pos-input-receta');
        const statusTag = document.getElementById('pos-receta-status');
        const detailsBox = document.getElementById('pos-receta-details');
        const codigo = input.value.trim();

        if (!codigo) {
            App.showToast('Ingrese un código de receta para validar (ej: REC-892)', 'warning');
            return;
        }

        try {
            const res = await Api.validarPrescripcion(codigo);
            if (res.valido) {
                this.recetaValidada = res.prescripcion;
                statusTag.style.display = 'inline-block';
                statusTag.className = 'presc-status-tag badge-success';
                statusTag.innerHTML = '<i class="fa-solid fa-check"></i> AUTORIZADA';

                detailsBox.style.display = 'block';
                detailsBox.innerHTML = `
                    <strong>Veterinario Emisor:</strong> ${res.prescripcion.veterinario} <br>
                    <strong>Tutor / Mascota:</strong> ${res.prescripcion.cliente} <br>
                    <strong>Indicaciones:</strong> ${res.prescripcion.observaciones || 'Tratamiento antibiótico supervisado'}
                `;

                App.showToast('Prescripción Médica Verificada y Autorizada', 'success');
            }
        } catch (err) {
            this.recetaValidada = null;
            statusTag.style.display = 'inline-block';
            statusTag.className = 'presc-status-tag badge-danger';
            statusTag.innerHTML = '<i class="fa-solid fa-xmark"></i> RECHAZADA';

            detailsBox.style.display = 'block';
            detailsBox.innerHTML = `<span style="color:var(--danger); font-weight:700;">${err.message}</span>`;
            App.showToast(err.message, 'error');
        }
    },

    async procesarVenta() {
        if (this.cart.length === 0) {
            App.showToast('Agregue productos al carrito antes de registrar la venta', 'warning');
            return;
        }

        const tieneRestringido = this.cart.some(i => i.requierePrescripcion);
        if (tieneRestringido && !this.recetaValidada) {
            App.showToast('¡ALERTA RF-13! Este pedido contiene medicamentos restringidos. Debe ingresar y validar una receta médica activa antes de cobrar.', 'error');
            document.getElementById('pos-input-receta').focus();
            return;
        }

        const cliente = document.getElementById('pos-cliente').value || 'Cliente General';
        const metodoPago = document.getElementById('pos-metodo-pago').value || 'Efectivo';

        const payload = {
            cliente,
            idUsuario: App.currentUser ? App.currentUser.id : null,
            prescripcionId: this.recetaValidada ? this.recetaValidada.id : null,
            codigoPrescripcion: this.recetaValidada ? this.recetaValidada.numero : null,
            metodoPago,
            descuento: 0,
            detalles: this.cart.map(i => ({
                idProducto: i.id,
                idLote: i.idLote,
                cantidad: i.cantidad,
                precioUnitario: i.precio
            }))
        };

        try {
            const res = await Api.registrarVenta(payload);
            App.showToast('Venta procesada y stock descontado con éxito', 'success');
            
            // Render receipt ticket modal
            this.renderTicketModal(res.venta);

            // Reset cart
            this.cart = [];
            this.recetaValidada = null;
            this.renderCart();

            // Refresh catalog and dashboard metrics
            this.catalog = await Api.getProductos();
            App.loadDashboardData();
        } catch (err) {
            App.showToast(`Error al procesar venta: ${err.message}`, 'error');
        }
    },

    renderTicketModal(venta) {
        const area = document.getElementById('ticket-print-area');
        if (!area) return;

        const dateStr = new Date(venta.fecha || Date.now()).toLocaleString('es-NI');
        let itemsHtml = '';

        if (venta.detalles) {
            venta.detalles.forEach(d => {
                itemsHtml += `
                    <tr>
                        <td>${d.producto?.nombre || 'Producto'}</td>
                        <td style="text-align: center;">${d.cantidad}</td>
                        <td style="text-align: right;">C$ ${Number(d.precioUnitario).toFixed(2)}</td>
                        <td style="text-align: right;">C$ ${Number(d.subtotal).toFixed(2)}</td>
                    </tr>
                `;
            });
        }

        area.innerHTML = `
            <div class="ticket-header">
                <h4>VETSALUD VETERINARIA</h4>
                <div>RUC: J0310000248811</div>
                <div>Tel: +505 2244-8899</div>
                <div>Managua, Nicaragua</div>
                <div style="margin-top: 6px;"><strong>TICKET DE VENTA #00${venta.id}</strong></div>
                <div>Fecha: ${dateStr}</div>
                <div>Cliente: ${venta.cliente}</div>
                <div>Cajero: ${venta.usuario?.nombre || 'Cajero #1'}</div>
                ${venta.prescripcion ? `<div style="margin-top:4px; font-weight:bold; color:#000;">RECETA VET: ${venta.prescripcion.numero}</div>` : ''}
            </div>

            <table class="ticket-table">
                <thead>
                    <tr>
                        <th>Descripción</th>
                        <th style="text-align:center;">Cant</th>
                        <th style="text-align:right;">P.Unit</th>
                        <th style="text-align:right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div class="ticket-totals">
                <div class="ticket-totals-row">
                    <span>Subtotal:</span>
                    <span>C$ ${Number(venta.total).toFixed(2)}</span>
                </div>
                <div class="ticket-totals-row">
                    <span>Descuento:</span>
                    <span>C$ ${Number(venta.descuento || 0).toFixed(2)}</span>
                </div>
                <div class="ticket-totals-row" style="font-weight: 900; font-size: 14px; margin-top: 4px;">
                    <span>TOTAL A PAGAR:</span>
                    <span>C$ ${Number(venta.total).toFixed(2)}</span>
                </div>
                <div class="ticket-totals-row" style="margin-top: 4px;">
                    <span>Método de Pago:</span>
                    <span>${venta.metodoPago}</span>
                </div>
            </div>

            <div class="ticket-footer">
                <div>¡Gracias por confiar en VetSalud!</div>
                <div>Conserve este comprobante para reclamos.</div>
                <div style="margin-top: 8px; font-size: 18px; letter-spacing: 4px;">||| | |||| || |||</div>
            </div>
        `;

        Modals.open('modal-ticket');
    }
};

// =============================================================================
// MODAL CONTROLLER HELPER
// =============================================================================
const Modals = {
    open(modalId) {
        const m = document.getElementById(modalId);
        if (m) m.classList.add('active');
    },

    close(modalId) {
        const m = document.getElementById(modalId);
        if (m) m.classList.remove('active');
    },

    openProductoModal() {
        document.getElementById('modal-producto-title').textContent = 'Nuevo Producto';
        document.getElementById('form-producto').reset();
        document.getElementById('prod-id').value = '';
        this.open('modal-producto');
    },

    openCategoriaModal() {
        this.open('modal-categoria');
    },

    openProveedorModal() {
        this.open('modal-proveedor');
    },

    openEntradaModal() {
        document.getElementById('ent-fecha').value = new Date().toISOString().split('T')[0];
        const vence = new Date();
        vence.setDate(vence.getDate() + 180);
        document.getElementById('ent-vencimiento').value = vence.toISOString().split('T')[0];
        this.open('modal-entrada');
    },

    openPrescripcionModal() {
        document.getElementById('rec-codigo').value = `REC-${Math.floor(100 + Math.random() * 900)}`;
        this.open('modal-prescripcion');
    },

    openUsuarioModal() {
        this.open('modal-usuario');
    }
};

// Global Exposure
window.App = App;
window.POS = POS;
window.Modals = Modals;

// Run App on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
