import Avatar from './Avatar';
import React, { useState, useEffect } from 'react';
import { salesAPI } from '../api';
import { Search, Bell, PlusCircle, Truck, UserCheck, AlertTriangle, Menu, Sun, Moon } from 'lucide-react';

export default function Topbar({ 
  user, 
  onNewSale, 
  onViewOrders,
  onSearchSales,
  urgentDeliveries = [], 
  lowStockCount = 0,
  onToggleMobileMenu = () => {},
  theme = 'light',
  onToggleTheme = () => {}
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [openHits, setOpenHits] = useState(false);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setHits([]); return undefined; }
    const timer = setTimeout(() => {
      salesAPI.list(`?tab=todas&periodo=todo&search=${encodeURIComponent(t)}`).then((r) => setHits((r.sales || []).slice(0, 6))).catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);
  const go = (text) => { const t = (text || '').trim(); if (!t) return; setOpenHits(false); onSearchSales && onSearchSales(t); };

  const totalNotifs = (urgentDeliveries?.length || 0) + (lowStockCount > 0 ? 1 : 0);

  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* Botón de Menú Hamburguesa en Pantallas Pequeñas/Tablets */}
        <button 
          className="hamburger-btn" 
          onClick={onToggleMobileMenu}
          type="button"
          title="Abrir menú"
        >
          <Menu size={22} />
        </button>

        {/* Search bar matching pill shape in reference */}
        <div className="search-container" style={{ position: 'relative' }}>
          <Search size={18} color="#9EAFBF" />
          <input
            type="text"
            placeholder="Buscar pedidos por nombre o teléfono…"
            className="search-input"
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpenHits(true); }}
            onFocus={() => setOpenHits(true)}
            onBlur={() => setTimeout(() => setOpenHits(false), 180)}
            onKeyDown={(e) => { if (e.key === 'Enter') go(q); if (e.key === 'Escape') setOpenHits(false); }}
          />
          {openHits && q.trim().length >= 2 && (
            <div style={{ position: 'absolute', top: '46px', left: 0, right: 0, background: '#fff', border: '1px solid #EBF1EE', borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,.12)', zIndex: 60, overflow: 'hidden' }}>
              {hits.length === 0 ? (
                <div style={{ padding: '12px 14px', fontSize: 12.5, color: '#788A9B' }}>Sin coincidencias. Presiona Enter para buscar en Ventas.</div>
              ) : hits.map((h) => (
                <button key={h.id} type="button" onMouseDown={() => go(h.cliente_telefono || h.cliente_nombre)}
                  style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 10, padding: '9px 14px', textAlign: 'left', fontSize: 13, borderBottom: '1px solid #F3F5F4' }}>
                  <span style={{ minWidth: 0 }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.cliente_nombre}</strong><small style={{ color: '#788A9B' }}>{h.cliente_telefono || 'Sin teléfono'} · PD-{String(h.id).padStart(6, '0')}</small></span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>S/. {Number(h.total).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Topbar Actions */}
      <div className="topbar-actions">
        {/* Quick New Sale button */}
        <button 
          onClick={onNewSale}
          className="btn-primary" 
          style={{ width: 'auto', padding: '10px 18px', fontSize: '13px', borderRadius: '999px' }}
        >
          <PlusCircle size={16} />
          <span>Nueva Venta</span>
        </button>

        <button
          onClick={onViewOrders}
          type="button"
          className="btn-primary"
          style={{ width: 'auto', padding: '10px 18px', fontSize: '13px', borderRadius: '999px', background: '#fff', color: 'var(--primary)', border: '1.5px solid var(--primary)', boxShadow: 'none' }}
        >
          <Truck size={16} />
          <span>Ver Pedidos</span>
        </button>

        {/* Modo oscuro / claro */}
        <button
          type="button"
          className={`theme-toggle ${theme === 'dark' ? 'on' : ''}`}
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label="Cambiar tema"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Notifications Icon with Dropdown */}
        <div style={{ position: 'relative' }}>
          <button 
            className="icon-btn" 
            onClick={() => setShowNotifications(!showNotifications)}
            title="Notificaciones y entregas"
          >
            <Bell size={20} />
            {totalNotifs > 0 && <span className="badge-dot"></span>}
          </button>

          {showNotifications && (
            <div style={{
              position: 'absolute',
              top: '52px',
              right: 0,
              width: '320px',
              background: '#FFFFFF',
              borderRadius: '16px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
              border: '1px solid #EBF1EE',
              zIndex: 50,
              padding: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #F0F4F2', paddingBottom: '8px' }}>
                <span style={{ fontWeight: '700', fontSize: '14px' }}>Alertas de Hoy ({totalNotifs})</span>
                <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '600' }}>Regalos & Delivery</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                {urgentDeliveries.slice(0, 3).map((item) => (
                  <div key={item.id} style={{ display: 'flex', gap: '8px', fontSize: '12px', padding: '6px', background: '#FFF9F5', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--primary)' }}>🎁</span>
                    <div>
                      <div style={{ fontWeight: '600' }}>{item.nombre_destinatario}</div>
                      <div style={{ fontSize: '11px', color: '#788A9B' }}>Entrega: {item.franja_horaria}</div>
                    </div>
                  </div>
                ))}
                {lowStockCount > 0 && (
                  <div style={{ display: 'flex', gap: '8px', fontSize: '12px', padding: '6px', background: '#FEF2F2', borderRadius: '8px' }}>
                    <AlertTriangle size={16} color="#EF4444" />
                    <div>
                      <div style={{ fontWeight: '600', color: '#B91C1C' }}>Stock Crítico</div>
                      <div style={{ fontSize: '11px', color: '#788A9B' }}>{lowStockCount} insumos/regalos por agotarse</div>
                    </div>
                  </div>
                )}
                {totalNotifs === 0 && (
                  <div style={{ textAlign: 'center', fontSize: '12px', color: '#788A9B', padding: '12px 0' }}>
                    No tienes alertas pendientes por ahora ✨
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill matching reference avatar pill */}
        <div className="user-profile-pill">
          <Avatar user={user} size={36} className="user-avatar" />
          <div className="user-info">
            <span className="user-name">{user?.nombre?.split(' ')[0] || 'Usuario'}</span>
            <span className="user-role">{user?.rol === 'admin' ? 'Administrador' : user?.rol === 'vendedor' ? 'Vendedora' : 'Repartidor'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
