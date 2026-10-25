import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, ShoppingBag, Truck, Gift, Users, BarChart3, Settings, Database,
  LogOut, Sparkles, PackageSearch, Coins, Send, FileBarChart, Store, ShoppingCart, X, Layers, ShieldCheck, FileText, Briefcase, Boxes, Wrench, ChevronDown, Wallet, BookOpen, Cog, PackageOpen
} from 'lucide-react';
import './sidebar-groups.css';

const ITEMS = {
  dashboard: { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  pos: { id: 'pos', label: 'Punto de Venta (POS)', icon: ShoppingBag, badge: 'POS' },
  quotes: { id: 'quotes', label: 'Cotizaciones', icon: FileText },
  purchases: { id: 'purchases', label: 'Compras', icon: ShoppingCart },
  expenses: { id: 'expenses', label: 'Gastos', icon: Wallet },
  orders: { id: 'orders', label: 'Pedidos', icon: Truck },
  reports: { id: 'reports', label: 'Ventas', icon: BarChart3 },
  inventory: { id: 'inventory', label: 'Productos', icon: Gift },
  catalogs: { id: 'catalogs', label: 'Catálogos', icon: BookOpen },
  workshop: { id: 'workshop', label: 'Taller', icon: Cog },
  kardex: { id: 'kardex', label: 'Kardex', icon: PackageSearch },
  kardex_valorizado: { id: 'kardex_valorizado', label: 'Kardex valorizado', icon: Coins },
  shipments: { id: 'shipments', label: 'Envíos', icon: Send },
  reportes: { id: 'reportes', label: 'Reportes', icon: FileBarChart },
  categories: { id: 'categories', label: 'Categorías', icon: Layers },
  customers: { id: 'customers', label: 'Clientes', icon: Users },
  suppliers: { id: 'suppliers', label: 'Proveedores', icon: Store },
  users: { id: 'users', label: 'Usuarios y Roles', icon: ShieldCheck },
  settings: { id: 'settings', label: 'Configuración Empresa', icon: Settings },
  backup: { id: 'backup', label: 'Copia de Seguridad', icon: Database }
};

// Estructura del menú: grupos plegables y accesos directos
const NAV = [
  { type: 'item', id: 'dashboard' },
  { type: 'group', id: 'comercial', label: 'Comercial', icon: Briefcase, items: ['pos', 'quotes', 'reports', 'orders', 'shipments', 'purchases'] },
  { type: 'group', id: 'productos', label: 'Productos', icon: PackageOpen, items: ['inventory', 'categories', 'catalogs'] },
  { type: 'group', id: 'gestion', label: 'Gestión', icon: Boxes, items: ['expenses', 'kardex', 'kardex_valorizado', 'reportes', 'workshop'] },
  { type: 'group', id: 'clientes', label: 'Clientes y Proveedores', icon: Users, items: ['customers', 'suppliers'] },
  { type: 'group', id: 'operaciones', label: 'Operaciones', icon: Wrench, items: ['users', 'settings', 'backup'] }
];

const STORAGE_KEY = 'sidebar_grupos_cerrados';

export default function Sidebar({
  activeTab,
  setActiveTab,
  user,
  onLogout,
  counts,
  storeSettings,
  mobileOpen = false,
  onCloseMobile = () => {}
}) {
  const [closed, setClosed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { return []; }
  });

  // Kardex comparte el permiso de Productos y Envíos el de Pedidos
  const PERM_OF = { kardex: 'inventory', kardex_valorizado: 'inventory', expenses: 'purchases', catalogs: 'inventory', workshop: 'inventory', shipments: 'orders', reportes: 'reports' };
  const isAllowed = (rawId) => {
    const id = PERM_OF[rawId] || rawId;
    if (id === 'dashboard') return true;
    if (user?.rol === 'admin') return true;
    if (id === 'suppliers' || id === 'purchases') return !!user?.permisos?.[id]; // solo con permiso explícito
    if (user?.permisos && user.permisos[id] !== undefined) return !!user.permisos[id];
    return true;
  };

  const countFor = (id) => (id === 'orders' ? counts?.pendingOrders : id === 'inventory' ? counts?.lowStock : 0);
  const badgeColorFor = (id) => (id === 'inventory' ? '#EF4444' : undefined);

  // Si el módulo activo está dentro de un grupo cerrado, se abre solo
  useEffect(() => {
    const g = NAV.find((n) => n.type === 'group' && n.items.includes(activeTab));
    if (g && closed.includes(g.id)) {
      const next = closed.filter((x) => x !== g.id);
      setClosed(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, [activeTab]);

  const toggle = (id) => {
    const next = closed.includes(id) ? closed.filter((x) => x !== id) : [...closed, id];
    setClosed(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const brandName = storeSettings?.nombre_tienda || 'Genia Creativa';
  const brandSlogan = storeSettings?.slogan || 'Gift Studio';

  const renderLink = (id) => {
    const item = ITEMS[id];
    const Icon = item.icon;
    const isActive = activeTab === id;
    const count = countFor(id);
    return (
      <div key={id} className="nav-item-container">
        <button className={`nav-link ${isActive ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
          <Icon className="nav-icon" size={18} strokeWidth={isActive ? 2.3 : 1.8} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{item.label}</span>
          {item.badge && <span className="nav-badge">{item.badge}</span>}
          {count > 0 && (
            <span className="nav-badge" title={id === 'orders' ? 'Pedidos no entregados' : 'Productos con stock bajo'} style={badgeColorFor(id) ? { background: badgeColorFor(id), color: '#fff' } : {}}>{count}</span>
          )}
        </button>
      </div>
    );
  };

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onCloseMobile} aria-hidden="true" />}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <button className="sidebar-close-btn" onClick={onCloseMobile} type="button" title="Cerrar menú">
          <X size={18} />
        </button>

        <div className="sidebar-logo">
          {storeSettings?.logo_url ? (
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px', background: '#FFFFFF', display: 'flex',
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', flexShrink: 0
            }}>
              <img src={storeSettings.logo_url} alt="Logo" style={{ width: '90%', height: '90%', objectFit: 'contain' }}
                onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
          ) : (
            <div className="logo-symbol">
              <div className="logo-circle-1"></div>
              <div className="logo-circle-2"></div>
              <Sparkles className="logo-icon" size={24} />
            </div>
          )}
          <div className="logo-text" style={{ maxWidth: '150px', minWidth: 0, overflow: 'hidden' }}>
            <h2 style={{ fontSize: brandName.length > 15 ? '16px' : '19px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={brandName}>
              {brandName}
            </h2>
            <span title={brandSlogan} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal', lineHeight: 1.15, fontSize: brandSlogan.length > 22 ? '9px' : '10.5px', letterSpacing: 0, wordBreak: 'break-word' }}>{brandSlogan}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((entry) => {
            if (entry.type === 'item') {
              return isAllowed(entry.id) ? renderLink(entry.id) : null;
            }
            const visible = entry.items.filter(isAllowed);
            if (visible.length === 0) return null;
            const GroupIcon = entry.icon;
            const isClosed = closed.includes(entry.id);
            return (
              <div key={entry.id} className={`nav-group ${isClosed ? 'collapsed' : ''}`}>
                <button type="button" className="nav-group-header" onClick={() => toggle(entry.id)} aria-expanded={!isClosed}>
                  <GroupIcon className="group-icon" size={15} />
                  <span>{entry.label}</span>
                  <ChevronDown className="group-chevron" size={15} />
                </button>
                {!isClosed && <div className="nav-group-items">{visible.map(renderLink)}</div>}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={onLogout} title="Cerrar sesión">
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}
