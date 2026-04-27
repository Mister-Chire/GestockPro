const SUPABASE_URL = 'https://ludlgcdqorkguaershes.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ulnaac-sM7thLuFFmxv8HA_P-WkA7_t';

let authToken = null;
let empresaId = null;
let empresaNombre = 'TALLER';
let modulos = { itv: true, agenda: true, caja: false };
let pedidos = [], filtroActivo = 'todos', filtroCrono = 'todos', busqueda = '', anioActivo = new Date().getFullYear();
let editandoId = null, eliminandoId = null, piezasRows = [];
let vistaActual = 'dashboard';

// ===== AUTH =====
async function iniciarSesion() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('btnLogin');
  const err = document.getElementById('loginError');

  if (!email || !password) { err.textContent = 'Introduce email y contraseña'; err.classList.add('visible'); return; }

  btn.disabled = true; btn.textContent = 'Entrando...';
  err.classList.remove('visible');

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) throw new Error(data.error_description || 'Error');

    authToken = data.access_token;
    sessionStorage.setItem('auth_token', authToken);
    sessionStorage.setItem('auth_refresh', data.refresh_token);
    sessionStorage.setItem('auth_email', email);
    document.getElementById('userEmail').textContent = email.split('@')[0];
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    // Load empresa first, then pedidos regardless
    try { await cargarEmpresa(); } catch(e) { console.log('empresa error:', e); }
    setTab('dashboard');
    cargarPedidos();
    cargarClientesDB();
    iniciarRefreshClientes();
    iniciarRenovacionToken();
  } catch (e) {
    err.textContent = 'Email o contraseña incorrectos';
    err.classList.add('visible');
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

function cerrarSesion() {
  authToken = null;
  pedidos = [];
  sessionStorage.removeItem('auth_token');
  sessionStorage.removeItem('auth_refresh');
  sessionStorage.removeItem('auth_email');
  clearTimeout(window._reloadTimer);
  clearInterval(window._tokenInterval);
  document.getElementById('appScreen').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').classList.remove('visible');
}

// Enter en login
document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') iniciarSesion(); });
document.getElementById('loginEmail').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginPassword').focus(); });

// ===== RECUPERAR CONTRASEÑA =====
function mostrarRecuperar() {
  document.getElementById('boxLogin').style.display = 'none';
  document.getElementById('boxRecuperar').style.display = 'block';
  document.getElementById('recuperarError').classList.remove('visible');
  document.getElementById('recuperarOk').style.display = 'none';
  document.getElementById('recuperarEmail').value = '';
}

function mostrarLogin() {
  document.getElementById('boxRecuperar').style.display = 'none';
  document.getElementById('boxNuevaPass').style.display = 'none';
  document.getElementById('boxLogin').style.display = 'block';
}

async function enviarRecuperacion() {
  const email = document.getElementById('recuperarEmail').value.trim();
  const err = document.getElementById('recuperarError');
  const ok = document.getElementById('recuperarOk');
  const btn = document.getElementById('btnRecuperar');

  err.classList.remove('visible'); ok.style.display = 'none';
  if (!email) { err.textContent = 'Introduce tu email'; err.classList.add('visible'); return; }

  btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!res.ok) throw new Error();
    ok.style.display = 'block';
    btn.textContent = 'Enviado';
  } catch {
    err.textContent = 'No se pudo enviar el email. Comprueba la dirección.';
    err.classList.add('visible');
    btn.disabled = false; btn.textContent = 'Enviar enlace';
  }
}

async function guardarNuevaPass() {
  const pass = document.getElementById('nuevaPass').value;
  const pass2 = document.getElementById('nuevaPass2').value;
  const err = document.getElementById('nuevaPassError');
  const btn = document.getElementById('btnNuevaPass');

  err.classList.remove('visible');
  if (pass.length < 6) { err.textContent = 'La contraseña debe tener al menos 6 caracteres'; err.classList.add('visible'); return; }
  if (pass !== pass2) { err.textContent = 'Las contraseñas no coinciden'; err.classList.add('visible'); return; }

  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    });
    if (!res.ok) throw new Error();
    showToast('\u2713 Contraseña actualizada. Inicia sesión.', 'success');
    authToken = null;
    setTimeout(() => {
      document.getElementById('boxNuevaPass').style.display = 'none';
      document.getElementById('boxLogin').style.display = 'block';
    }, 1500);
  } catch {
    err.textContent = 'Error al guardar. Inténtalo de nuevo.';
    err.classList.add('visible');
    btn.disabled = false; btn.textContent = 'Guardar nueva contraseña';
  }
}

// Detectar si venimos del enlace de recuperación (token en la URL)
window.addEventListener('load', () => {
  const hash = window.location.hash;
  if (hash.includes('type=recovery') || hash.includes('access_token')) {
    const params = new URLSearchParams(hash.replace('#', ''));
    const token = params.get('access_token');
    if (token) {
      authToken = token;
      document.getElementById('boxLogin').style.display = 'none';
      document.getElementById('boxNuevaPass').style.display = 'block';
      // Limpiar el hash de la URL sin recargar
      history.replaceState(null, '', window.location.pathname);
    }
  }
});

// ===== API =====
async function renovarToken() {
  const savedRefresh = sessionStorage.getItem('auth_refresh');
  if (!savedRefresh) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: savedRefresh })
    });
    const data = await res.json();
    if (res.ok && data.access_token) {
      authToken = data.access_token;
      sessionStorage.setItem('auth_token', authToken);
      sessionStorage.setItem('auth_refresh', data.refresh_token);
      setSyncing('ok');
      return true;
    }
  } catch(e) {}
  return false;
}

const api = async (path, opts = {}) => {
  const makeReq = (token) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(opts.headers || {})
    }
  });
  const res = await makeReq(authToken);
  if (res.status === 401 && authToken) {
    const refreshed = await renovarToken();
    if (refreshed) return makeReq(authToken);
  }
  return res;
};

async function cargarEmpresa() {
  try {
    const res = await api('usuarios_empresas?select=empresa_id,empresas(id,nombre,logo_url,es_prueba,fecha_expiracion,modulos)&limit=1');
    if (res.ok) {
      const data = await res.json();
      if (data.length && data[0].empresas) {
        const e = data[0].empresas;
        // Check expiration
        if (e.es_prueba && e.fecha_expiracion) {
          const expDate = new Date(e.fecha_expiracion);
          if (expDate < new Date()) {
            cerrarSesion();
            document.getElementById('loginScreen').style.display = 'flex';
            const err = document.getElementById('loginError');
            err.textContent = 'Tu período de prueba ha finalizado. Contacta con el administrador.';
            err.classList.add('visible');
            return;
          }
        }
        empresaId = e.id;
        empresaNombre = e.nombre;
        modulos = e.modulos || { itv: true, agenda: true, caja: false };
        document.title = empresaNombre + ' — Pedidos';
        renderTabs();
      }
    }
  } catch(e) {}
}

function renderYearFilters() {
  const years = [...new Set(pedidos.map(p => new Date(p.created_at).getFullYear()))].sort((a,b) => b-a);
  const container = document.getElementById('yearFilters');
  if (!container) return;
  // Always include current year even if no pedidos
  const currentYear = new Date().getFullYear();
  if (!years.includes(currentYear)) years.unshift(currentYear);
  container.innerHTML = years.map(y => `
    <button class="filter-chip ${y === anioActivo ? 'active' : ''}" onclick="setAnio(${y})">${y}</button>
  `).join('');
}

function setAnio(year) {
  anioActivo = year;
  renderYearFilters();
  render();
}

async function cargarPedidos() {
  if (!authToken) return;
  try {
    const res = await api('pedidos?order=created_at.desc');
    if (!res.ok) throw new Error();
    pedidos = await res.json();
    setSyncing('ok'); renderYearFilters(); render();
    cargarDevoluciones();
    if (vistaActual === 'dashboard') renderDashboard();
    // Auto-refresh every 60 seconds
    clearTimeout(window._reloadTimer);
    window._reloadTimer = setTimeout(cargarPedidos, 60000);
  } catch {
    setSyncing('error');
    document.getElementById('clientsGrid').innerHTML = `
      <div class="empty-state"><div class="empty-state-icon">⚠</div>
      <p>No se pudo cargar los pedidos.<br>Comprueba tu conexión.</p>
      <button onclick="cargarPedidos()" style="margin-top:12px;background:var(--accent);color:#0f0f0f;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500">Reintentar</button></div>`;
  }
}

async function crearPedido(data) {
  setSyncing('syncing');
  const res = await api('pedidos', { method: 'POST', body: JSON.stringify(data) });
  if (!res.ok) throw new Error();
  setSyncing('ok');
  return (await res.json())[0];
}

async function actualizarPedido(id, data) {
  setSyncing('syncing');
  const res = await api(`pedidos?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  if (!res.ok) throw new Error();
  setSyncing('ok');
}

async function eliminarPedido(id) {
  setSyncing('syncing');
  const res = await api(`pedidos?id=eq.${id}`, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
  if (!res.ok) throw new Error();
  setSyncing('ok');
}

// ===== TEMA =====
function initTema() {
  const saved = localStorage.getItem('taller_tema') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('btnTema').textContent = saved === 'dark' ? '☀️' : '🌙';
  actualizarLogo(saved);
  // Set login logo based on theme
  const loginLogo = document.getElementById('loginLogo');
  if (loginLogo) {
    loginLogo.src = saved === 'dark'
      ? '/gestockpro-fondo-oscuro.png'
      : '/gestockpro-fondo-claro.png';
  }
}
function toggleTema() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  document.getElementById('btnTema').textContent = next === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('taller_tema', next);
  actualizarLogo(next);
}

function actualizarLogo(tema) {
  const logo = document.getElementById('logoImg');
  if (logo) {
    logo.src = tema === 'dark'
      ? '/gestockpro-fondo-oscuro.png'
      : '/gestockpro-fondo-claro.png';
  }
  // Login screen always shows light logo (white background)
  const loginLogo = document.getElementById('loginLogo');
  if (loginLogo) {
    loginLogo.src = '/gestockpro-fondo-claro.png';
  }
}

// ===== TABS =====
function renderTabs() {
  const tabsContainer = document.getElementById('tabsContainer');
  if (!tabsContainer) return;
  const S = (p, c) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${p}</svg>`;
  const ic = {
    dashboard:    S('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',                                                                                                                                                              '#6366f1'),
    clientes:     S('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',                                                                                                                                                                  '#3b82f6'),
    crono:        S('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="#10b981" stroke="none"/><circle cx="3" cy="12" r="1" fill="#10b981" stroke="none"/><circle cx="3" cy="18" r="1" fill="#10b981" stroke="none"/>',                              '#10b981'),
    devoluciones: S('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.87"/>',                                                                                                                                                                                                                                                           '#f59e0b'),
    garantias:    S('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',                                                                                                                                                                                                                                                                            '#8b5cf6'),
    agenda:       S('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',                                                                                                                                                          '#06b6d4'),
    itv:          S('<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',                                                                                                                                                           '#ef4444'),
    manual:       S('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',                                                                                                                                                                                                                      '#f97316'),
    vacaciones:   S('<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',   '#eab308'),
    caja:         S('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',                                                                                                                                                                                                                              '#14b8a6'),
  };
  const tabs = [
    { id: 'dashboard',    label: `${ic.dashboard} Inicio`,           always: true },
    { id: 'clientes',     label: `${ic.clientes} Por Clientes`,      always: true },
    { id: 'crono',        label: `${ic.crono} Listado de Piezas`,    always: true },
    { id: 'devoluciones', label: `${ic.devoluciones} Devoluciones`,  always: true },
    { id: 'garantias',    label: `${ic.garantias} Garantías`,        always: true },
    { id: 'agenda',       label: `${ic.agenda} Agenda`,              mod: 'agenda' },
    { id: 'itv',          label: `${ic.itv} ITV`,                    mod: 'itv' },
    { id: 'manual',       label: `${ic.manual} Manual ITV`,          always: true },
    { id: 'vacaciones',   label: `${ic.vacaciones} Vacaciones`,      always: true },
    { id: 'caja',         label: `${ic.caja} Caja`,                  mod: 'caja' },
  ];
  tabsContainer.innerHTML = tabs
    .filter(t => t.always || modulos[t.mod])
    .map(t => `<button class="tab-btn ${vistaActual === t.id ? 'active' : ''}" id="tab${t.id.charAt(0).toUpperCase()+t.id.slice(1)}" onclick="setTab('${t.id}')">${t.label}</button>`)
    .join('');
}

function setTab(tab) {
  vistaActual = tab;
  const activeId = 'tab' + tab.charAt(0).toUpperCase() + tab.slice(1);
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === activeId);
  });
  document.getElementById('viewDashboard').style.display = tab === 'dashboard' ? 'block' : 'none';
  document.getElementById('viewClientes').style.display = tab === 'clientes' ? 'block' : 'none';
  document.getElementById('viewCrono').style.display = tab === 'crono' ? 'block' : 'none';
  document.getElementById('viewGarantias').style.display = tab === 'garantias' ? 'block' : 'none';
  document.getElementById('viewItv').style.display = tab === 'itv' ? 'block' : 'none';
  document.getElementById('viewAgenda').style.display = tab === 'agenda' ? 'block' : 'none';
  const viewVac = document.getElementById('viewVacaciones');
  if (viewVac) viewVac.style.display = tab === 'vacaciones' ? 'block' : 'none';
  const viewDev = document.getElementById('viewDevoluciones');
  if (viewDev) viewDev.style.display = tab === 'devoluciones' ? 'block' : 'none';
  const cajView = document.getElementById('viewCaja');
  if (cajView) cajView.style.display = tab === 'caja' ? 'block' : 'none';
  const manualView = document.getElementById('viewManual');
  if (manualView) manualView.style.display = tab === 'manual' ? 'block' : 'none';
  document.getElementById('filtersWrap').style.display = tab === 'clientes' ? '' : 'none';
  if (tab === 'crono') renderCrono();
  if (tab === 'garantias') cargarGarantias();
  if (tab === 'itv') cargarItv();
  if (tab === 'agenda') renderAgenda();
  if (tab === 'vacaciones') cargarVacaciones();
  if (tab === 'devoluciones') cargarDevoluciones();
  if (tab === 'caja') cargarCaja();
  if (tab === 'dashboard') renderDashboard();
}

// ===== SYNC =====
function setSyncing(state) {
  const dot = document.getElementById('syncDot');
  const lbl = document.getElementById('syncLabel');
  dot.className = 'sync-dot' + (state === 'syncing' ? ' syncing' : state === 'error' ? ' error' : '');
  lbl.textContent = state === 'syncing' ? 'Guardando...' : state === 'error' ? 'Sin conexión' : 'Conectado';
}

// ===== HELPERS =====
function estadoCliente(c) {
  const p = c.piezas || [];
  if (!p.length) return 'pendiente';
  if (p.every(x => x.llegada)) return 'listo';
  if (p.some(x => x.llegada)) return 'parcial';
  return 'pendiente';
}
function labelEstado(e) {
  if (e === 'listo') return '✓ Completado';
  if (e === 'parcial') return '⚡ Piezas parciales';
  return '⏳ Pendiente';
}
function progreso(c) {
  const p = c.piezas || [];
  return !p.length ? 0 : Math.round(p.filter(x => x.llegada).length / p.length * 100);
}
function formatFechaHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}
function formatFechaDia(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function formatHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}
function getDiaClave(iso) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

// ===== RENDER CLIENTES =====
function render() {
  const expanded = getExpandedCards();
  updateStats();
  const grid = document.getElementById('clientsGrid');
  let lista = pedidos.filter(c => {
    // Year filter
    const pedidoYear = new Date(c.created_at).getFullYear();
    if (pedidoYear !== anioActivo) return false;
    if (filtroActivo === 'listo' && estadoCliente(c) !== 'listo') return false;
    if (filtroActivo === 'pendiente' && estadoCliente(c) === 'listo') return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      const hay = [c.cliente, c.matricula, c.vehiculo, c.empresa, c.obs, ...(c.piezas||[]).map(p=>p.desc+p.ref)].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (!lista.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📦</div><p>No hay pedidos que coincidan</p></div>`;
    return;
  }

  grid.innerHTML = lista.map(c => {
    const est = estadoCliente(c), pct = progreso(c), piezas = c.piezas || [];
    const piezasHTML = piezas.map((p, i) => `
      <div class="pieza-row">
        <span class="pieza-estado ${p.llegada ? 'llegada' : 'pendiente'}" style="margin-top:3px"></span>
        <div class="pieza-info">
          <div class="pieza-desc-text">${p.desc || ''}</div>
          <div class="pieza-ref-text">${p.ref || '—'}${p.atiende ? ` · ${p.atiende}` : ''}${p.empresa ? ` · <span style="color:var(--accent)">${p.empresa}</span>` : ''}${p.entrega ? ` · ${p.entrega}` : ''}${p.precio ? ` · <span style="color:var(--text);font-weight:600">${parseFloat(p.precio).toFixed(2)}€${p.dto ? ` <span style="color:var(--muted)">(-${p.dto}%)</span>` : ''}</span>` : ''}${p.obs ? ` · <span style="color:var(--muted);font-style:italic">${p.obs}</span>` : ''}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">
            <div class="pieza-timestamp">${p.created_at ? formatFechaHora(p.created_at) : '—'}</div>
            ${p.devolucion ? `<span style="font-size:10px;color:var(--red);padding:2px 6px;border:1px solid var(--red);border-radius:4px">Dev.</span>` : `<button class="pieza-toggle" style="background:var(--red-bg);color:var(--red);border-color:var(--red);font-size:10px;padding:3px 8px;font-weight:600;letter-spacing:0.03em" data-dev="${i}">DEVOLVER</button>`}
            <button class="pieza-toggle ${p.llegada ? 'llegada' : 'pendiente'}" data-pid="${i}">${p.llegada ? '✓ Llegada' : '⏳ Pendiente'}</button>
          </div>
        </div>
      </div>`).join('');
    const obsHTML = '';
    return `
      <div class="client-card" id="card-${c.id}">
        <div class="card-header">
          <span class="status-dot ${est}"></span>
          <div class="card-client-info">
            <div class="client-name">${c.cliente}</div>
            <div class="client-meta">
              <span class="matricula matricula-link" onclick="event.stopPropagation();abrirFichaCliente('${c.matricula}')" title="Ver ficha del cliente">${c.matricula || '—'}</span>
              <span class="vehiculo-tag">${c.vehiculo || ''}</span>
              ${c.created_at ? `<span class="fecha-tag">${formatFechaHora(c.created_at)}</span>` : ''}
              ${clientesDB.find(x=>x.matricula===c.matricula)?.telefono ? `<span class="fecha-tag" style="color:var(--muted)">📞 ${clientesDB.find(x=>x.matricula===c.matricula).telefono}</span>` : ''}
            </div>
          </div>
          <div class="card-badge">
            <span class="badge ${est}">${labelEstado(est)}</span>
            <div style="font-size:10px;color:var(--muted);margin-top:4px;text-align:right">${piezas.filter(p=>p.llegada).length}/${piezas.length} piezas</div>
          </div>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill ${est === 'listo' ? 'listo' : est === 'pendiente' ? 'pendiente' : 'parcial'}" style="width:${pct}%"></div>
        </div>
        <div class="piezas-list" style="display:none">
          ${piezasHTML}${obsHTML}
        </div>
        <div class="card-footer-actions" style="display:none">
          <button class="action-btn" onclick="event.stopPropagation();abrirModalEditar('${c.id}')">✏ Editar</button>
          <button class="action-btn" onclick="event.stopPropagation();marcarTodo('${c.id}')">✓ Todo llegó</button>
          <button class="action-btn danger" onclick="event.stopPropagation();pedirConfirmEliminar('${c.id}')">✕ Eliminar</button>
        </div>
      </div>`;
  }).join('');

  lista.forEach(c => {
    const card = document.getElementById('card-' + c.id);
    if (!card) return;
    const fn = () => abrirTarjeta(c.id);
    card.querySelector('.card-header').addEventListener('click', fn);
    card.querySelector('.progress-bar-wrap').addEventListener('click', fn);
    card.querySelectorAll('.pieza-toggle').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (btn.dataset.dev !== undefined) return; // los botones ↩ tienen data-dev, no data-pid
        togglePieza(c.id, parseInt(btn.dataset.pid));
      });
    });
    card.querySelectorAll('[data-dev]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); marcarDevolucion(c.id, parseInt(btn.dataset.dev)); });
    });
  });

  restoreExpandedCards(expanded);
  if (vistaActual === 'crono') renderCrono();
}

// ===== RENDER CRONOLÓGICO =====
function renderCrono() {
  const wrap = document.getElementById('viewCrono');
  wrap.style.display = 'block';
  const q = busqueda.toLowerCase();

  const totalPiezas = pedidos.filter(c => new Date(c.created_at).getFullYear() === anioActivo).reduce((s,c) => s+(c.piezas||[]).length, 0);
  const compPiezas = pedidos.filter(c => new Date(c.created_at).getFullYear() === anioActivo).reduce((s,c) => s+(c.piezas||[]).filter(p=>p.llegada).length, 0);
  const pendPiezas = totalPiezas - compPiezas;

  const filterBarHTML = `<div id="cronoFilterBar" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
    <button class="filter-chip ${filtroCrono==='todos'?'active':''}" onclick="setCronoFilter('todos')">Todas <span style="font-family:'DM Mono',monospace;font-size:11px">${totalPiezas}</span></button>
    <button class="filter-chip ${filtroCrono==='completada'?'active':''}" onclick="setCronoFilter('completada')">✓ Llegadas <span style="font-family:'DM Mono',monospace;font-size:11px">${compPiezas}</span></button>
    <button class="filter-chip ${filtroCrono==='pendiente'?'active':''}" onclick="setCronoFilter('pendiente')">⏳ Pendientes <span style="font-family:'DM Mono',monospace;font-size:11px">${pendPiezas}</span></button>
  </div>`;

  let filas = [];
  pedidos.forEach(c => {
    // Year filter
    if (new Date(c.created_at).getFullYear() !== anioActivo) return;
    (c.piezas || []).forEach((p, idx) => {
      if (filtroCrono === 'completada' && !p.llegada) return;
      if (filtroCrono === 'pendiente' && p.llegada) return;
      if (q) {
        const hayParts = [
          c.cliente||'', c.matricula||'', c.vehiculo||'',
          p.ref||'', p.desc||'', p.atiende||'',
          p.empresa||'', p.entrega||'', p.obs||''
        ];
        const hay = hayParts.join(' ').toLowerCase();
        const hayNoSpaces = hayParts.join('').toLowerCase();
        if (!hay.includes(q) && !hayNoSpaces.includes(q.replace(/\s/g,''))) return;
      }
      const ts = p.created_at || c.created_at || new Date().toISOString();
      filas.push({ c, p, idx, ts });
    });
  });
  filas.sort((a, b) => new Date(b.ts) - new Date(a.ts));

  if (!filas.length) {
    wrap.innerHTML = filterBarHTML + `<div class="empty-state"><div class="empty-state-icon">📋</div><p>No hay piezas registradas</p></div>`;
    return;
  }

  let lastDay = null;
  let rows = '';
  filas.forEach(({ c, p, idx, ts }) => {
    const dia = getDiaClave(ts);
    if (dia !== lastDay) {
      lastDay = dia;
      rows += `<div class="crono-day-header">${formatFechaDia(ts)}</div>`;
    }
    rows += `<div class="crono-row${p.llegada ? ' crono-row-llegada' : ''}">
      <span class="crono-time">${formatHora(ts)}</span>
      <span class="crono-estado ${p.llegada ? 'llegada' : 'pendiente'}"></span>
      <span class="crono-ref">${p.ref || '—'}</span>
      <span class="crono-desc">${p.desc || ''}</span>
      <span class="crono-cell">${p.atiende || '—'}</span>
      <span class="crono-empresa-pill">${p.empresa || '—'}</span>
      <span class="crono-cliente">${c.cliente}</span>
      <span class="crono-matricula-text">${c.matricula || '—'}</span>
      <span class="crono-cell">${c.vehiculo || '—'}</span>
      <span class="crono-cell">${p.entrega || '—'}</span>
      <span class="crono-cell crono-obs">${p.obs || ''}</span>
      <button class="crono-toggle ${p.llegada ? 'llegada' : 'pendiente'}" data-cid="${c.id}" data-pid="${idx}">${p.llegada ? '✓ Llegada' : '⏳ Pdte.'}</button>
      <button class="crono-toggle" style="background:var(--red-bg);color:var(--red);border-color:var(--red);padding:4px 7px;font-size:10px;font-weight:600;letter-spacing:0.03em" data-cid="${c.id}" data-dev="${idx}">DEVOLVER</button>
    </div>`;
  });

  wrap.innerHTML = filterBarHTML + `
    <div class="crono-table-wrap">
      <div class="crono-thead">
        <span>Hora</span>
        <span></span>
        <span>Referencia</span>
        <span>Descripción</span>
        <span>Atiende</span>
        <span>Empresa</span>
        <span>Cliente</span>
        <span>Matrícula</span>
        <span>Vehículo</span>
        <span>Entrega</span>
        <span>Observaciones</span>
        <span>Estado</span>
        <span></span>
      </div>
      <div class="crono-list">${rows}</div>
    </div>`;

  wrap.querySelectorAll('[data-dev]').forEach(btn => {
    btn.addEventListener('click', () => {
      marcarDevolucion(btn.dataset.cid, parseInt(btn.dataset.dev));
    });
  });

  wrap.querySelectorAll('.crono-toggle').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.dev !== undefined) return; // los botones ↩ tienen data-dev, no data-pid
      const cid = btn.dataset.cid;
      const idx = parseInt(btn.dataset.pid);
      const c = pedidos.find(x => x.id === cid);
      if (!c || !c.piezas[idx]) return;
      c.piezas[idx].llegada = !c.piezas[idx].llegada;
      const llegada = c.piezas[idx].llegada;

      const row = btn.closest('.crono-row');
      if (row) {
        const dot = row.querySelector('.crono-estado');
        if (dot) dot.className = 'crono-estado ' + (llegada ? 'llegada' : 'pendiente');
        btn.textContent = llegada ? '✓ Llegada' : '⏳ Pdte.';
        btn.className = 'crono-toggle ' + (llegada ? 'llegada' : 'pendiente');
        if (llegada) row.classList.add('crono-row-llegada');
        else row.classList.remove('crono-row-llegada');
      }

      const card = document.getElementById('card-' + cid);
      if (card) {
        const toggleBtn = card.querySelector(`.pieza-toggle[data-pid="${idx}"]`);
        const dots = card.querySelectorAll('.pieza-estado');
        if (toggleBtn) {
          toggleBtn.textContent = llegada ? '✓ Llegada' : '⏳ Pendiente';
          toggleBtn.className = 'pieza-toggle ' + (llegada ? 'llegada' : 'pendiente');
        }
        if (dots[idx]) dots[idx].className = 'pieza-estado ' + (llegada ? 'llegada' : 'pendiente');
        const pct = progreso(c);
        const est = estadoCliente(c);
        const fill = card.querySelector('.progress-bar-fill');
        if (fill) { fill.style.width = pct + '%'; fill.className = 'progress-bar-fill ' + (est === 'listo' ? 'listo' : est === 'pendiente' ? 'pendiente' : 'parcial'); }
        const badge = card.querySelector('.badge');
        const statusDot = card.querySelector('.status-dot');
        if (badge) { badge.textContent = labelEstado(est); badge.className = 'badge ' + est; }
        if (statusDot) statusDot.className = 'status-dot ' + est;
        const countEl = card.querySelector('.card-badge div');
        if (countEl) countEl.textContent = c.piezas.filter(p=>p.llegada).length + '/' + c.piezas.length + ' piezas';
      }
      updateStats();

      try {
        await actualizarPedido(cid, { piezas: c.piezas });
        if (estadoCliente(c) === 'listo') showToast('✓ ' + c.cliente + ' está completado', 'success');
      } catch { showToast('Error al guardar', 'error'); }
    });
  });
}

function setCronoFilter(val) {
  filtroCrono = val;
  renderCrono();
}

function updateStats() {
  document.getElementById('statTotal').textContent = pedidos.length;
  document.getElementById('statListos').textContent = pedidos.filter(c => estadoCliente(c) === 'listo').length;
  document.getElementById('statPendientes').textContent = pedidos.filter(c => estadoCliente(c) !== 'listo').length;
  const elPiezas = document.getElementById('statPiezas');
  if (elPiezas) elPiezas.textContent = pedidos.reduce((s,c) => s + (c.piezas||[]).filter(p=>!p.llegada).length, 0);
}

// ===== PIEZAS =====
function abrirTarjeta(id) {
  const card = document.getElementById('card-' + id);
  if (!card) return;
  const lista = card.querySelector('.piezas-list');
  const footer = card.querySelector('.card-footer-actions');
  if (!lista) return;
  const isOpen = lista.style.display === 'block';
  // Close all
  document.querySelectorAll('.client-card').forEach(el => {
    el.classList.remove('open');
    el.style.borderColor = '';
    const pl = el.querySelector('.piezas-list');
    const ft = el.querySelector('.card-footer-actions');
    if (pl) pl.style.display = 'none';
    if (ft) ft.style.display = 'none';
  });
  // Open this one if it was closed
  if (!isOpen) {
    card.classList.add('open');
    card.style.borderColor = 'var(--accent)';
    lista.style.display = 'block';
    if (footer) footer.style.display = 'flex';
  }
}

function getExpandedCards() {
  return [...document.querySelectorAll('.client-card .piezas-list')].filter(el => el.style.display === 'block').map(el => el.closest('.client-card').id.replace('card-', ''));
}
function restoreExpandedCards(ids) {
  ids.forEach(id => {
    const card = document.getElementById('card-' + id);
    if (!card) return;
    const lista = card.querySelector('.piezas-list');
    const footer = card.querySelector('.card-footer-actions');
    if (!lista) return;
    card.classList.add('open');
    card.style.borderColor = 'var(--accent)';
    lista.style.display = 'block';
    if (footer) footer.style.display = 'flex';
  });
}

async function togglePieza(cid, idx) {
  const c = pedidos.find(x => x.id === cid);
  if (!c) return;
  c.piezas[idx].llegada = !c.piezas[idx].llegada;
  const llegada = c.piezas[idx].llegada;

  const card = document.getElementById('card-' + cid);
  if (card) {
    const toggleBtn = card.querySelector(`.pieza-toggle[data-pid="${idx}"]`);
    const dots = card.querySelectorAll('.pieza-estado');
    if (toggleBtn) {
      toggleBtn.textContent = llegada ? '✓ Llegada' : '⏳ Pendiente';
      toggleBtn.className = 'pieza-toggle ' + (llegada ? 'llegada' : 'pendiente');
    }
    if (dots[idx]) {
      dots[idx].className = 'pieza-estado ' + (llegada ? 'llegada' : 'pendiente');
    }
    const piezas = c.piezas;
    const pct = progreso(c);
    const fill = card.querySelector('.progress-bar-fill');
    const est = estadoCliente(c);
    if (fill) {
      fill.style.width = pct + '%';
      fill.className = 'progress-bar-fill ' + (est === 'listo' ? 'listo' : est === 'pendiente' ? 'pendiente' : 'parcial');
    }
    const badge = card.querySelector('.badge');
    const statusDot = card.querySelector('.status-dot');
    if (badge) { badge.textContent = labelEstado(est); badge.className = 'badge ' + est; }
    if (statusDot) { statusDot.className = 'status-dot ' + est; }
    const countEl = card.querySelector('.card-badge div');
    if (countEl) countEl.textContent = piezas.filter(p=>p.llegada).length + '/' + piezas.length + ' piezas';
  }
  try {
    await actualizarPedido(cid, { piezas: c.piezas });
    const est = estadoCliente(c);
    if (est === 'listo') showToast('✓ ' + c.cliente + ' está completado', 'success');
    if (filtroActivo !== 'todos') render(); else updateStats();
  } catch { showToast('Error al guardar', 'error'); }
}

async function marcarTodo(cid) {
  const c = pedidos.find(x => x.id === cid);
  if (!c) return;
  c.piezas.forEach(p => p.llegada = true);

  const card = document.getElementById('card-' + cid);
  if (card) {
    card.querySelectorAll('.pieza-toggle[data-pid]').forEach(btn => {
      btn.textContent = '✓ Llegada'; btn.className = 'pieza-toggle llegada';
    });
    card.querySelectorAll('.pieza-estado').forEach(dot => {
      dot.className = 'pieza-estado llegada';
    });
    const fill = card.querySelector('.progress-bar-fill');
    if (fill) { fill.style.width = '100%'; fill.className = 'progress-bar-fill listo'; }
    const badge = card.querySelector('.badge');
    const statusDot = card.querySelector('.status-dot');
    if (badge) { badge.textContent = '✓ Completado'; badge.className = 'badge listo'; }
    if (statusDot) { statusDot.className = 'status-dot listo'; }
    const countEl = card.querySelector('.card-badge div');
    if (countEl) countEl.textContent = c.piezas.length + '/' + c.piezas.length + ' piezas';
  }
  try {
    await actualizarPedido(cid, { piezas: c.piezas });
    showToast('✓ ' + c.cliente + ' — todo completado', 'success');
    if (filtroActivo !== 'todos') render(); else updateStats();
  } catch { showToast('Error al guardar', 'error'); }
}

let devolucionesData = [];

async function cargarDevoluciones() {
  if (!empresaId) return;
  try {
    const r = await api(`devoluciones?empresa_id=eq.${empresaId}&order=created_at.desc`);
    if (r.ok) devolucionesData = await r.json();
    renderDevoluciones();
  } catch(e) {}
}

// (modal devolución eliminado — el botón DEVOLVER llama directamente a marcarDevolucion)

async function marcarDevolucion(cid, idx) {
  const c = pedidos.find(x => x.id === cid);
  if (!c || !c.piezas[idx]) return;
  const p = c.piezas[idx];
  try {
    // 1. Guardar en devoluciones — si falla, NO se toca el pedido
    const devData = {
      empresa_id:    empresaId,
      pedido_id:     cid,
      cliente:       c.cliente,
      matricula:     c.matricula,
      vehiculo:      c.vehiculo,
      pieza_ref:     p.ref     || null,
      pieza_desc:    p.desc    || null,
      pieza_empresa: p.empresa || null,
      pieza_obs:     p.obs     || null
    };
    const r = await api('devoluciones', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(devData) });
    if (!r.ok) {
      const err = await r.json().catch(() => {});
      throw new Error(err?.message || 'No se pudo guardar en devoluciones');
    }
    const arr = await r.json();
    if (!arr?.length) throw new Error('Sin respuesta — revisa los permisos RLS de la tabla devoluciones');
    devolucionesData.unshift(arr[0]);
    // 2. Solo ahora eliminar la pieza del pedido (guardado confirmado)
    c.piezas.splice(idx, 1);
    await actualizarPedido(cid, { piezas: c.piezas });
    showToast('Pieza enviada a devoluciones', 'warning');
    render();
  } catch(e) { showToast('Error: ' + (e.message || 'No se pudo procesar'), 'error'); }
}

// ===== DEVOLUCIONES: DESHACER / ELIMINAR =====
let devolucionPendingId = null;
let devolucionPendingAction = null;

function abrirConfirmDevolucion(devId, action) {
  devolucionPendingId     = devId;
  devolucionPendingAction = action;
  const icon  = document.getElementById('confirmDevolucionIcon');
  const title = document.getElementById('confirmDevolucionTitle');
  const text  = document.getElementById('confirmDevolucionText');
  const btn   = document.getElementById('confirmDevolucionBtn');
  if (action === 'restaurar') {
    icon.textContent     = '↺';
    title.textContent    = 'Restaurar pieza';
    text.textContent     = 'La pieza volverá al pedido original. ¿Confirmar?';
    btn.textContent      = 'Sí, restaurar';
    btn.style.background = 'var(--accent)'; btn.style.color = '#0f0f0f';
  } else {
    icon.textContent     = '🗑';
    title.textContent    = 'Eliminar pieza';
    text.textContent     = 'La pieza será eliminada definitivamente. Esta acción no se puede deshacer.';
    btn.textContent      = 'Eliminar definitivamente';
    btn.style.background = 'var(--red)'; btn.style.color = '#fff';
  }
  document.getElementById('confirmDevolucionOverlay').classList.add('active');
}

function cerrarConfirmDevolucion() {
  devolucionPendingId = null;
  devolucionPendingAction = null;
  document.getElementById('confirmDevolucionOverlay').classList.remove('active');
}

async function ejecutarConfirmDevolucion() {
  const id = devolucionPendingId;
  const action = devolucionPendingAction;
  cerrarConfirmDevolucion();
  if (!id || !action) return;
  if (action === 'restaurar') await hacerDeshacer(id);
  else await hacerEliminarDevolucion(id);
}

async function hacerDeshacer(devId) {
  const d = devolucionesData.find(x => x.id === devId);
  if (!d) return;
  const pedido = pedidos.find(x => x.id === d.pedido_id);
  if (!pedido) { showToast('El pedido original ya no existe', 'error'); return; }
  const pieza = {
    ref: d.pieza_ref || '',
    desc: d.pieza_desc || '',
    empresa: d.pieza_empresa || '',
    obs: '',
    llegada: false,
    created_at: new Date().toISOString()
  };
  pedido.piezas = pedido.piezas || [];
  pedido.piezas.push(pieza);
  try {
    await actualizarPedido(d.pedido_id, { piezas: pedido.piezas });
    await api(`devoluciones?id=eq.${devId}`, { method: 'DELETE' });
    devolucionesData = devolucionesData.filter(x => x.id !== devId);
    renderDevoluciones();
    render();
    showToast('↺ Pieza devuelta al pedido original', 'success');
  } catch { showToast('Error al deshacer', 'error'); }
}

async function hacerEliminarDevolucion(devId) {
  try {
    await api(`devoluciones?id=eq.${devId}`, { method: 'DELETE' });
    devolucionesData = devolucionesData.filter(d => d.id !== devId);
    renderDevoluciones();
    showToast('Devolución eliminada', 'warning');
  } catch { showToast('Error al eliminar', 'error'); }
}

function renderDevoluciones() {
  const el = document.getElementById('devolucionesList');
  if (!el) return;
  const count = devolucionesData.length;
  // Actualizar título con contador
  const h2 = document.querySelector('#viewDevoluciones h2');
  if (h2) {
    h2.innerHTML = 'Devoluciones pendientes'
      + (count > 0 ? ` <span style="background:var(--red);color:#fff;font-size:12px;padding:2px 9px;border-radius:10px;font-family:'DM Mono',monospace;vertical-align:middle;margin-left:8px">${count}</span>` : '');
  }
  if (!count) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">↩</div><p>No hay piezas pendientes de devolución</p></div>`;
    return;
  }
  el.innerHTML = devolucionesData.map(d => `
    <div style="background:var(--surface);border:1px solid var(--red);border-radius:12px;padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div style="flex:1;min-width:160px">
        <div style="font-weight:600;font-size:14px">${d.cliente || '—'}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">
          <span class="matricula" style="font-size:11px">${d.matricula || '—'}</span>
          ${d.vehiculo ? ` · ${d.vehiculo}` : ''}
        </div>
      </div>
      <div style="flex:2;min-width:160px">
        <div style="font-size:13px;font-weight:500">${d.pieza_desc || '—'}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">
          ${d.pieza_ref ? `<span style="font-family:'DM Mono',monospace">${d.pieza_ref}</span>` : ''}${d.pieza_empresa ? ` · ${d.pieza_empresa}` : ''}
          ${d.pieza_obs ? `<span style="display:block;margin-top:3px;color:var(--yellow);font-style:italic">${d.pieza_obs}</span>` : ''}
        </div>
      </div>
      <div style="font-size:11px;color:var(--muted);min-width:80px;text-align:center">${d.created_at ? new Date(d.created_at).toLocaleDateString('es-ES') : ''}</div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button onclick="abrirConfirmDevolucion('${d.id}','restaurar')" style="background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;letter-spacing:0.02em">RESTAURAR</button>
        <button onclick="abrirConfirmDevolucion('${d.id}','eliminar')" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red);border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;letter-spacing:0.02em">ELIMINAR</button>
      </div>
    </div>`).join('');
}

// ===== MODAL =====
function abrirModalNuevo() {
  editandoId = null;
  document.getElementById('modalTitle').textContent = 'Nuevo pedido';
  ['fCliente','fMatricula','fVehiculo'].forEach(id => document.getElementById(id).value = '');
  piezasRows = [];
  document.getElementById('piezasInputs').innerHTML = '';
  addPiezaRow();
  document.getElementById('modalOverlay').classList.add('active');
}

function abrirModalEditar(cid) {
  const c = pedidos.find(x => x.id === cid);
  if (!c) return;
  editandoId = cid;
  document.getElementById('modalTitle').textContent = 'Editar — ' + c.cliente;
  document.getElementById('fCliente').value = c.cliente || '';
  document.getElementById('fMatricula').value = c.matricula || '';
  document.getElementById('fVehiculo').value = c.vehiculo || '';
  piezasRows = [];
  document.getElementById('piezasInputs').innerHTML = '';
  (c.piezas || []).forEach(p => addPiezaRow(p.ref, p.desc, p.llegada, p.created_at, p.obs || '', p.atiende || '', p.empresa || '', p.entrega || '', p.precio || '', p.dto || ''));
  document.getElementById('modalOverlay').classList.add('active');
}

function cerrarModal() { document.getElementById('modalOverlay').classList.remove('active'); editandoId = null; }
function cerrarModalSiOverlay(e) { if (e.target === document.getElementById('modalOverlay')) cerrarModal(); }

function addPiezaRow(ref = '', desc = '', llegada = false, created_at = null, obs = '', atiende = '', empresa = '', entrega = '', precio = '', dto = '') {
  const pid = 'pr_' + Date.now() + Math.random().toString(36).slice(2);
  const ts = created_at || new Date().toISOString();
  piezasRows.push({ pid, llegada, created_at: ts, obs, atiende, empresa, entrega, precio, dto });
  const row = document.createElement('div');
  row.className = 'pieza-input-row'; row.id = 'row_' + pid;
  row.innerHTML = `
    <input type="text" placeholder="Referencia" value="${ref}" id="ref_${pid}" style="grid-column:1" oninput="autocompletarRef('${pid}',this.value)" autocomplete="off">
    <input type="text" placeholder="Descripción" value="${desc}" id="desc_${pid}" style="grid-column:2">
    <button class="btn-remove-pieza" onclick="removePiezaRow('${pid}')" style="grid-column:3;grid-row:1/5">×</button>
    <div style="grid-column:1/3;display:flex;gap:8px;align-items:center">
      <input type="text" placeholder="Quién atiende (Web, Whatsapp...)" value="${atiende}" id="atiende_${pid}" style="flex:35;min-width:0;font-size:12px">
      <input type="text" placeholder="Proveedor" value="${empresa}" id="empresa_${pid}" style="flex:35;min-width:0;font-size:12px">
      <div style="flex:17.5;min-width:0;position:relative;display:flex;align-items:center">
        <input type="number" step="0.01" min="0" placeholder="0.00" value="${precio}" id="precio_${pid}" style="padding-right:20px;width:100%;box-sizing:border-box;font-size:12px">
        <span style="position:absolute;right:8px;font-size:11px;color:var(--muted);pointer-events:none">€</span>
      </div>
      <div style="flex:12.5;min-width:0;position:relative;display:flex;align-items:center">
        <input type="number" step="1" min="0" max="100" placeholder="0" value="${dto}" id="dto_${pid}" style="padding-right:20px;width:100%;box-sizing:border-box;font-size:12px">
        <span style="position:absolute;right:8px;font-size:11px;color:var(--muted);pointer-events:none">%</span>
      </div>
    </div>
    <input type="text" placeholder="Entrega prevista" value="${entrega}" id="entrega_${pid}" style="grid-column:1;font-size:12px">
    <input type="text" placeholder="Observaciones" value="${obs}" id="obs_${pid}" style="grid-column:2;font-size:12px">`;
  document.getElementById('piezasInputs').appendChild(row);
}

function removePiezaRow(pid) {
  piezasRows = piezasRows.filter(x => x.pid !== pid);
  document.getElementById('row_' + pid)?.remove();
}

function autocompletarRef(pid, val) {
  if (!val || val.length < 2) return;
  const q = val.trim().toLowerCase();
  // Buscar en todos los pedidos existentes
  const encontrado = pedidos.flatMap(c => c.piezas || []).find(p => p.ref && p.ref.toLowerCase() === q && (p.desc || p.empresa));
  if (encontrado) {
    const descEl = document.getElementById('desc_' + pid);
    const empEl = document.getElementById('empresa_' + pid);
    if (descEl && !descEl.value) descEl.value = encontrado.desc || '';
    if (empEl && !empEl.value) empEl.value = encontrado.empresa || '';
  }
}

async function guardarPedido() {
  const cliente = document.getElementById('fCliente').value.trim().toUpperCase();
  if (!cliente) { showToast('El cliente es obligatorio', 'warning'); return; }
  const piezas = piezasRows.map(({ pid, llegada, created_at }) => ({
    ref: document.getElementById('ref_' + pid)?.value.trim() || '',
    desc: document.getElementById('desc_' + pid)?.value.trim() || '',
    obs: document.getElementById('obs_' + pid)?.value.trim() || '',
    atiende: document.getElementById('atiende_' + pid)?.value.trim() || '',
    empresa: document.getElementById('empresa_' + pid)?.value.trim() || '',
    entrega: document.getElementById('entrega_' + pid)?.value.trim() || '',
    precio:  document.getElementById('precio_' + pid)?.value.trim() || '',
    dto:     document.getElementById('dto_' + pid)?.value.trim() || '',
    llegada, created_at
  })).filter(p => p.desc);

  const data = {
    cliente,
    matricula: document.getElementById('fMatricula').value.trim().toUpperCase(),
    vehiculo: document.getElementById('fVehiculo').value.trim().toUpperCase(),
    empresa_id: empresaId,
    piezas
  };

  const btn = document.getElementById('btnGuardar');
  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    if (editandoId) {
      const c = pedidos.find(x => x.id === editandoId);
      if (c) data.piezas = piezas.map(np => {
        const old = (c.piezas||[]).find(op => op.ref === np.ref && op.desc === np.desc);
        return old ? { ...np, llegada: old.llegada, created_at: old.created_at, obs: np.obs } : np;
      });
      await actualizarPedido(editandoId, data);
      const idx = pedidos.findIndex(x => x.id === editandoId);
      if (idx !== -1) pedidos[idx] = { ...pedidos[idx], ...data };
      showToast('Pedido actualizado', 'success');
    } else {
      const nuevo = await crearPedido(data);
      pedidos.unshift(nuevo);
      guardarClienteEnDB(data.matricula, data.cliente, data.vehiculo);
      showToast('✓ Pedido creado para ' + cliente, 'success');
    }
    cerrarModal(); render();
  } catch { showToast('Error al guardar. Comprueba la conexión.', 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Guardar pedido'; }
}

// ===== ELIMINAR =====
function pedirConfirmEliminar(cid) { eliminandoId = cid; document.getElementById('confirmOverlay').classList.add('active'); }
function cerrarConfirm() { eliminandoId = null; document.getElementById('confirmOverlay').classList.remove('active'); }
async function confirmarEliminar() {
  if (!eliminandoId) return;
  try {
    await eliminarPedido(eliminandoId);
    pedidos = pedidos.filter(c => c.id !== eliminandoId);
    cerrarConfirm(); render();
    showToast('Pedido eliminado', 'warning');
  } catch { showToast('Error al eliminar', 'error'); }
}

// ===== FILTROS =====
function setFilter(el, val) {
  filtroActivo = val;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  render();
}
function setFilterCard(val) {
  filtroActivo = val;
  ['filterCardTodos','filterCardListos','filterCardPendientes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.outline = '';
  });
  const map = { 'todos': 'filterCardTodos', 'listo': 'filterCardListos', 'pendiente': 'filterCardPendientes' };
  const el = document.getElementById(map[val]);
  if (el) el.style.outline = '2px solid var(--accent)';
  render();
}
function toggleClearBtn(input) {
  const btn = document.getElementById('clearSearch');
  if (btn) btn.style.display = input.value ? 'block' : 'none';
}

function clearSearchInput() {
  const input = document.getElementById('searchInput');
  input.value = '';
  busqueda = '';
  toggleClearBtn(input);
  if (vistaActual === 'crono') renderCrono();
  else render();
  input.focus();
}

document.getElementById('searchInput').addEventListener('input', e => {
  busqueda = e.target.value;
  if (vistaActual === 'crono') {
    renderCrono();
  } else {
    render();
  }
});

// ===== EXPORTAR =====
function exportarDatos() {
  const lineas = ['FECHA\tHORA\tCLIENTE\tMATRÍCULA\tVEHÍCULO\tEMPRESA\tENTREGA\tREFERENCIA\tDESCRIPCIÓN\tLLEGADA'];
  pedidos.forEach(c => (c.piezas||[]).forEach(p => {
    const d = p.created_at ? new Date(p.created_at) : (c.created_at ? new Date(c.created_at) : null);
    lineas.push([d ? d.toLocaleDateString('es-ES') : '', d ? d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : '',
      c.cliente, c.matricula, c.vehiculo, c.empresa, c.entrega, p.ref, p.desc, p.llegada?'SÍ':'NO'].join('\t'));
  }));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lineas.join('\n')], {type:'text/plain;charset=utf-8'}));
  a.download = 'pedidos_taller_' + new Date().toISOString().slice(0,10) + '.txt';
  a.click();
  showToast('Exportado correctamente', 'success');
}

// ===== TOAST =====
function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ===== AUTOCOMPLETADO MATRÍCULA =====
let clientesDB = [];

async function cargarClientesDB() {
  try {
    const res = await api('clientes?order=matricula.asc');
    if (res.ok) {
      clientesDB = await res.json();
    }
  } catch(e) {
    clientesDB = [];
  }
}

function iniciarRefreshClientes() {
  clearInterval(window._clientesInterval);
  window._clientesInterval = setInterval(cargarClientesDB, 300000); // 5 min
}

function buscarMatriculaGeneric(valor, listId, matriculaId, clienteId, vehiculoId, telefonoId) {
  const list = document.getElementById(listId);
  const q = valor.toUpperCase().trim();
  if (!q || q.length < 2) { list.style.display = 'none'; return; }
  const matches = clientesDB.filter(c =>
    (c.matricula||'').toUpperCase().includes(q) ||
    (c.cliente||'').toUpperCase().includes(q)
  ).slice(0, 6);
  if (!matches.length) { list.style.display = 'none'; return; }
  list.innerHTML = matches.map(c => `
    <div class="autocomplete-item" onclick="seleccionarClienteGeneric('${c.matricula}','${c.cliente.replace(/'/g,"\'")}','${(c.vehiculo||'').replace(/'/g,"\'")}','${(c.telefono||'').replace(/'/g,"\'")}','${matriculaId}','${clienteId}','${vehiculoId}','${listId}','${telefonoId||''}')">
      <strong>${c.matricula}</strong>
      <span>${c.cliente}${c.vehiculo ? ' · ' + c.vehiculo : ''}${c.telefono ? ' · 📞' + c.telefono : ''}</span>
    </div>`).join('');
  list.style.display = 'block';
}

function seleccionarClienteGeneric(matricula, cliente, vehiculo, telefono, matriculaId, clienteId, vehiculoId, listId, telefonoId) {
  document.getElementById(matriculaId).value = matricula;
  if (clienteId) document.getElementById(clienteId).value = cliente;
  if (vehiculoId) document.getElementById(vehiculoId).value = vehiculo;
  if (telefonoId && telefono) { const el = document.getElementById(telefonoId); if (el) el.value = telefono; }
  document.getElementById(listId).style.display = 'none';
}

function buscarMatricula(valor) {
  buscarMatriculaGeneric(valor, 'autocompleteList', 'fMatricula', 'fCliente', 'fVehiculo', 'fTelefono');
}
function buscarMatricula_unused(valor) {
  const list = document.getElementById('autocompleteList');
  const q = valor.toUpperCase().trim();
  if (!q || q.length < 2) { list.style.display = 'none'; return; }

  const matches = clientesDB.filter(c =>
    (c.matricula||'').toUpperCase().includes(q) ||
    (c.cliente||'').toUpperCase().includes(q)
  ).slice(0, 6);

  if (!matches.length) { list.style.display = 'none'; return; }

  list.innerHTML = matches.map(c => `
    <div class="autocomplete-item" onclick="seleccionarCliente('${c.matricula}','${c.cliente.replace(/'/g,"\'")}','${(c.vehiculo||'').replace(/'/g,"\'")}')">
      <strong>${c.matricula}</strong>
      <span>${c.cliente}${c.vehiculo ? ' · ' + c.vehiculo : ''}</span>
    </div>`).join('');
  list.style.display = 'block';
}

function seleccionarCliente(matricula, cliente, vehiculo) {
  document.getElementById('fMatricula').value = matricula;
  document.getElementById('fCliente').value = cliente;
  document.getElementById('fVehiculo').value = vehiculo;
  document.getElementById('autocompleteList').style.display = 'none';
}

function guardarClienteEnDB(matricula, cliente, vehiculo, telefono) {
  if (!matricula) return;
  const body = { matricula: matricula.toUpperCase(), cliente, vehiculo, empresa_id: empresaId };
  if (telefono) body.telefono = telefono;
  // Update cache
  const cached = clientesDB.find(c => c.matricula === matricula.toUpperCase());
  if (cached) { cached.cliente = cliente; cached.vehiculo = vehiculo; if (telefono) cached.telefono = telefono; }
  else if (telefono) clientesDB.push({ matricula: matricula.toUpperCase(), cliente, vehiculo, telefono });
  // Upsert - insert or update
  api('clientes', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(body)
  }).catch(() => {});
}

// Cerrar autocomplete al hacer click fuera
document.addEventListener('click', e => {
  ['autocompleteList','itvAutoList','agendaAutoList'].forEach(id => {
    const list = document.getElementById(id);
    const group = list?.closest('[id$="Group"]') || list?.parentElement;
    if (list && !e.target.closest('[id$="Group"]') && !e.target.closest('#matriculaGroup')) {
      list.style.display = 'none';
    }
  });
  if (!e.target.closest('#matriculaGroup')) {
    const list = document.getElementById('autocompleteList');
    if (list) list.style.display = 'none';
  }
});

// ===== HELPERS MODAL =====
function cerrarModalId(id) { document.getElementById(id).classList.remove('active'); }
function cerrarModalSiOverlay2(e, id) { if (e.target === document.getElementById(id)) cerrarModalId(id); }

// ===== ITV =====
let itvData = [];
let editandoItvId = null;

let itvTabActual = 'pendientes';

function setItvTab(tab) {
  itvTabActual = tab;
  const btnP = document.getElementById('itvTabPendientes');
  const btnH = document.getElementById('itvTabHistorial');
  if (btnP) {
    btnP.style.borderBottomColor = tab === 'pendientes' ? 'var(--accent)' : 'transparent';
    btnP.style.color = tab === 'pendientes' ? 'var(--accent)' : 'var(--muted)';
    btnP.style.fontWeight = tab === 'pendientes' ? '500' : 'normal';
  }
  if (btnH) {
    btnH.style.borderBottomColor = tab === 'historial' ? 'var(--accent)' : 'transparent';
    btnH.style.color = tab === 'historial' ? 'var(--accent)' : 'var(--muted)';
    btnH.style.fontWeight = tab === 'historial' ? '500' : 'normal';
  }
  renderItv();
}

async function cargarItv() {
  try {
    const res = await api('itv?order=fecha.asc&empresa_id=eq.' + empresaId);
    if (res.ok) {
      itvData = await res.json();
      renderItv();
    }
  } catch(e) {}
}

function renderItv() {
  const itvActivas = itvData.filter(i => i.estado !== 'aprobada');
  const itvAprobadas = itvData.filter(i => i.estado === 'aprobada');

  // Update stats
  document.getElementById('itvTotal').textContent = itvData.length;
  document.getElementById('itvAprobadas').textContent = itvAprobadas.length;
  document.getElementById('itvRechazadas').textContent = itvData.filter(i => i.estado === 'rechazada').length;
  document.getElementById('itvPendientes').textContent = itvData.filter(i => i.estado === 'pendiente').length;

  // Filter by tab
  const itvDataFiltered = itvTabActual === 'historial' ? itvAprobadas : itvActivas;

  const container = document.getElementById('itvList');
  if (!itvDataFiltered.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${itvTabActual === 'historial' ? '📋' : '🔍'}</div><p>${itvTabActual === 'historial' ? 'No hay ITVs aprobadas en el historial' : 'No hay ITVs pendientes ni rechazadas'}</p></div>`;
    return;
  }

  // Group by month
  const grouped = {};
  itvDataFiltered.forEach(itv => {
    const fp3 = itv.fecha.split('-'); const d = new Date(parseInt(fp3[0]), parseInt(fp3[1])-1, parseInt(fp3[2]));
    const key = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(itv);
  });

  container.innerHTML = Object.entries(grouped).map(([mes, items]) => `
    <div style="margin-bottom:24px">
      <div style="font-family:'Syne',sans-serif;font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.08em;padding:8px 0;border-bottom:1px solid var(--border);margin-bottom:8px">${mes}</div>
      ${items.map(itv => {
        const color = itv.estado === 'aprobada' ? 'var(--green)' : itv.estado === 'rechazada' ? 'var(--red)' : 'var(--yellow)';
        const bg = itv.estado === 'aprobada' ? 'var(--green-bg)' : itv.estado === 'rechazada' ? 'var(--red-bg)' : 'var(--yellow-bg)';
        const label = itv.estado === 'aprobada' ? '✓ Aprobada' : itv.estado === 'rechazada' ? '✕ Rechazada' : '⏳ Pendiente';
        const fp2 = itv.fecha.split('-'); const fecha = new Date(parseInt(fp2[0]), parseInt(fp2[1])-1, parseInt(fp2[2])).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        return `
        <div style="background:var(--surface);border:1px solid ${color};border-left:4px solid ${color};border-radius:8px;padding:14px 16px;margin-bottom:8px;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:start">
          <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
              <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:15px">${itv.cliente || '—'}</span>
              <span style="font-family:'DM Mono',monospace;font-size:11px;background:var(--surface2);border:1px solid var(--border2);padding:2px 7px;border-radius:4px;color:var(--accent)">${itv.matricula || '—'}</span>
              <span style="font-size:12px;color:var(--muted)">${itv.vehiculo || ''}</span>
            </div>
            <div style="font-size:12px;color:var(--muted);display:flex;gap:16px;flex-wrap:wrap">
              <span>📅 ${fecha}</span>
              ${itv.horario ? `<span>🕐 ${itv.horario.slice(0,5)}</span>` : ''}
              ${itv.lugar ? `<span>📍 ${itv.lugar}</span>` : ''}
            </div>
            ${itv.observaciones ? `<div style="font-size:12px;color:var(--muted);font-style:italic;margin-top:6px">${itv.observaciones}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
            <span style="background:${bg};color:${color};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500;white-space:nowrap">${label}</span>
            <div style="display:flex;gap:6px">
              ${itv.estado === 'pendiente' ? `
                <button onclick="cambiarEstadoItv('${itv.id}','aprobada')" style="background:var(--green-bg);color:var(--green);border:1px solid var(--green);padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer;font-family:'DM Sans',sans-serif">✓ Aprobada</button>
                <button onclick="cambiarEstadoItv('${itv.id}','rechazada')" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red);padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer;font-family:'DM Sans',sans-serif">✕ Rechazada</button>
              ` : `<button onclick="cambiarEstadoItv('${itv.id}','pendiente')" style="background:var(--surface2);color:var(--muted);border:1px solid var(--border2);padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer;font-family:'DM Sans',sans-serif">↺ Resetear</button>`}
              <button onclick="editarItv('${itv.id}')" style="background:var(--surface2);color:var(--muted);border:1px solid var(--border2);padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer;font-family:'DM Sans',sans-serif">✏</button>
              <button onclick="eliminarItv('${itv.id}')" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red);padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer;font-family:'DM Sans',sans-serif">✕</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`).join('');
}

function abrirModalItv() {
  editandoItvId = null;
  document.getElementById('modalItvTitle').textContent = 'Nueva ITV';
  ['itvFecha','itvHorario','itvLugar','itvMatricula','itvVehiculo','itvCliente','itvObs'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('modalItv').classList.add('active');
}

function editarItv(id) {
  const itv = itvData.find(x => x.id === id);
  if (!itv) return;
  editandoItvId = id;
  document.getElementById('modalItvTitle').textContent = 'Editar ITV';
  // Convert yyyy-mm-dd to dd/mm/yyyy for display
  const fp = (itv.fecha || '').split('-');
  document.getElementById('itvFecha').value = fp.length === 3 ? `${fp[2]}/${fp[1]}/${fp[0]}` : (itv.fecha || '');
  document.getElementById('itvHorario').value = itv.horario ? itv.horario.slice(0,5) : '';
  document.getElementById('itvLugar').value = itv.lugar || '';
  document.getElementById('itvMatricula').value = itv.matricula || '';
  document.getElementById('itvVehiculo').value = itv.vehiculo || '';
  document.getElementById('itvCliente').value = itv.cliente || '';
  document.getElementById('itvObs').value = itv.observaciones || '';
  document.getElementById('modalItv').classList.add('active');
}

async function guardarItv() {
  const fechaRaw = document.getElementById('itvFecha').value;
  if (!fechaRaw) { showToast('La fecha es obligatoria', 'warning'); return; }
  // Convert dd/mm/yyyy to yyyy-mm-dd for Supabase
  const fechaParts = fechaRaw.split('/');
  const fecha = fechaParts.length === 3 ? `${fechaParts[2]}-${fechaParts[1]}-${fechaParts[0]}` : fechaRaw;
  const data = {
    empresa_id: empresaId,
    fecha,
    horario: document.getElementById('itvHorario').value || null,
    lugar: document.getElementById('itvLugar').value.trim(),
    matricula: document.getElementById('itvMatricula').value.trim().toUpperCase(),
    vehiculo: document.getElementById('itvVehiculo').value.trim(),
    cliente: document.getElementById('itvCliente').value.trim(),
    observaciones: document.getElementById('itvObs').value.trim()
  };
  const btn = document.getElementById('btnGuardarItv');
  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    if (editandoItvId) {
      await api('itv?id=eq.' + editandoItvId, { method: 'PATCH', body: JSON.stringify(data) });
    } else {
      await api('itv', { method: 'POST', body: JSON.stringify(data) });
    }
    cerrarModalId('modalItv');
    await cargarItv();
    showToast('ITV guardada correctamente', 'success');
  } catch { showToast('Error al guardar', 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Guardar'; }
}

async function cambiarEstadoItv(id, estado) {
  try {
    await api('itv?id=eq.' + id, { method: 'PATCH', body: JSON.stringify({ estado }) });
    await cargarItv();
    showToast(estado === 'aprobada' ? '✓ ITV aprobada' : estado === 'rechazada' ? 'ITV rechazada' : 'Estado reseteado', estado === 'aprobada' ? 'success' : 'warning');
  } catch { showToast('Error al actualizar', 'error'); }
}

async function eliminarItv(id) {
  if (!confirm('¿Eliminar esta ITV?')) return;
  try {
    await api('itv?id=eq.' + id, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
    await cargarItv();
    showToast('ITV eliminada', 'warning');
  } catch { showToast('Error al eliminar', 'error'); }
}

// ===== AGENDA =====
let agendaData = [];
let editandoAgendaId = null;
let agendaMes = new Date().getMonth();
let agendaAnio = new Date().getFullYear();

async function cargarAgendaData() {
  try {
    const res = await api('agenda?order=fecha.asc,hora.asc&empresa_id=eq.' + empresaId);
    if (res.ok) agendaData = await res.json();
  } catch(e) {}
}

function cambiarMes(delta) {
  agendaMes += delta;
  if (agendaMes > 11) { agendaMes = 0; agendaAnio++; }
  if (agendaMes < 0) { agendaMes = 11; agendaAnio--; }
  renderAgenda();
}

async function renderAgenda() {
  await cargarAgendaData();
  // Cargar vacaciones si aún no están en memoria (p.ej. acceso directo a agenda sin pasar por vacaciones)
  if (!vacacionesData.length && empresaId) {
    try {
      const [rT, rV] = await Promise.all([
        api(`trabajadores?empresa_id=eq.${empresaId}&order=nombre.asc`),
        api(`vacaciones?empresa_id=eq.${empresaId}&order=fecha_inicio.asc`)
      ]);
      if (rT.ok) trabajadoresData = await rT.json();
      if (rV.ok) vacacionesData = await rV.json();
    } catch(e) { console.log('vacaciones en agenda:', e); }
  }
  const container = document.getElementById('agendaCalendario');
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('agendaMesLabel').textContent = meses[agendaMes] + ' ' + agendaAnio;

  const primerDia = new Date(agendaAnio, agendaMes, 1);
  const ultimoDia = new Date(agendaAnio, agendaMes + 1, 0);
  const diasSemana = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

  let startDay = primerDia.getDay() - 1;
  if (startDay < 0) startDay = 6;

  let html = `
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
      ${diasSemana.map(d => `<div style="text-align:center;font-size:11px;font-weight:500;color:var(--muted);padding:6px 0;text-transform:uppercase;letter-spacing:0.05em">${d}</div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">`;

  for (let i = 0; i < startDay; i++) {
    html += `<div style="min-height:80px"></div>`;
  }

  for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
    const fechaStr = `${agendaAnio}-${String(agendaMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    const citas = agendaData.filter(c => c.fecha === fechaStr);
    const vacsHoy = vacacionesData.filter(v => v.fecha_inicio <= fechaStr && v.fecha_fin >= fechaStr);
    const hoy = new Date();
    const esHoy = dia === hoy.getDate() && agendaMes === hoy.getMonth() && agendaAnio === hoy.getFullYear();

    html += `<div style="min-height:80px;background:var(--surface);border:1px solid ${esHoy ? 'var(--accent)' : 'var(--border)'};border-radius:8px;padding:6px;cursor:pointer" onclick="abrirModalAgendaDia('${fechaStr}')">
      <div style="font-size:12px;font-weight:${esHoy ? '700' : '400'};color:${esHoy ? 'var(--accent)' : 'var(--text)'};margin-bottom:4px">${dia}</div>
      ${citas.map(c => `
        <div style="background:var(--blue-bg);color:var(--blue);border-radius:4px;padding:2px 5px;font-size:10px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer" onclick="event.stopPropagation();editarAgenda('${c.id}')">
          ${c.hora ? c.hora.slice(0,5) + ' ' : ''}${c.cliente || c.matricula}
        </div>`).join('')}
      ${vacsHoy.map(v => {
        const t = trabajadoresData.find(x => x.id === v.trabajador_id);
        const color = t?.color || '#e8a030';
        const colorBg = color + '22';
        return `<div style="background:${colorBg};color:${color};border-radius:4px;padding:2px 5px;font-size:10px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:2px solid ${color}">🏖️ ${t?.nombre || 'Trabajador'}</div>`;
      }).join('')}
    </div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

function abrirModalAgenda() {
  editandoAgendaId = null;
  document.getElementById('modalAgendaTitle').textContent = 'Nueva cita';
  ['agendaFecha','agendaHora','agendaMatricula','agendaCliente','agendaVehiculo','agendaTelefono','agendaTrabajos'].forEach(id => document.getElementById(id).value = '');
  const btnElim = document.getElementById('btnEliminarCita');
  if (btnElim) btnElim.style.display = 'none';
  document.getElementById('modalAgenda').classList.add('active');
}

function abrirModalAgendaDia(fecha) {
  abrirModalAgenda();
  document.getElementById('agendaFecha').value = fecha;
}

function editarAgenda(id) {
  const cita = agendaData.find(x => x.id === id);
  if (!cita) return;
  editandoAgendaId = id;
  document.getElementById('modalAgendaTitle').textContent = 'Editar cita';
  document.getElementById('agendaFecha').value = cita.fecha || '';
  document.getElementById('agendaHora').value = cita.hora || '';
  document.getElementById('agendaMatricula').value = cita.matricula || '';
  document.getElementById('agendaCliente').value = cita.cliente || '';
  document.getElementById('agendaVehiculo').value = cita.vehiculo || '';
  document.getElementById('agendaTelefono').value = cita.telefono || '';
  document.getElementById('agendaTrabajos').value = cita.trabajos || '';
  document.getElementById('modalAgenda').classList.add('active');
  const btnElim = document.getElementById('btnEliminarCita');
  if (btnElim) btnElim.style.display = 'inline-flex';
}

async function guardarAgenda() {
  const fecha = document.getElementById('agendaFecha').value;
  if (!fecha) { showToast('La fecha es obligatoria', 'warning'); return; }
  const data = {
    empresa_id: empresaId,
    fecha,
    hora: document.getElementById('agendaHora').value || null,
    matricula: document.getElementById('agendaMatricula').value.trim().toUpperCase(),
    cliente: document.getElementById('agendaCliente').value.trim(),
    vehiculo: document.getElementById('agendaVehiculo').value.trim(),
    telefono: document.getElementById('agendaTelefono').value.trim(),
    trabajos: document.getElementById('agendaTrabajos').value.trim()
  };
  const btn = document.getElementById('btnGuardarAgenda');
  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    if (editandoAgendaId) {
      await api('agenda?id=eq.' + editandoAgendaId, { method: 'PATCH', body: JSON.stringify(data) });
    } else {
      await api('agenda', { method: 'POST', body: JSON.stringify(data) });
    }
    cerrarModalId('modalAgenda');
    await renderAgenda();
    showToast('Cita guardada correctamente', 'success');
  } catch { showToast('Error al guardar', 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Guardar'; }
}

async function eliminarCita() {
  if (!editandoAgendaId) return;
  if (!confirm('¿Eliminar esta cita?')) return;
  try {
    await api('agenda?id=eq.' + editandoAgendaId, { method: 'DELETE' });
    agendaData = agendaData.filter(c => c.id !== editandoAgendaId);
    cerrarModalId('modalAgenda');
    renderAgenda();
    showToast('Cita eliminada', 'warning');
  } catch { showToast('Error al eliminar', 'error'); }
}

// ===== CAJA =====
let cajaData = [];
let cajaFecha = new Date().toISOString().slice(0, 10);

function cambiarFechaCaja(delta) {
  const d = new Date(cajaFecha);
  d.setDate(d.getDate() + delta);
  cajaFecha = d.toISOString().slice(0, 10);
  cargarCaja();
}

async function cargarCaja() {
  // Update label
  const d = new Date(cajaFecha + 'T12:00:00');
  document.getElementById('cajaFechaLabel').textContent = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  try {
    const res = await api(`caja?fecha=eq.${cajaFecha}&empresa_id=eq.${empresaId}&order=created_at.asc`);
    if (res.ok) {
      cajaData = await res.json();
      renderCaja();
    }
  } catch(e) {}
}

function renderCaja() {
  // Stats
  const cobros = cajaData.filter(m => m.tipo === 'cobro');
  const pagos = cajaData.filter(m => m.tipo === 'pago');
  const totalCobros = cobros.reduce((s, m) => s + parseFloat(m.importe), 0);
  const totalPagos = pagos.reduce((s, m) => s + parseFloat(m.importe), 0);
  const saldo = totalCobros - totalPagos;

  const formas = ['efectivo', 'tarjeta', 'transferencia', 'cartera'];
  const colores = { efectivo: 'var(--green)', tarjeta: 'var(--blue)', transferencia: 'var(--accent)', cartera: 'var(--muted)' };
  const iconos = { efectivo: '💵', tarjeta: '💳', transferencia: '🏦', cartera: '👛' };

  document.getElementById('cajaResumen').innerHTML = `
    <div class="stat-card" style="flex:none;padding:12px 16px">
      <div style="font-size:11px;color:var(--green);text-transform:uppercase;letter-spacing:0.06em">Total cobros</div>
      <div class="stat-number" style="font-size:22px;color:var(--green)">${totalCobros.toFixed(2)} €</div>
    </div>
    <div class="stat-card" style="flex:none;padding:12px 16px">
      <div style="font-size:11px;color:var(--red);text-transform:uppercase;letter-spacing:0.06em">Total pagos</div>
      <div class="stat-number" style="font-size:22px;color:var(--red)">${totalPagos.toFixed(2)} €</div>
    </div>
    <div class="stat-card" style="flex:none;padding:12px 16px;border-color:${saldo >= 0 ? 'var(--green)' : 'var(--red)'}">
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em">Saldo del día</div>
      <div class="stat-number" style="font-size:22px;color:${saldo >= 0 ? 'var(--green)' : 'var(--red)'}">${saldo >= 0 ? '+' : ''}${saldo.toFixed(2)} €</div>
    </div>
    ${formas.map(f => {
      const total = cajaData.filter(m => m.forma_pago === f).reduce((s, m) => s + (m.tipo === 'cobro' ? 1 : -1) * parseFloat(m.importe), 0);
      return `<div class="stat-card" style="flex:none;padding:12px 16px">
        <div style="font-size:11px;color:${colores[f]};text-transform:uppercase;letter-spacing:0.06em">${iconos[f]} ${f}</div>
        <div class="stat-number" style="font-size:20px;color:${colores[f]}">${total >= 0 ? '+' : ''}${total.toFixed(2)} €</div>
      </div>`;
    }).join('')}`;

  // List
  const container = document.getElementById('cajaList');
  if (!cajaData.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💰</div><p>No hay movimientos hoy</p></div>';
    return;
  }

  container.innerHTML = `
    <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden">
      <div style="display:grid;grid-template-columns:80px 1fr 1fr 120px 100px 80px;padding:8px 16px;background:var(--surface2);border-bottom:2px solid var(--border2);font-size:10px;font-weight:500;color:var(--faint);text-transform:uppercase;letter-spacing:0.06em">
        <span>Tipo</span><span>Concepto</span><span>Cliente/Proveedor</span><span>Forma pago</span><span style="text-align:right">Importe</span><span></span>
      </div>
      ${cajaData.map(m => `
        <div style="display:grid;grid-template-columns:80px 1fr 1fr 120px 100px 80px;padding:11px 16px;border-bottom:1px solid var(--border);background:var(--surface);align-items:center">
          <span style="background:${m.tipo === 'cobro' ? 'var(--green-bg)' : 'var(--red-bg)'};color:${m.tipo === 'cobro' ? 'var(--green)' : 'var(--red)'};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:500;width:fit-content">${m.tipo === 'cobro' ? '↑ Cobro' : '↓ Pago'}</span>
          <span style="font-size:13px">${m.concepto || '—'}</span>
          <span style="font-size:12px;color:var(--muted)">${m.cliente || '—'}</span>
          <span style="font-size:12px">${iconos[m.forma_pago] || ''} ${m.forma_pago}</span>
          <span style="font-size:14px;font-weight:500;color:${m.tipo === 'cobro' ? 'var(--green)' : 'var(--red)'};text-align:right">${m.tipo === 'cobro' ? '+' : '-'}${parseFloat(m.importe).toFixed(2)} €</span>
          <div style="display:flex;gap:4px;justify-content:flex-end">
            <button onclick="eliminarMovimiento('${m.id}')" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red);padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer">✕</button>
          </div>
        </div>`).join('')}
    </div>`;
}

function abrirModalCaja(tipo) {
  document.getElementById('cajaTipo').value = tipo;
  document.getElementById('modalCajaTitle').textContent = tipo === 'cobro' ? '+ Nuevo cobro' : '+ Nuevo pago';
  document.getElementById('btnGuardarCaja').style.background = tipo === 'cobro' ? 'var(--accent)' : 'var(--red)';
  ['cajaConcepto','cajaCliente','cajaImporte'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('cajaFormaPago').value = 'efectivo';
  document.getElementById('modalCaja').classList.add('active');
  setTimeout(() => document.getElementById('cajaConcepto').focus(), 100);
}

async function guardarMovimiento() {
  const importe = parseFloat(document.getElementById('cajaImporte').value);
  if (!importe || importe <= 0) { showToast('El importe es obligatorio', 'warning'); return; }
  const data = {
    empresa_id: empresaId,
    fecha: cajaFecha,
    tipo: document.getElementById('cajaTipo').value,
    concepto: document.getElementById('cajaConcepto').value.trim(),
    cliente: document.getElementById('cajaCliente').value.trim(),
    importe,
    forma_pago: document.getElementById('cajaFormaPago').value
  };
  const btn = document.getElementById('btnGuardarCaja');
  btn.disabled = true;
  try {
    await api('caja', { method: 'POST', body: JSON.stringify(data) });
    cerrarModalId('modalCaja');
    await cargarCaja();
    showToast('Movimiento guardado', 'success');
  } catch { showToast('Error al guardar', 'error'); }
  finally { btn.disabled = false; }
}

async function eliminarMovimiento(id) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  try {
    await api('caja?id=eq.' + id, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
    await cargarCaja();
    showToast('Movimiento eliminado', 'warning');
  } catch { showToast('Error al eliminar', 'error'); }
}

function exportarCaja() {
  const d = new Date(cajaFecha + 'T12:00:00');
  const fechaLabel = d.toLocaleDateString('es-ES');
  const iconos = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', cartera: 'Cartera' };

  let filas = ['TIPO\tCONCEPTO\tCLIENTE/PROVEEDOR\tFORMA PAGO\tIMPORTE'];
  cajaData.forEach(m => {
    filas.push([m.tipo.toUpperCase(), m.concepto || '', m.cliente || '', iconos[m.forma_pago], (m.tipo === 'cobro' ? '' : '-') + parseFloat(m.importe).toFixed(2)].join('\t'));
  });

  // Totales
  const totalCobros = cajaData.filter(m => m.tipo === 'cobro').reduce((s, m) => s + parseFloat(m.importe), 0);
  const totalPagos = cajaData.filter(m => m.tipo === 'pago').reduce((s, m) => s + parseFloat(m.importe), 0);
  ['efectivo','tarjeta','transferencia','cartera'].forEach(f => {
    const t = cajaData.filter(m => m.forma_pago === f).reduce((s, m) => s + (m.tipo === 'cobro' ? 1 : -1) * parseFloat(m.importe), 0);
    filas.push(['', 'Total ' + iconos[f], '', '', (t >= 0 ? '+' : '') + t.toFixed(2)].join('\t'));
  });
  filas.push(['', 'TOTAL COBROS', '', '', '+' + totalCobros.toFixed(2)].join('\t'));
  filas.push(['', 'TOTAL PAGOS', '', '', '-' + totalPagos.toFixed(2)].join('\t'));
  filas.push(['', 'SALDO DEL DÍA', '', '', ((totalCobros - totalPagos) >= 0 ? '+' : '') + (totalCobros - totalPagos).toFixed(2)].join('\t'));
  const csv = filas.join('\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `caja_${cajaFecha}.xls`;
  a.click();
}

// ===== FORMATO FECHA DD/MM/AAAA =====
function formatFechaInput(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 8);
  if (v.length >= 5) v = v.slice(0,2) + '/' + v.slice(2,4) + '/' + v.slice(4);
  else if (v.length >= 3) v = v.slice(0,2) + '/' + v.slice(2);
  input.value = v;
}

// ===== RENOVACIÓN AUTOMÁTICA DE TOKEN =====
function iniciarRenovacionToken() {
  clearInterval(window._tokenInterval);
  // Renew token every 30 minutes
  window._tokenInterval = setInterval(async () => {
    if (!authToken) return;
    await renovarToken();
  }, 10 * 60 * 1000); // cada 10 minutos
}

window.addEventListener('scroll', () => {
  const btn = document.getElementById('scrollTopBtn');
  if (btn) btn.style.display = window.scrollY > 300 ? 'flex' : 'none';
});

// ===== ATAJOS DE TECLADO =====
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
    // Only intercept if app is visible and modal is not open
    const appVisible = document.getElementById('appScreen').style.display === 'block';
    const modalClosed = !document.getElementById('modalOverlay').classList.contains('active');
    if (appVisible && modalClosed) {
      e.preventDefault();
      e.stopPropagation();
      abrirModalNuevo();
    }
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    if (document.getElementById('modalOverlay').classList.contains('active')) {
      e.preventDefault();
      guardarPedido();
    }
  }
}, true);

// ===== GARANTÍAS =====
let garantiasData = [];
let garantiasTab = 'pendientes';
let editandoGarantiaId = null;
let proveedoresData = [];

async function cargarGarantias() {
  document.getElementById('garList').innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Cargando...</p></div>';
  try {
    const promises = [api(`garantias?empresa_id=eq.${empresaId}&order=created_at.desc`)];
    if (!proveedoresData.length) promises.push(api(`proveedores?empresa_id=eq.${empresaId}&order=nombre.asc`));
    const [r1, r2] = await Promise.all(promises);
    if (r1.ok) garantiasData = await r1.json();
    if (r2 && r2.ok) proveedoresData = await r2.json();
    renderGarantias();
  } catch(e) { showToast('Error cargando garantías', 'error'); }
}

function setGarantiasTab(tab) {
  garantiasTab = tab;
  const btnP = document.getElementById('garTabPendientes');
  const btnH = document.getElementById('garTabHistorial');
  if (btnP) { btnP.style.borderBottomColor = tab === 'pendientes' ? 'var(--accent)' : 'transparent'; btnP.style.color = tab === 'pendientes' ? 'var(--accent)' : 'var(--muted)'; btnP.style.fontWeight = tab === 'pendientes' ? '500' : 'normal'; }
  if (btnH) { btnH.style.borderBottomColor = tab === 'historial' ? 'var(--accent)' : 'transparent'; btnH.style.color = tab === 'historial' ? 'var(--accent)' : 'var(--muted)'; btnH.style.fontWeight = tab === 'historial' ? '500' : 'normal'; }
  renderGarantias();
}

function renderGarantias() {
  const pendientes = garantiasData.filter(g => g.estado === 'pendiente');
  const resueltas = garantiasData.filter(g => g.estado !== 'pendiente');
  document.getElementById('garTotal').textContent = garantiasData.length;
  document.getElementById('garPendientes').textContent = pendientes.length;
  document.getElementById('garAceptadas').textContent = garantiasData.filter(g => g.estado === 'aceptada').length;
  document.getElementById('garDenegadas').textContent = garantiasData.filter(g => g.estado === 'denegada').length;

  const lista = garantiasTab === 'pendientes' ? pendientes : resueltas;
  const container = document.getElementById('garList');

  if (!lista.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${garantiasTab === 'pendientes' ? '✓' : '📋'}</div><p>${garantiasTab === 'pendientes' ? 'Sin garantías pendientes' : 'El historial está vacío'}</p></div>`;
    return;
  }

  const provMap = Object.fromEntries(proveedoresData.map(p => [p.id, p.nombre]));

  container.innerHTML = `
    <div class="gar-wrap">
      <div class="gar-thead">
        <span>Fecha</span><span>Pieza</span><span>Cliente / Matrícula</span><span>Proveedor</span><span>Estado</span><span>Acciones</span>
      </div>
      ${lista.map(g => {
        const proveedor = g.proveedor_id ? (provMap[g.proveedor_id] || '—') : '—';
        const fecha = g.fecha_devolucion ? new Date(g.fecha_devolucion + 'T12:00:00').toLocaleDateString('es-ES', {day:'2-digit',month:'short',year:'numeric'}) : '—';
        const acciones = g.estado === 'pendiente'
          ? `<button class="gar-btn aceptar" onclick="resolverGarantia('${g.id}','aceptada')">✓ Aceptar</button>
             <button class="gar-btn denegar" onclick="resolverGarantia('${g.id}','denegada')">✕ Denegar</button>
             <button class="gar-btn editar" onclick="abrirModalGarantia('${g.id}')">✏</button>`
          : `<button class="gar-btn editar" onclick="abrirModalGarantia('${g.id}')">✏ Editar</button>
             <button class="gar-btn denegar" onclick="eliminarGarantia('${g.id}')">✕</button>`;
        return `<div class="gar-row">
          <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--muted)">${fecha}</span>
          <div>
            <div style="font-size:13px;font-weight:500;color:var(--text)">${g.pieza_desc || '—'}</div>
            ${g.pieza_ref ? `<div style="font-size:10px;color:var(--accent);font-family:'DM Mono',monospace">${g.pieza_ref}</div>` : ''}
            ${g.observaciones ? `<div style="font-size:11px;color:var(--muted);font-style:italic;margin-top:1px">${g.observaciones}</div>` : ''}
          </div>
          <div>
            <div style="font-size:13px;color:var(--text)">${g.cliente || '—'}</div>
            ${g.matricula ? `<span style="font-family:'DM Mono',monospace;font-size:10px;background:var(--surface2);border:1px solid var(--border2);padding:1px 6px;border-radius:4px;color:var(--accent)">${g.matricula}</span>` : ''}
            ${g.vehiculo ? `<div style="font-size:11px;color:var(--muted);margin-top:1px">${g.vehiculo}</div>` : ''}
          </div>
          <span style="font-size:12px;color:var(--text)">${proveedor}</span>
          <span class="gar-estado ${g.estado}">${g.estado.charAt(0).toUpperCase()+g.estado.slice(1)}</span>
          <div class="gar-actions">${acciones}</div>
        </div>`;
      }).join('')}
    </div>`;
}

function abrirModalGarantia(id) {
  editandoGarantiaId = id || null;
  document.getElementById('garModalTitle').textContent = id ? 'Editar garantía' : 'Nueva garantía';
  const g = id ? garantiasData.find(x => x.id === id) : null;
  document.getElementById('garPiezaDesc').value = g?.pieza_desc || '';
  document.getElementById('garPiezaRef').value = g?.pieza_ref || '';
  document.getElementById('garFecha').value = g?.fecha_devolucion || new Date().toISOString().slice(0,10);
  document.getElementById('garFechaCompra').value = g?.fecha_compra || '';
  document.getElementById('garMatricula').value = g?.matricula || '';
  document.getElementById('garCliente').value = g?.cliente || '';
  document.getElementById('garVehiculo').value = g?.vehiculo || '';
  document.getElementById('garObs').value = g?.observaciones || '';
  // Populate proveedor datalist and set current value
  const dl = document.getElementById('garProveedorList');
  dl.innerHTML = proveedoresData.map(p => `<option value="${p.nombre}">`).join('');
  const provNombre = g?.proveedor_id ? (proveedoresData.find(p => p.id === g.proveedor_id)?.nombre || '') : '';
  document.getElementById('garProveedor').value = provNombre;
  document.getElementById('garModalOverlay').classList.add('active');
  setTimeout(() => document.getElementById('garMatricula').focus(), 50);
}

function cerrarModalGarantia() {
  document.getElementById('garModalOverlay').classList.remove('active');
  document.getElementById('garMatList').style.display = 'none';
  editandoGarantiaId = null;
}

async function guardarGarantia() {
  const desc = document.getElementById('garPiezaDesc').value.trim();
  if (!desc) { showToast('La descripción de la pieza es obligatoria', 'error'); return; }
  const data = {
    pieza_desc: desc,
    pieza_ref: document.getElementById('garPiezaRef').value.trim() || null,
    fecha_devolucion: document.getElementById('garFecha').value,
    fecha_compra: document.getElementById('garFechaCompra').value || null,
    matricula: document.getElementById('garMatricula').value.trim().toUpperCase() || null,
    cliente: document.getElementById('garCliente').value.trim() || null,
    vehiculo: document.getElementById('garVehiculo').value.trim() || null,
    proveedor_id: proveedoresData.find(p => p.nombre.toLowerCase() === document.getElementById('garProveedor').value.trim().toLowerCase())?.id || null,
    observaciones: document.getElementById('garObs').value.trim() || null
  };
  const btn = document.getElementById('garSaveBtn');
  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    if (editandoGarantiaId) {
      await api(`garantias?id=eq.${editandoGarantiaId}`, { method: 'PATCH', body: JSON.stringify(data) });
    } else {
      await api('garantias', { method: 'POST', body: JSON.stringify({ ...data, empresa_id: empresaId }) });
    }
    await cargarGarantias();
    cerrarModalGarantia();
    showToast(editandoGarantiaId ? 'Garantía actualizada' : 'Garantía registrada', 'success');
  } catch(e) {
    showToast('Error al guardar', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

async function resolverGarantia(id, estado) {
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    await api(`garantias?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ estado, fecha_resolucion: hoy }) });
    const idx = garantiasData.findIndex(g => g.id === id);
    if (idx !== -1) garantiasData[idx] = { ...garantiasData[idx], estado, fecha_resolucion: hoy };
    renderGarantias();
    showToast(estado === 'aceptada' ? '✓ Garantía aceptada' : 'Garantía denegada', estado === 'aceptada' ? 'success' : 'warning');
  } catch(e) { showToast('Error al actualizar', 'error'); }
}

async function eliminarGarantia(id) {
  if (!confirm('¿Eliminar esta garantía?')) return;
  try {
    await api(`garantias?id=eq.${id}`, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
    garantiasData = garantiasData.filter(g => g.id !== id);
    renderGarantias();
    showToast('Garantía eliminada', 'warning');
  } catch(e) { showToast('Error al eliminar', 'error'); }
}

// ===== DASHBOARD =====
async function renderDashboard() {
  const el = document.getElementById('viewDashboard');
  if (!el) return;
  // Solo mostrar spinner si el panel está vacío (primera carga)
  if (!el.innerHTML.trim()) {
    el.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Cargando dashboard...</p></div>';
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const ahora = new Date();
  const diaSemana = ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const diaCapital = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);

  // Pedidos stats (datos ya en memoria)
  const pedidosActivos = pedidos.filter(p => estadoCliente(p) !== 'listo');
  const pedidosHoy = pedidos.filter(p => p.created_at && p.created_at.slice(0, 10) === hoy);
  const piezasPendientes = pedidos.reduce((s, p) => s + (p.piezas || []).filter(x => !x.llegada).length, 0);

  // Vacaciones — todas las que no han terminado, orden cronológico (sin filtro de estado)
  let vacsProximas = [];
  try {
    const hoyVac = new Date().toISOString().slice(0,10);
    // Siempre recargar para tener datos frescos en el dashboard
    const [rT, rV] = await Promise.all([
      api(`trabajadores?empresa_id=eq.${empresaId}&order=nombre.asc`),
      api(`vacaciones?empresa_id=eq.${empresaId}&order=fecha_inicio.asc`)
    ]);
    if (rT.ok) trabajadoresData = await rT.json();
    if (rV.ok) vacacionesData = await rV.json();
    vacsProximas = vacacionesData
      .filter(v => v.fecha_fin >= hoyVac)
      .sort((a,b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
  } catch(e) { console.warn('Error cargando vacaciones en dashboard:', e); }

  // Agenda hoy
  let citasHoy = [];
  if (modulos.agenda && empresaId) {
    try {
      const r = await api(`agenda?fecha=eq.${hoy}&empresa_id=eq.${empresaId}&order=hora.asc`);
      if (r.ok) citasHoy = await r.json();
    } catch(e) {}
  }

  // Caja hoy
  let cobrosHoy = 0, pagosHoy = 0;
  if (modulos.caja && empresaId) {
    try {
      const r = await api(`caja?fecha=eq.${hoy}&empresa_id=eq.${empresaId}`);
      if (r.ok) {
        const mov = await r.json();
        cobrosHoy = mov.filter(m => m.tipo === 'cobro').reduce((s, m) => s + parseFloat(m.importe || 0), 0);
        pagosHoy = mov.filter(m => m.tipo === 'pago').reduce((s, m) => s + parseFloat(m.importe || 0), 0);
      }
    } catch(e) {}
  }

  // ITV pendientes
  let itvPendientes = [];
  if (modulos.itv && empresaId) {
    try {
      const r = await api(`itv?estado=eq.pendiente&empresa_id=eq.${empresaId}&order=fecha.asc`);
      if (r.ok) itvPendientes = await r.json();
    } catch(e) {}
  }

  // Garantías pendientes (reusa array en memoria si ya está cargado)
  let garPend = [];
  try {
    if (!garantiasData.length) {
      const r = await api(`garantias?empresa_id=eq.${empresaId}&order=created_at.desc`);
      if (r.ok) garantiasData = await r.json();
    }
    garPend = garantiasData.filter(g => g.estado === 'pendiente');
  } catch(e) {}

  // KPI cards
  const kpiHTML = `
    <div class="stats-row" style="margin-bottom:24px">
      <div class="stat-card s-pending">
        <div class="stat-number">${pedidosActivos.length}</div>
        <div class="stat-label">Pedidos pendientes</div>
      </div>
      <div class="stat-card s-waiting">
        <div class="stat-number">${itvPendientes.length}</div>
        <div class="stat-label">ITV pendientes</div>
      </div>
      <div class="stat-card s-ok">
        <div class="stat-number">${garPend.length}</div>
        <div class="stat-label">Garantías pendientes</div>
      </div>
      ${modulos.agenda ? `
      <div class="stat-card">
        <div class="stat-number" style="color:var(--accent)">${citasHoy.length}</div>
        <div class="stat-label">Citas hoy</div>
      </div>` : ''}
      ${modulos.caja ? `
      <div class="stat-card">
        <div class="stat-number" style="color:var(--green);font-size:${cobrosHoy >= 1000 ? '18px' : '24px'};padding-top:2px">${cobrosHoy.toFixed(2)} €</div>
        <div class="stat-label">Cobros hoy</div>
      </div>` : ''}
    </div>`;

  // Panel 1: Pedidos pendientes
  const urgentes = pedidosActivos.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).slice(0, 8);
  const panelPedidosHTML = `
    <div class="dash-panel">
      <div class="dash-panel-title">
        <span>Pedidos pendientes${urgentes.length ? ` <span style="color:var(--yellow)">(${pedidosActivos.length})</span>` : ''}</span>
        <button class="btn-ghost" style="padding:4px 10px;font-size:11px" onclick="setTab('clientes')">Ver todos →</button>
      </div>
      ${urgentes.length ? urgentes.map(p => {
        const pend = (p.piezas || []).filter(x => !x.llegada).length;
        const total = (p.piezas || []).length;
        const est = estadoCliente(p);
        return `
        <div class="dash-item" style="cursor:pointer" onclick="setTab('clientes')">
          <span class="status-dot ${est}" style="flex-shrink:0"></span>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.cliente || '—'}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:1px">${p.vehiculo || ''}${p.matricula ? ' · <span style="font-family:\'DM Mono\',monospace;color:var(--accent)">' + p.matricula + '</span>' : ''}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:12px;color:var(--yellow)">${pend} pend.</div>
            <div style="font-size:10px;color:var(--faint)">de ${total}</div>
          </div>
        </div>`;
      }).join('') : `<div style="padding:24px;text-align:center;color:var(--green);font-size:13px">✓ Sin pedidos pendientes</div>`}
    </div>`;

  // Panel 2: ITV pendientes
  const panelItvHTML = modulos.itv ? `
    <div class="dash-panel">
      <div class="dash-panel-title">
        <span>ITV pendientes${itvPendientes.length ? ` <span style="color:var(--yellow)">(${itvPendientes.length})</span>` : ''}</span>
        <button class="btn-ghost" style="padding:4px 10px;font-size:11px" onclick="setTab('itv')">Ver todas →</button>
      </div>
      ${itvPendientes.length ? itvPendientes.slice(0, 8).map(i => `
        <div class="dash-item">
          <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);flex-shrink:0;min-width:72px">${i.fecha || '—'}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;color:var(--text)">${i.cliente || '—'}</div>
            <div style="font-size:11px;color:var(--muted)">${[i.matricula, i.vehiculo].filter(Boolean).join(' · ')}</div>
          </div>
        </div>`).join('')
      : `<div style="padding:24px;text-align:center;color:var(--green);font-size:13px">✓ Sin ITV pendientes</div>`}
    </div>` : '';

  // Panel 3: Garantías pendientes
  const panelGarantiasHTML = `
    <div class="dash-panel">
      <div class="dash-panel-title">
        <span>Garantías pendientes${garPend.length ? ` <span style="color:var(--yellow)">(${garPend.length})</span>` : ''}</span>
        <button class="btn-ghost" style="padding:4px 10px;font-size:11px" onclick="setTab('garantias')">Ver todas →</button>
      </div>
      ${garPend.length ? garPend.slice(0, 8).map(g => {
        const prov = proveedoresData.find(p => p.id === g.proveedor_id);
        const dias = g.fecha_devolucion ? Math.floor((new Date() - new Date(g.fecha_devolucion)) / 86400000) : null;
        return `
        <div class="dash-item">
          <span style="width:8px;height:8px;border-radius:50%;background:var(--yellow);flex-shrink:0;box-shadow:0 0 5px var(--yellow)"></span>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${g.pieza_desc}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:1px">
              ${g.matricula ? `<span style="font-family:'DM Mono',monospace;color:var(--accent)">${g.matricula}</span>` : ''}
              ${g.matricula && prov ? ' · ' : ''}${prov ? prov.nombre : ''}
            </div>
          </div>
          ${dias !== null ? `<div style="flex-shrink:0;font-size:11px;color:${dias > 14 ? 'var(--red)' : 'var(--muted)'}">${dias}d</div>` : ''}
        </div>`;
      }).join('')
      : `<div style="padding:24px;text-align:center;color:var(--green);font-size:13px">✓ Sin garantías pendientes</div>`}
    </div>`;

  // Panel 4: Citas hoy
  const panelAgendaHTML = modulos.agenda ? `
    <div class="dash-panel">
      <div class="dash-panel-title">
        <span>Citas hoy${citasHoy.length ? ` <span style="color:var(--accent)">(${citasHoy.length})</span>` : ''}</span>
        <button class="btn-ghost" style="padding:4px 10px;font-size:11px" onclick="setTab('agenda')">Ver mes →</button>
      </div>
      ${citasHoy.length ? citasHoy.map(c => `
        <div class="dash-item">
          ${c.hora ? `<span style="font-family:'DM Mono',monospace;font-size:13px;color:var(--accent);flex-shrink:0;min-width:40px">${c.hora.slice(0,5)}</span>` : ''}
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.cliente || '—'}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:1px">${[c.vehiculo, c.matricula].filter(Boolean).join(' · ')}</div>
            ${c.trabajos ? `<div style="font-size:11px;color:var(--muted);font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.trabajos}</div>` : ''}
          </div>
        </div>`).join('')
      : `<div style="padding:24px;text-align:center;color:var(--muted);font-size:13px">Sin citas para hoy</div>`}
    </div>` : '';

  // Panel Vacaciones (siempre visible)
  const hoyStr = new Date().toISOString().slice(0,10);
  const tipoIconDash = { vacaciones: '🏖️', baja: '🤒', permiso: '📋' };
  const panelVacacionesHTML = `
    <div class="dash-panel">
      <div class="dash-panel-title">
        <span>🏖️ Vacaciones${vacsProximas.length ? ` <span style="color:var(--accent)">(${vacsProximas.length})</span>` : ''}</span>
        <button class="btn-ghost" style="padding:4px 10px;font-size:11px" onclick="setTab('vacaciones')">Ver todas →</button>
      </div>
      ${vacsProximas.length ? vacsProximas.map(v => {
        const t       = trabajadoresData.find(x => x.id === v.trabajador_id);
        const color   = t?.color || '#4caf82';
        const activa  = v.fecha_inicio <= hoyStr && v.fecha_fin >= hoyStr;
        const futura  = v.fecha_inicio > hoyStr;
        const dInicio = futura ? Math.ceil((new Date(v.fecha_inicio) - new Date()) / 86400000) : 0;
        const dFin    = activa ? Math.ceil((new Date(v.fecha_fin)   - new Date()) / 86400000) : 0;
        return '<div class="dash-item">'
          + `<span style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;margin-top:2px"></span>`
          + '<div style="flex:1;min-width:0">'
          + `<div style="font-size:13px;font-weight:500">${t?.nombre || 'Desconocido'}</div>`
          + `<div style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace">${v.fecha_inicio} → ${v.fecha_fin}</div>`
          + '</div>'
          + (activa
            ? `<span style="font-size:10px;background:${color};color:#fff;padding:1px 7px;border-radius:8px;font-weight:600;white-space:nowrap;flex-shrink:0">EN CURSO · ${dFin}d</span>`
            : `<span style="font-size:12px;color:${color};font-weight:600;flex-shrink:0;white-space:nowrap">en ${dInicio}d</span>`)
          + '</div>';
      }).join('') : '<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">Sin vacaciones próximas</div>'}
    </div>`;

  el.innerHTML = `
    <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:20px">
      <h2 style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700">${empresaNombre}</h2>
      <span style="font-size:13px;color:var(--muted)">${diaCapital}</span>
    </div>
    ${kpiHTML}
    <div class="dash-grid">
      ${panelPedidosHTML}
      ${panelItvHTML}
      ${panelGarantiasHTML}
      ${panelAgendaHTML}
      ${panelVacacionesHTML}
    </div>`;
}

// ===== FICHA CLIENTE =====
function abrirFichaCliente(matricula) {
  if (!matricula || matricula === '—') return;
  const clienteInfo = clientesDB.find(c => c.matricula === matricula);
  const historial = pedidos
    .filter(p => p.matricula === matricula)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const nombre = clienteInfo?.cliente || historial[0]?.cliente || '—';
  const vehiculo = clienteInfo?.vehiculo || historial[0]?.vehiculo || '—';

  const fichaPhone = clienteInfo?.telefono || '';
  document.getElementById('fichaTitulo').innerHTML =
    `${nombre} <span class="matricula" style="font-size:13px;vertical-align:middle">${matricula}</span>`;
  document.getElementById('fichaVehiculo').innerHTML = vehiculo +
    (fichaPhone ? ` · <span style="font-size:12px;color:var(--muted)">📞 ${fichaPhone}</span>` : '');

  const totalPiezas = historial.reduce((s, p) => s + (p.piezas || []).length, 0);
  const piezasLlegadas = historial.reduce((s, p) => s + (p.piezas || []).filter(x => x.llegada).length, 0);
  const ultimaVisita = historial.length ? new Date(historial[0].created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const body = document.getElementById('fichaBody');

  if (!historial.length) {
    body.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><p>Sin pedidos registrados para esta matrícula</p></div>';
  } else {
    body.innerHTML = `
      <div class="ficha-stats">
        <div class="ficha-stat">
          <div class="ficha-stat-num" style="color:var(--accent)">${historial.length}</div>
          <div class="ficha-stat-label">Pedidos</div>
        </div>
        <div class="ficha-stat">
          <div class="ficha-stat-num" style="color:var(--blue)">${totalPiezas}</div>
          <div class="ficha-stat-label">Piezas total</div>
        </div>
        <div class="ficha-stat">
          <div class="ficha-stat-num" style="color:var(--green)">${piezasLlegadas}</div>
          <div class="ficha-stat-label">Llegadas</div>
        </div>
        <div class="ficha-stat">
          <div class="ficha-stat-num" style="color:var(--muted);font-size:13px;padding-top:4px">${ultimaVisita}</div>
          <div class="ficha-stat-label">Último pedido</div>
        </div>
      </div>
      <div class="ficha-section-title">Historial de pedidos</div>
      ${historial.map(p => {
        const est = estadoCliente(p);
        const piezas = p.piezas || [];
        const llegadas = piezas.filter(x => x.llegada).length;
        const colorEst = est === 'listo' ? 'var(--green)' : est === 'pendiente' ? 'var(--blue)' : 'var(--yellow)';
        const fecha = p.created_at ? new Date(p.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
        return `
          <div class="ficha-pedido">
            <div class="ficha-pedido-header">
              <span class="status-dot ${est}"></span>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:500;color:var(--text)">${fecha}</div>
                <div style="font-size:11px;color:var(--muted);margin-top:1px">
                  ${llegadas}/${piezas.length} piezas ·
                  <span style="color:${colorEst}">${labelEstado(est)}</span>
                </div>
              </div>
            </div>
            ${piezas.length ? `
            <div class="ficha-pedido-piezas">
              ${piezas.map(x => `
                <div class="ficha-pieza-row">
                  <span style="width:6px;height:6px;border-radius:50%;background:${x.llegada ? 'var(--green)' : 'var(--yellow)'};flex-shrink:0"></span>
                  <span style="font-size:12px;color:var(--text);flex:1">${x.desc || '—'}</span>
                  ${x.ref ? `<span style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace">${x.ref}</span>` : ''}
                </div>`).join('')}
            </div>` : ''}
          </div>`;
      }).join('')}
    `;
  }

  document.getElementById('fichaOverlay').classList.add('active');
}

function cerrarFicha() {
  document.getElementById('fichaOverlay').classList.remove('active');
}


// ===== VACACIONES =====
let trabajadoresData  = [];
let vacacionesData    = [];
let configVac         = null;   // { id, dias_anuales, tipo_dias, dias_laborales: number[] }
let anioVacActivo     = new Date().getFullYear();
let editandoVacId     = null;
let editandoTrabId    = null;
let adjudicandoTrabId = null;

// ── Contar días (laborales o naturales) entre dos fechas (inclusive) ─────────
function contarDiasVac(inicio, fin) {
  if (!inicio || !fin) return 0;
  const s = new Date(inicio + 'T00:00:00');
  const e = new Date(fin   + 'T00:00:00');
  if (e < s) return 0;
  if (!configVac || configVac.tipo_dias === 'naturales') {
    return Math.round((e - s) / 86400000) + 1;
  }
  // Laborales: contar solo los días configurados como laborales
  const lab = new Set((configVac.dias_laborales || [1,2,3,4,5]).map(Number));
  let n = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const dow = cur.getDay(); // JS: 0=Dom, 1=Lun … 6=Sáb
    if (lab.has(dow === 0 ? 7 : dow)) n++; // normalizar: 7=Dom
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

// ── Días usados por un trabajador en un año concreto ────────────────────────
function diasUsadosAnio(trabId, anio) {
  return vacacionesData
    .filter(v => v.trabajador_id === trabId && v.fecha_inicio.startsWith(String(anio)))
    .reduce((s, v) => s + contarDiasVac(v.fecha_inicio, v.fecha_fin), 0);
}

// ── Carga de datos ───────────────────────────────────────────────────────────
async function cargarVacaciones() {
  if (!empresaId) return;
  try {
    const [rC, rT, rV] = await Promise.all([
      api(`configuracion_vacaciones?empresa_id=eq.${empresaId}&limit=1`),
      api(`trabajadores?empresa_id=eq.${empresaId}&order=nombre.asc`),
      api(`vacaciones?empresa_id=eq.${empresaId}&order=fecha_inicio.asc`)
    ]);
    if (rC.ok) {
      const arr = await rC.json();
      configVac = arr[0]
        ? { ...arr[0], dias_laborales: arr[0].dias_laborales.split(',').map(Number) }
        : null;
    }
    if (rT.ok) trabajadoresData = await rT.json();
    if (rV.ok) vacacionesData   = await rV.json();
    renderVacaciones();
  } catch(e) { console.error('cargarVacaciones:', e); }
}

// ── Render principal ─────────────────────────────────────────────────────────
function renderVacaciones() {
  const lbl = document.getElementById('anioVacLabel');
  if (lbl) lbl.textContent = anioVacActivo;
  const warn = document.getElementById('vacConfigWarning');
  if (warn) warn.style.display = configVac ? 'none' : 'flex';
  const btnAdd = document.getElementById('btnAddTrabajador');
  if (btnAdd) btnAdd.disabled = !configVac;
  renderWorkersVac();
  renderVacCronologicas();
  renderVacDisfrutadas();
}

// ── Lista de trabajadores — filas horizontales compactas ────────────────────
function renderWorkersVac() {
  const el = document.getElementById('vacacionesList');
  if (!el) return;
  if (!trabajadoresData.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👷</div><p>${configVac ? 'No hay trabajadores. Añade el primero.' : 'Configura primero la política vacacional.'}</p></div>`;
    return;
  }
  const tipoLbl = configVac
    ? (configVac.tipo_dias === 'laborales' ? 'días lab.' : 'días nat.')
    : '';
  let html = '';
  trabajadoresData.forEach(t => {
    const color   = t.color || '#4caf82';
    const usados  = configVac ? diasUsadosAnio(t.id, anioVacActivo) : 0;
    const total   = configVac ? configVac.dias_anuales : 0;
    const dispon  = configVac ? Math.max(0, total - usados) : null;
    const pct     = (configVac && total > 0) ? Math.min(100, Math.round(usados / total * 100)) : 0;
    const agotado = configVac && dispon === 0;
    html += `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:${configVac ? '8px' : '0'}">
        <span style="width:11px;height:11px;border-radius:50%;background:${color};flex-shrink:0"></span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.nombre}</div>
          ${t.puesto ? `<div style="font-size:11px;color:var(--muted)">${t.puesto}</div>` : ''}
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0;flex-wrap:wrap">
          <button class="btn-ghost" style="padding:4px 9px;font-size:11px" onclick="abrirHistorialTrabajador('${t.id}')">Historial</button>
          <button class="btn-ghost" style="padding:4px 9px;font-size:11px" onclick="abrirModalTrabajador('${t.id}')">✏</button>
          ${configVac && !agotado ? `<button class="btn-primary" style="padding:4px 10px;font-size:11px" onclick="abrirAdjudicarVac('${t.id}')">+ Adjudicar</button>` : ''}
          <button class="btn-ghost" style="padding:4px 8px;font-size:11px;color:var(--red);border-color:var(--red)" onclick="eliminarTrabajador('${t.id}')">×</button>
        </div>
      </div>
      ${configVac ? `
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px;display:flex;justify-content:space-between">
        <span>${usados} / ${total} ${tipoLbl}</span>
        <span style="font-weight:600;color:${agotado ? 'var(--red)' : 'var(--accent)'}">${agotado ? 'Sin días' : dispon + ' disp.'}</span>
      </div>
      <div style="height:4px;background:var(--border2);border-radius:2px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${agotado ? 'var(--red)' : color};border-radius:2px;transition:width 0.3s"></div>
      </div>` : ''}
    </div>`;
  });
  el.innerHTML = html;
}

// ── Tarjeta de vacación reutilizable ────────────────────────────────────────
function _cardVac(v, opts = {}) {
  const { editable = true } = opts;
  const t      = trabajadoresData.find(x => x.id === v.trabajador_id);
  const color  = t?.color || '#4caf82';
  const dias   = contarDiasVac(v.fecha_inicio, v.fecha_fin);
  const tLbl   = configVac ? (configVac.tipo_dias === 'laborales' ? 'lab.' : 'nat.') : '';
  const hoy    = new Date().toISOString().slice(0, 10);
  const activa = v.fecha_inicio <= hoy && v.fecha_fin >= hoy;
  const futura = v.fecha_inicio > hoy;
  const dInicio = futura ? Math.ceil((new Date(v.fecha_inicio) - new Date()) / 86400000) : 0;
  const dFin    = activa ? Math.ceil((new Date(v.fecha_fin)   - new Date()) / 86400000) : 0;
  return `
  <div style="background:var(--surface);border:1px solid ${activa ? color : 'var(--border)'};border-radius:8px;padding:10px 12px;margin-bottom:8px${activa ? ';box-shadow:0 0 0 1px '+color+'22' : ''}">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <span style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></span>
      <span style="font-size:13px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t?.nombre || 'Desconocido'}</span>
      ${activa ? `<span style="font-size:10px;background:${color};color:#fff;padding:1px 7px;border-radius:6px;font-weight:600;white-space:nowrap">EN CURSO</span>` : ''}
      ${futura ? `<span style="font-size:11px;color:${color};font-weight:600;white-space:nowrap">en ${dInicio}d</span>` : ''}
      ${editable ? `
        <button class="btn-ghost" style="padding:2px 7px;font-size:11px;flex-shrink:0" onclick="abrirAdjudicarVac('${v.trabajador_id}','${v.id}')">✏</button>
        <button class="btn-ghost" style="padding:2px 7px;font-size:11px;color:var(--red);flex-shrink:0" onclick="eliminarVacacion('${v.id}')">×</button>
      ` : ''}
    </div>
    <div style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;padding-left:18px">${v.fecha_inicio} → ${v.fecha_fin}${dias ? ` · ${dias} ${tLbl}` : ''}${activa ? ` · ${dFin}d restantes` : ''}</div>
    ${v.notas ? `<div style="font-size:11px;color:var(--muted);font-style:italic;padding-left:18px;margin-top:2px">${v.notas}</div>` : ''}
  </div>`;
}

// ── Vacaciones asignadas (futuras + en curso) ───────────────────────────────
function renderVacCronologicas() {
  const el = document.getElementById('vacacionesAsignadasList');
  if (!el) return;
  const hoy = new Date().toISOString().slice(0, 10);
  const vacs = vacacionesData
    .filter(v => v.fecha_fin >= hoy && (
      parseInt(v.fecha_inicio.slice(0, 4)) === anioVacActivo ||
      parseInt(v.fecha_fin.slice(0, 4))   === anioVacActivo
    ))
    .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
  if (!vacs.length) {
    el.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">Sin vacaciones pendientes en ${anioVacActivo}</div>`;
    return;
  }
  el.innerHTML = vacs.map(v => _cardVac(v)).join('');
}

// ── Vacaciones disfrutadas (ya terminadas, año activo) ──────────────────────
function renderVacDisfrutadas() {
  const el = document.getElementById('vacacionesDisfrutadasList');
  if (!el) return;
  const hoy = new Date().toISOString().slice(0, 10);
  const vacs = vacacionesData
    .filter(v => v.fecha_fin < hoy && (
      parseInt(v.fecha_inicio.slice(0, 4)) === anioVacActivo ||
      parseInt(v.fecha_fin.slice(0, 4))   === anioVacActivo
    ))
    .sort((a, b) => b.fecha_fin.localeCompare(a.fecha_fin)); // más recientes primero
  if (!vacs.length) {
    el.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">Sin vacaciones disfrutadas en ${anioVacActivo}</div>`;
    return;
  }
  el.innerHTML = vacs.map(v => _cardVac(v, { editable: false })).join('');
}

// ── Historial completo de un trabajador ────────────────────────────────────
function abrirHistorialTrabajador(trabId) {
  const t = trabajadoresData.find(x => x.id === trabId);
  if (!t) return;
  const hoy  = new Date().toISOString().slice(0, 10);
  const tLbl = configVac ? (configVac.tipo_dias === 'laborales' ? 'días lab.' : 'días nat.') : 'días';
  const vacs = vacacionesData
    .filter(v => v.trabajador_id === trabId)
    .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio));
  // Agrupar por año
  const byYear = {};
  vacs.forEach(v => {
    const y = v.fecha_inicio.slice(0, 4);
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(v);
  });
  let html = '';
  if (!vacs.length) {
    html = `<p style="color:var(--muted);text-align:center;padding:20px 0">Sin vacaciones registradas</p>`;
  } else {
    html = Object.keys(byYear).sort((a, b) => b - a).map(year => {
      const items = byYear[year];
      const total = items.reduce((s, v) => s + contarDiasVac(v.fecha_inicio, v.fecha_fin), 0);
      const rows = items.map(v => {
        const dias   = contarDiasVac(v.fecha_inicio, v.fecha_fin);
        const activa = v.fecha_inicio <= hoy && v.fecha_fin >= hoy;
        const futura = v.fecha_inicio > hoy;
        return `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border2)">
          <span style="font-family:'DM Mono',monospace;font-size:12px;flex:1">${v.fecha_inicio} → ${v.fecha_fin}</span>
          <span style="font-size:12px;color:var(--muted);white-space:nowrap">${dias} ${tLbl}</span>
          ${activa ? `<span style="font-size:10px;background:var(--accent);color:#0f0f0f;padding:1px 7px;border-radius:4px;font-weight:700">EN CURSO</span>` : ''}
          ${futura ? `<span style="font-size:10px;color:var(--accent);font-weight:600">Pendiente</span>` : ''}
        </div>`;
      }).join('');
      return `
      <div style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;padding-bottom:6px;border-bottom:2px solid var(--border)">
          <span style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700">${year}</span>
          <span style="font-size:12px;color:var(--muted)">${total} ${tLbl}</span>
        </div>
        ${rows}
      </div>`;
    }).join('');
  }
  document.getElementById('modalHistorialTitle').textContent = `Historial — ${t.nombre}`;
  document.getElementById('modalHistorialContent').innerHTML = html;
  document.getElementById('modalHistorial').classList.add('active');
}

function cambiarAnioVac(delta) {
  anioVacActivo += delta;
  renderVacaciones();
}

// ── Modal: trabajador ────────────────────────────────────────────────────────
function abrirModalTrabajador(id) {
  editandoTrabId = id || null;
  document.getElementById('modalTrabajadorTitle').textContent = id ? 'Editar trabajador' : 'Nuevo trabajador';
  const colorInput = document.getElementById('trabColor');
  const colorLabel = document.getElementById('trabColorLabel');
  if (id) {
    const t = trabajadoresData.find(x => x.id === id);
    document.getElementById('trabNombre').value = t?.nombre || '';
    document.getElementById('trabPuesto').value = t?.puesto || '';
    if (colorInput) colorInput.value = t?.color || '#4caf82';
  } else {
    document.getElementById('trabNombre').value = '';
    document.getElementById('trabPuesto').value = '';
    if (colorInput) colorInput.value = '#4caf82';
  }
  if (colorInput && colorLabel) {
    colorLabel.textContent = colorInput.value;
    colorInput.oninput = () => { colorLabel.textContent = colorInput.value; };
  }
  document.getElementById('modalTrabajador').classList.add('active');
}

async function guardarTrabajador() {
  const nombre = document.getElementById('trabNombre').value.trim();
  if (!nombre) { showToast('El nombre es obligatorio', 'warning'); return; }
  const colorEl = document.getElementById('trabColor');
  const data = {
    nombre,
    puesto:     document.getElementById('trabPuesto').value.trim() || null,
    color:      colorEl ? colorEl.value : '#4caf82',
    empresa_id: empresaId
  };
  const btn = document.getElementById('btnGuardarTrabajador');
  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    if (editandoTrabId) {
      const r = await api(`trabajadores?id=eq.${editandoTrabId}`, { method: 'PATCH', body: JSON.stringify(data) });
      if (!r.ok) { const err = await r.json().catch(()=>{}); throw new Error(err?.message || 'Error al actualizar'); }
      const idx = trabajadoresData.findIndex(x => x.id === editandoTrabId);
      if (idx !== -1) trabajadoresData[idx] = { ...trabajadoresData[idx], ...data };
    } else {
      const r = await api('trabajadores', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(data) });
      if (!r.ok) { const err = await r.json().catch(()=>{}); throw new Error(err?.message || 'Error al crear trabajador'); }
      const arr = await r.json();
      if (arr[0]) trabajadoresData.push(arr[0]);
    }
    cerrarModalId('modalTrabajador');
    renderVacaciones();
    showToast('✓ Trabajador guardado', 'success');
  } catch(e) { showToast('Error: ' + (e.message || 'No se pudo guardar'), 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Guardar'; }
}

async function eliminarTrabajador(id) {
  if (!confirm('¿Eliminar este trabajador y todas sus vacaciones?')) return;
  try {
    await api(`vacaciones?trabajador_id=eq.${id}`, { method: 'DELETE' });
    await api(`trabajadores?id=eq.${id}`,          { method: 'DELETE' });
    trabajadoresData = trabajadoresData.filter(x => x.id !== id);
    vacacionesData   = vacacionesData.filter(x => x.trabajador_id !== id);
    renderVacaciones();
    showToast('Trabajador eliminado', 'warning');
  } catch { showToast('Error al eliminar', 'error'); }
}

// ── Modal: configuración vacacional ─────────────────────────────────────────
function abrirConfigVac() {
  document.getElementById('cfgDiasAnuales').value = configVac?.dias_anuales || 22;
  const tipo = configVac?.tipo_dias || 'laborales';
  document.querySelectorAll('input[name="cfgTipo"]').forEach(r => { r.checked = r.value === tipo; });
  const labs = configVac?.dias_laborales || [1, 2, 3, 4, 5];
  [1, 2, 3, 4, 5, 6, 7].forEach(d => {
    const cb = document.getElementById(`cfgDia${d}`);
    if (cb) cb.checked = labs.includes(d);
  });
  toggleCfgDiasLab();
  document.getElementById('modalConfigVac').classList.add('active');
}

function toggleCfgDiasLab() {
  const tipo = document.querySelector('input[name="cfgTipo"]:checked')?.value || 'laborales';
  const row  = document.getElementById('cfgDiasLabRow');
  if (row) row.style.display = tipo === 'laborales' ? 'block' : 'none';
}

async function guardarConfigVac() {
  const dias = parseInt(document.getElementById('cfgDiasAnuales').value);
  if (!dias || dias < 1 || dias > 365) { showToast('Indica un número de días válido (1-365)', 'warning'); return; }
  const tipo = document.querySelector('input[name="cfgTipo"]:checked')?.value || 'laborales';
  let diasLab = '1,2,3,4,5';
  if (tipo === 'laborales') {
    const sel = [1, 2, 3, 4, 5, 6, 7].filter(d => document.getElementById(`cfgDia${d}`)?.checked);
    if (!sel.length) { showToast('Selecciona al menos un día laboral', 'warning'); return; }
    diasLab = sel.join(',');
  }
  const data = { empresa_id: empresaId, dias_anuales: dias, tipo_dias: tipo, dias_laborales: diasLab };
  const btn  = document.getElementById('btnGuardarConfigVac');
  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    if (configVac?.id) {
      await api(`configuracion_vacaciones?id=eq.${configVac.id}`, { method: 'PATCH', body: JSON.stringify(data) });
    } else {
      const r = await api('configuracion_vacaciones', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(data) });
      if (r.ok) { const arr = await r.json(); if (arr[0]) data.id = arr[0].id; }
    }
    configVac = { ...data, dias_laborales: diasLab.split(',').map(Number) };
    cerrarModalId('modalConfigVac');
    renderVacaciones();
    showToast('✓ Configuración guardada', 'success');
  } catch { showToast('Error al guardar la configuración', 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Guardar configuración'; }
}

// ── Modal: adjudicar vacaciones ──────────────────────────────────────────────
function abrirAdjudicarVac(trabId, vacId) {
  adjudicandoTrabId = trabId;
  editandoVacId     = vacId || null;
  const t = trabajadoresData.find(x => x.id === trabId);
  document.getElementById('adjudicarTitle').textContent = `Vacaciones — ${t?.nombre || ''}`;
  const btnDel = document.getElementById('btnEliminarAdj');
  if (vacId) {
    const v = vacacionesData.find(x => x.id === vacId);
    document.getElementById('adjInicio').value = v?.fecha_inicio || '';
    document.getElementById('adjFin').value    = v?.fecha_fin    || '';
    document.getElementById('adjNotas').value  = v?.notas        || '';
    if (btnDel) btnDel.style.display = 'inline-block';
  } else {
    document.getElementById('adjInicio').value = '';
    document.getElementById('adjFin').value    = '';
    document.getElementById('adjNotas').value  = '';
    if (btnDel) btnDel.style.display = 'none';
  }
  actualizarResumenAdj();
  document.getElementById('modalAdjudicar').classList.add('active');
}

function actualizarResumenAdj() {
  const inicio  = document.getElementById('adjInicio').value;
  const fin     = document.getElementById('adjFin').value;
  const resumen = document.getElementById('adjResumen');
  const btnOk   = document.getElementById('btnGuardarAdj');
  if (!resumen) return;
  if (!inicio || !fin || fin < inicio || !configVac) {
    resumen.style.display = 'none';
    if (btnOk) btnOk.disabled = false;
    return;
  }
  const selAnio  = parseInt(inicio.slice(0, 4));
  const diasSel  = contarDiasVac(inicio, fin);
  let usadosBase = diasUsadosAnio(adjudicandoTrabId, selAnio);
  if (editandoVacId) {
    const v = vacacionesData.find(x => x.id === editandoVacId);
    if (v) usadosBase -= contarDiasVac(v.fecha_inicio, v.fecha_fin);
  }
  const disponibles = Math.max(0, configVac.dias_anuales - usadosBase);
  const excede      = diasSel > disponibles;
  const tipoLbl     = configVac.tipo_dias;
  resumen.style.display = 'block';
  resumen.innerHTML = `
    <div style="background:var(--surface2);border:1px solid ${excede ? 'var(--red)' : 'var(--border)'};border-radius:8px;padding:12px;font-size:12px;margin-top:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="color:var(--muted)">Días seleccionados:</span>
        <strong style="color:${excede ? 'var(--red)' : 'var(--text)'}">${diasSel} ${tipoLbl}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="color:var(--muted)">Usados en ${selAnio}:</span>
        <strong>${usadosBase} / ${configVac.dias_anuales}</strong>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--muted)">Días disponibles:</span>
        <strong style="color:${disponibles === 0 ? 'var(--red)' : 'var(--accent)'}">${disponibles}</strong>
      </div>
      ${excede ? `<div style="margin-top:8px;padding:6px 8px;background:var(--red-bg,#ffeaea);border-radius:6px;color:var(--red);font-weight:600;font-size:11px">⚠ Excede el límite — reduce los días seleccionados</div>` : ''}
    </div>`;
  if (btnOk) btnOk.disabled = excede;
}

async function guardarAdjudicacion() {
  const inicio = document.getElementById('adjInicio').value;
  const fin    = document.getElementById('adjFin').value;
  if (!inicio || !fin) { showToast('Indica fecha de inicio y fin', 'warning'); return; }
  if (fin < inicio)    { showToast('La fecha fin debe ser posterior al inicio', 'warning'); return; }
  const data = {
    trabajador_id: adjudicandoTrabId,
    tipo:          'vacaciones',
    estado:        'aprobada',
    fecha_inicio:  inicio,
    fecha_fin:     fin,
    notas:         document.getElementById('adjNotas').value.trim() || null,
    empresa_id:    empresaId
  };
  const btn = document.getElementById('btnGuardarAdj');
  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    if (editandoVacId) {
      const r = await api(`vacaciones?id=eq.${editandoVacId}`, { method: 'PATCH', body: JSON.stringify(data) });
      if (!r.ok) { const err = await r.json().catch(() => {}); throw new Error(err?.message || 'Error al actualizar'); }
    } else {
      const r = await api('vacaciones', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(data) });
      if (!r.ok) { const err = await r.json().catch(() => {}); throw new Error(err?.message || 'Error al guardar'); }
      const arr = await r.json();
      if (!arr?.length) throw new Error('Sin respuesta del servidor — comprueba los permisos RLS');
    }
    // Recargar desde BD para garantizar datos correctos
    const rV = await api(`vacaciones?empresa_id=eq.${empresaId}&order=fecha_inicio.asc`);
    if (rV.ok) vacacionesData = await rV.json();
    cerrarModalId('modalAdjudicar');
    renderVacaciones();
    showToast('✓ Vacaciones adjudicadas', 'success');
  } catch(e) { showToast('Error: ' + (e.message || 'No se pudo guardar'), 'error'); }
  finally { btn.disabled = false; btn.textContent = '✓ Confirmar vacaciones'; }
}

async function eliminarVacacion(id) {
  if (!confirm('¿Eliminar estas vacaciones?')) return;
  try {
    await api(`vacaciones?id=eq.${id}`, { method: 'DELETE' });
    vacacionesData = vacacionesData.filter(x => x.id !== id);
    cerrarModalId('modalAdjudicar');
    renderVacaciones();
    showToast('Vacaciones eliminadas', 'warning');
  } catch { showToast('Error al eliminar', 'error'); }
}

// ===== INIT =====
initTema();

// Restore session if exists
(async () => {
  const savedRefresh = sessionStorage.getItem('auth_refresh');
  const savedEmail = sessionStorage.getItem('auth_email');
  if (savedRefresh && savedEmail) {
    try {
      // Use refresh token to get a fresh access token
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: savedRefresh })
      });
      const data = await res.json();
      if (!res.ok || !data.access_token) throw new Error('Token expirado');
      authToken = data.access_token;
      sessionStorage.setItem('auth_token', authToken);
      sessionStorage.setItem('auth_refresh', data.refresh_token);
      document.getElementById('userEmail').textContent = savedEmail.split('@')[0];
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appScreen').style.display = 'block';
      try { await cargarEmpresa(); } catch(e) {}
      setTab('dashboard');
      cargarPedidos();
      cargarClientesDB();
      iniciarRefreshClientes();
      iniciarRenovacionToken();
    } catch(e) {
      // Token expired, show login
      sessionStorage.clear();
    }
  }
})();
