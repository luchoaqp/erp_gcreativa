import React, { useState, useEffect } from 'react';
import './App.css';
import './theme.css';
import UnsavedGuard from './components/UnsavedGuard';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Orders from './pages/Orders';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Expenses from './pages/Expenses';
import Catalogs from './pages/Catalogs';
import Workshop from './pages/Workshop';
import Kardex from './pages/Kardex';
import KardexValorizado from './pages/KardexValorizado';
import Shipments from './pages/Shipments';
import ReportCenter from './pages/ReportCenter';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Backup from './pages/Backup';
import Categories from './pages/Categories';
import Quotes from './pages/Quotes';
import UsersPage from './pages/Users';
import { applyTheme, applySidebar, sidebarFromSettings } from './utils/theme';
import { dashboardAPI, settingsAPI, authAPI } from './api';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [kardexFocus, setKardexFocus] = useState(null);
  const [salesSearch, setSalesSearch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [storeSettings, setStoreSettings] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('tema_tienda_regalos') === 'dark' ? 'dark' : 'light'; } catch (e) { return 'light'; }
  });
  const toggleTheme = () => setTheme((t) => {
    const next = t === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('tema_tienda_regalos', next); } catch (e) { /* sin guardado */ }
    return next;
  });

  useEffect(() => {
    const savedUser = localStorage.getItem('user_tienda_regalos');
    const token = localStorage.getItem('token_tienda_regalos');
    if (savedUser && token) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('user_tienda_regalos');
      }
    }
    setLoading(false);
  }, []);

  // Trae del servidor el nombre/permisos actuales (el usuario guardado en el navegador puede estar desactualizado)
  const refreshUser = async () => {
    try {
      const r = await authAPI.me();
      if (r.success && r.user) {
        setUser((prev) => {
          const next = { ...(prev || {}), ...r.user, permisos: r.user.permisos !== undefined ? r.user.permisos : prev?.permisos };
          try { localStorage.setItem('user_tienda_regalos', JSON.stringify(next)); } catch (e) { /* sin guardado */ }
          return next;
        });
      }
    } catch (e) { /* sin conexión: se mantiene el usuario guardado */ }
  };
  useEffect(() => { if (user && user.id) refreshUser(); }, [user && user.id]);

  const loadGlobalCounts = async () => {
    if (!user) return;
    try {
      const [dashRes, setRes] = await Promise.all([
        dashboardAPI.getStats(),
        settingsAPI.get()
      ]);
      if (dashRes.success) {
        setDashboardData(dashRes);
      }
      if (setRes.success && setRes.settings) {
        setStoreSettings(setRes.settings);
        applyTheme(setRes.settings.color_principal);
        applySidebar(sidebarFromSettings(setRes.settings));
      }
    } catch (err) {
      console.error('Error cargando conteos y configuración:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadGlobalCounts();
    }
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('token_tienda_regalos');
    localStorage.removeItem('user_tienda_regalos');
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#DCE8E5' }}>
        <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--primary)' }}>Cargando ERP Genia Creativa...</div>
      </div>
    );
  }

  // Si no ha iniciado sesión, mostrar pantalla Login
  if (!user) {
    return <Login onLoginSuccess={(loggedUser) => setUser(loggedUser)} />;
  }

  const counts = {
    pendingOrders: dashboardData?.stats?.pedidos_activos || 0, // pedidos no entregados (ni cancelados)
    lowStock: dashboardData?.stats?.stock_bajo_alertas || 0
  };

  return (
    <div className={`app-viewport ${theme === 'dark' ? 'theme-dark' : ''}`}>
      <UnsavedGuard />
      <div className="app-frame">
        {/* Menú Lateral con la curvatura exacta */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={(tab) => {
            setActiveTab(tab);
            loadGlobalCounts(); // refresca el número de pedidos pendientes
            setKardexFocus(null);
            setMobileMenuOpen(false);
          }} 
          user={user}
          onLogout={handleLogout}
          counts={counts}
          storeSettings={storeSettings}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Lienzo Principal */}
        <main className="main-canvas">
          <Topbar 
            user={user}
            onNewSale={() => {
              setActiveTab('pos');
              setMobileMenuOpen(false);
            }}
            urgentDeliveries={dashboardData?.entregas_hoy || []}
            lowStockCount={dashboardData?.stats?.stock_bajo_alertas || 0}
            onViewOrders={() => { setActiveTab('orders'); setMobileMenuOpen(false); }}
            onSearchSales={(q) => { setSalesSearch({ q, n: Date.now() }); setActiveTab('reports'); setMobileMenuOpen(false); }}
            onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
            theme={theme}
            onToggleTheme={toggleTheme}
          />

          {activeTab === 'dashboard' && (
            <Dashboard 
              user={user}
              onNavigateExpenses={() => setActiveTab('expenses')}
              onNavigateWorkshop={() => setActiveTab('workshop')}
              onNavigatePOS={() => setActiveTab('pos')}
              onNavigateOrders={() => setActiveTab('orders')}
              onNavigateCustomers={() => setActiveTab('customers')}
              onNavigateInventory={() => setActiveTab('inventory')}
              onNavigateReports={() => setActiveTab('reports')}
            />
          )}

          {activeTab === 'pos' && (
            <POS 
              user={user}
              onOrderCreated={() => {
                loadGlobalCounts();
                setActiveTab('reports'); // Ventas
              }}
            />
          )}

          {activeTab === 'quotes' && (
            <Quotes
              user={user}
              onConverted={() => {
                loadGlobalCounts();
                setActiveTab('reports'); // Ventas
              }}
            />
          )}

          {activeTab === 'orders' && <Orders user={user} />}

          {activeTab === 'inventory' && <Inventory />}

          {activeTab === 'categories' && <Categories />}

          {activeTab === 'kardex' && <Kardex focusProduct={kardexFocus} onClearFocus={() => setKardexFocus(null)} />}

          {activeTab === 'kardex_valorizado' && <KardexValorizado onOpenKardex={(id) => { setKardexFocus(id); setActiveTab('kardex'); }} />}

          {activeTab === 'shipments' && <Shipments />}

          {activeTab === 'reportes' && <ReportCenter onNavigate={(tab) => setActiveTab(tab)} />}

          {activeTab === 'customers' && <Customers user={user} />}

          {activeTab === 'suppliers' && <Suppliers user={user} />}

          {activeTab === 'purchases' && <Purchases user={user} />}
          {activeTab === 'expenses' && <Expenses user={user} />}
          {activeTab === 'catalogs' && <Catalogs user={user} />}
          {activeTab === 'workshop' && <Workshop user={user} />}

          {activeTab === 'reports' && <Reports user={user} initialSearch={salesSearch} onNavigatePOS={() => setActiveTab('pos')} />}

          {activeTab === 'users' && <UsersPage currentUser={user} onProfileChanged={refreshUser} />}

          {activeTab === 'settings' && <Settings onNavigateBackup={() => setActiveTab('backup')} onSaved={(st) => { setStoreSettings(st); applyTheme(st.color_principal); applySidebar(sidebarFromSettings(st)); }} />}

          {activeTab === 'backup' && <Backup />}
        </main>
      </div>
    </div>
  );
}
