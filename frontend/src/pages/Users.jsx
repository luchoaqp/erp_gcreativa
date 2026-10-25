import Avatar, { AvatarPicker } from '../components/Avatar';
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Key, 
  Phone, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Check, 
  Lock, 
  Eye, 
  EyeOff,
  ShoppingBag,
  Truck,
  ShoppingCart,
  Gift,
  Layers,
  BarChart3,
  Settings,
  Database,
  UserCheck,
  Sparkles,
  FileText
} from 'lucide-react';
import { usersAPI } from '../api';

const MODULE_DEFINITIONS = [
  { id: 'pos', label: 'Punto de Venta (POS)', icon: ShoppingBag, desc: 'Realizar ventas en caja, agregar productos al carrito y cobrar' },
  { id: 'quotes', label: 'Cotizaciones', icon: FileText, desc: 'Crear presupuestos con vigencia, IGV opcional, PDF/ticket y convertirlos en venta' },
  { id: 'orders', label: 'Pedidos', icon: Truck, desc: 'Ver el tablero de pedidos, estados de entrega y etapas del flujo' },
  { id: 'inventory', label: 'Productos', icon: Gift, desc: 'Gestionar productos, packs, precios, insumos y stock' },
  { id: 'categories', label: 'Categorías & Ocasiones', icon: Layers, desc: 'Crear y organizar líneas de regalos y fechas especiales' },
  { id: 'customers', label: 'Clientes', icon: Users, desc: 'Gestión de clientes, tipos de cliente y fechas especiales' },
  { id: 'purchases', label: 'Compras', icon: ShoppingCart, desc: 'Registrar compras a proveedores, ingresar stock al almacén y ver compras realizadas' },
  { id: 'suppliers', label: 'Proveedores', icon: Truck, desc: 'Gestión de proveedores y sus datos de contacto' },
  { id: 'reports', label: 'Ventas', icon: BarChart3, desc: 'Consultar ventas, registrar pagos y generar comprobantes' },
  { id: 'settings', label: 'Configuración Empresa', icon: Settings, desc: 'Modificar datos de la tienda, delivery, logo y RUC' },
  { id: 'backup', label: 'Copia de Seguridad', icon: Database, desc: 'Generar y restaurar copias de base de datos (ERP)' },
  { id: 'users', label: 'Usuarios & Permisos', icon: ShieldCheck, desc: 'Administrar colaboradores, contraseñas y accesos' }
];

export default function UsersPage({ currentUser, onProfileChanged }) {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'matrix'
  const [users, setUsers] = useState([]);
  const [rolesConfig, setRolesConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Alertas
  const [alertInfo, setAlertInfo] = useState(null);

  // Modal Usuario
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [userForm, setUserForm] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'vendedor',
    avatar: '',
    telefono: '',
    estado: 1,
    permisos: {
      pos: true,
      orders: true,
      inventory: true,
      categories: true,
      customers: true,
      reports: false,
      settings: false,
      backup: false,
      users: false
    }
  });

  // Modal Confirmar Borrado
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const showAlert = (type, text) => {
    setAlertInfo({ type, text });
    setTimeout(() => setAlertInfo(null), 4500);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([
        usersAPI.getAll(),
        usersAPI.getRoles()
      ]);

      if (usersRes.success) setUsers(usersRes.users || []);
      if (rolesRes.success) setRolesConfig(rolesRes.roles || []);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      showAlert('error', 'Error al cargar usuarios: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers de Formulario ---
  const handleOpenNewUser = () => {
    setEditingUser(null);
    setShowPassword(false);
    // Predeterminado vendedor
    const defaultRole = rolesConfig.find(r => r.id === 'vendedor');
    setUserForm({
      nombre: '',
      email: '',
      password: '',
      rol: 'vendedor',
      avatar: '',
      telefono: '',
      estado: 1,
      permisos: defaultRole ? { ...defaultRole.permisos } : {
        pos: true, orders: true, inventory: true, categories: true,
        customers: true, reports: false, settings: false, backup: false, users: false
      }
    });
    setShowModal(true);
  };

  const handleOpenEditUser = (u) => {
    setEditingUser(u);
    setShowPassword(false);
    setUserForm({
      nombre: u.nombre || '',
      email: u.email || '',
      password: '', // Vacío para conservar
      rol: u.rol || 'vendedor',
      avatar: u.avatar || '',
      telefono: u.telefono || '',
      estado: u.estado !== undefined ? u.estado : 1,
      permisos: u.permisos ? { ...u.permisos } : {}
    });
    setShowModal(true);
  };

  const handleRolePresetSelect = (roleId) => {
    const role = rolesConfig.find(r => r.id === roleId);
    setUserForm(prev => ({
      ...prev,
      rol: roleId,
      permisos: role ? { ...role.permisos } : prev.permisos
    }));
  };

  const handleTogglePermission = (moduleId) => {
    setUserForm(prev => ({
      ...prev,
      permisos: {
        ...prev.permisos,
        [moduleId]: !prev.permisos?.[moduleId]
      }
    }));
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userForm.nombre.trim() || !userForm.email.trim()) {
      showAlert('error', 'Nombre y correo electrónico son requeridos');
      return;
    }

    if (!editingUser && (!userForm.password || userForm.password.length < 6)) {
      showAlert('error', 'La contraseña para nuevo usuario debe tener al menos 6 caracteres');
      return;
    }

    try {
      if (editingUser) {
        const res = await usersAPI.update(editingUser.id, userForm);
        if (res.success) {
          showAlert('success', 'Usuario actualizado con éxito');
          setShowModal(false);
          loadData();
          if (onProfileChanged) onProfileChanged();
        }
      } else {
        const res = await usersAPI.create(userForm);
        if (res.success) {
          showAlert('success', 'Usuario registrado con éxito');
          setShowModal(false);
          loadData();
        }
      }
    } catch (err) {
      showAlert('error', err.message || 'Error al guardar usuario');
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      const newStatus = user.estado === 1 ? 0 : 1;
      const res = await usersAPI.toggleStatus(user.id, newStatus);
      if (res.success) {
        showAlert('success', `Usuario ${newStatus === 1 ? 'activado' : 'desactivado'}`);
        loadData();
      }
    } catch (err) {
      showAlert('error', err.message || 'Error al cambiar estado');
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.id === 1) {
      showAlert('error', 'El administrador principal del sistema no puede ser eliminado');
      return;
    }
    setDeleteConfirmUser(user);
  };

  const confirmDeleteUserAction = async () => {
    if (!deleteConfirmUser) return;
    try {
      const res = await usersAPI.delete(deleteConfirmUser.id);
      if (res.success) {
        showAlert('success', 'Usuario eliminado exitosamente');
        loadData();
      }
    } catch (err) {
      showAlert('error', err.message || 'Error al eliminar');
    } finally {
      setDeleteConfirmUser(null);
    }
  };

  // Cálculos estadísticos
  const totalUsuarios = users.length;
  const adminCount = users.filter(u => u.rol === 'admin').length;
  const vendedorCount = users.filter(u => u.rol === 'vendedor').length;
  const activeCount = users.filter(u => u.estado === 1).length;

  // Filtrado
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.telefono && u.telefono.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = roleFilter === 'all' || u.rol === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeStyle = (rol) => {
    switch (rol) {
      case 'admin':
        return { bg: '#F3E8FF', color: '#7E22CE', label: 'Administrador' };
      case 'vendedor':
        return { bg: '#EFF6FF', color: '#1D4ED8', label: 'Vendedor / Asesor' };
      case 'taller':
        return { bg: '#FEF3C7', color: '#B45309', label: 'Taller / Prep.' };
      case 'repartidor':
        return { bg: '#ECFDF5', color: '#047857', label: 'Repartidor' };
      default:
        return { bg: '#F1F5F9', color: '#475569', label: rol };
    }
  };

  return (
    <div className="content-body animate-fade-in">
      {/* Alerta flotante */}
      {alertInfo && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 1000,
          background: alertInfo.type === 'success' ? '#10B981' : '#EF4444',
          color: '#FFFFFF',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: '600',
          fontSize: '14px',
          animation: 'fadeIn 0.25s ease'
        }}>
          {alertInfo.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{alertInfo.text}</span>
        </div>
      )}

      {/* Cabecera Principal */}
      <div className="page-header-responsive">
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#1C2A38', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={28} color="var(--primary)" />
            Usuarios, Roles & Permisos
          </h1>
          <p style={{ color: '#788A9B', fontSize: '14px', marginTop: '4px', margin: 0 }}>
            Administra el equipo de trabajo, asigna roles y configura permisos granulares por módulo.
          </p>
        </div>

        <div className="header-actions-responsive">
          <button 
            onClick={handleOpenNewUser}
            className="btn-primary" 
            style={{ width: 'auto', padding: '10px 18px', fontSize: '13.5px', borderRadius: '12px' }}
          >
            <Plus size={18} />
            <span>Nuevo Colaborador</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stat-panels-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-panel-card stat-panel-orange">
          <div>
            <div className="stat-panel-value">{totalUsuarios}</div>
            <div className="stat-panel-title">Total Colaboradores</div>
            <div className="stat-panel-subtitle">{activeCount} usuarios activos en tienda</div>
          </div>
          <div className="stat-panel-watermark"><Users size={70} /></div>
        </div>

        <div className="stat-panel-card stat-panel-blue">
          <div>
            <div className="stat-panel-value">{adminCount}</div>
            <div className="stat-panel-title">Administradores</div>
            <div className="stat-panel-subtitle">Acceso total al sistema</div>
          </div>
          <div className="stat-panel-watermark"><ShieldCheck size={70} /></div>
        </div>

        <div className="stat-panel-card stat-panel-green">
          <div>
            <div className="stat-panel-value">{vendedorCount}</div>
            <div className="stat-panel-title">Ventas & Cajeros</div>
            <div className="stat-panel-subtitle">Atención en Punto de Venta</div>
          </div>
          <div className="stat-panel-watermark"><ShoppingBag size={70} /></div>
        </div>

        <div className="stat-panel-card stat-panel-amber">
          <div>
            <div className="stat-panel-value">{MODULE_DEFINITIONS.length}</div>
            <div className="stat-panel-title">Módulos Protegidos</div>
            <div className="stat-panel-subtitle">Control de accesos en tiempo real</div>
          </div>
          <div className="stat-panel-watermark"><Lock size={70} /></div>
        </div>
      </div>

      {/* Barra de Pestañas y Filtros */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #EEF3F0',
        borderRadius: '16px',
        padding: '14px 18px',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('list')}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: '700',
              background: activeTab === 'list' ? 'var(--primary)' : '#F4F7F6',
              color: activeTab === 'list' ? '#FFFFFF' : '#5A6E82',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Users size={16} />
            <span>Colaboradores ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: '700',
              background: activeTab === 'matrix' ? 'var(--primary)' : '#F4F7F6',
              color: activeTab === 'matrix' ? '#FFFFFF' : '#5A6E82',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <ShieldCheck size={16} />
            <span>Matriz de Roles & Permisos</span>
          </button>
        </div>

        {activeTab === 'list' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{
                background: '#F4F7F6',
                border: '1px solid #E2ECE8',
                borderRadius: '12px',
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#1C2A38',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Todos los Roles</option>
              <option value="admin">Administrador</option>
              <option value="vendedor">Vendedor / Asesor</option>
              <option value="taller">Taller & Preparación</option>
              <option value="repartidor">Repartidor / Logística</option>
            </select>

            <div className="search-container" style={{ maxWidth: '260px', margin: 0 }}>
              <Search size={16} color="#9EAFBF" />
              <input 
                type="text" 
                placeholder="Buscar colaborador..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} style={{ color: '#9EAFBF' }}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PESTAÑA 1: LISTA DE USUARIOS */}
      {activeTab === 'list' && (
        <div className="table-responsive-container">
          <table>
            <thead>
              <tr style={{ background: '#F8FAF9', borderBottom: '1px solid #EEF3F0' }}>
                <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#788A9B', textTransform: 'uppercase' }}>Colaborador</th>
                <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#788A9B', textTransform: 'uppercase' }}>Rol Asignado</th>
                <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#788A9B', textTransform: 'uppercase' }}>Teléfono</th>
                <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#788A9B', textTransform: 'uppercase' }}>Permisos Habilitados</th>
                <th style={{ padding: '14px 18px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#788A9B', textTransform: 'uppercase' }}>Estado</th>
                <th style={{ padding: '14px 18px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#788A9B', textTransform: 'uppercase' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: '#788A9B' }}>
                    <Users size={36} color="#CBD5E1" style={{ marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontWeight: '600' }}>No se encontraron colaboradores</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const roleStyle = getRoleBadgeStyle(user.rol);
                  const allowedModulesCount = Object.values(user.permisos || {}).filter(Boolean).length;
                  const isMainAdmin = user.id === 1;

                  return (
                    <tr key={user.id} style={{ borderBottom: '1px solid #F0F4F2', transition: 'background 0.15s' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Avatar user={user} size={38} />
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '14px', color: '#1C2A38' }}>
                              {user.nombre}
                              {isMainAdmin && (
                                <span style={{ marginLeft: '6px', fontSize: '10px', background: 'var(--primary-light)', color: 'var(--primary)', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>
                                  PRINCIPAL
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: '#788A9B' }}>{user.email}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: '700',
                          background: roleStyle.bg,
                          color: roleStyle.color,
                          display: 'inline-block'
                        }}>
                          {roleStyle.label}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px', fontSize: '13px', color: '#5A6E82' }}>
                        {user.telefono || '—'}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '2px 8px',
                            background: '#F1F5F3',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            color: '#1C2A38'
                          }}>
                            {allowedModulesCount} de {MODULE_DEFINITIONS.length} módulos
                          </span>
                          {user.rol === 'admin' && (
                            <span style={{ fontSize: '11px', color: '#8B5CF6', fontWeight: '700' }}>Total</span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleStatus(user)}
                          disabled={isMainAdmin}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: isMainAdmin ? 'not-allowed' : 'pointer'
                          }}
                          title={isMainAdmin ? 'El admin principal siempre está activo' : 'Click para cambiar estado'}
                        >
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            background: user.estado === 1 ? '#E8F5E9' : '#FEE2E2',
                            color: user.estado === 1 ? '#2E7D32' : '#B91C1C',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: user.estado === 1 ? '#2E7D32' : '#B91C1C' }} />
                            {user.estado === 1 ? 'Activo' : 'Inactivo'}
                          </span>
                        </button>
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => handleOpenEditUser(user)}
                            style={{
                              padding: '6px 10px',
                              background: '#F4F7F6',
                              borderRadius: '8px',
                              color: '#1C2A38',
                              fontSize: '12px',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer'
                            }}
                            title="Editar Datos & Permisos"
                          >
                            <Edit3 size={14} />
                            <span>Editar</span>
                          </button>

                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={isMainAdmin}
                            style={{
                              padding: '6px 10px',
                              background: isMainAdmin ? '#F1F5F3' : '#FFF1F2',
                              borderRadius: '8px',
                              color: isMainAdmin ? '#9EAFBF' : '#E11D48',
                              fontSize: '12px',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: isMainAdmin ? 'not-allowed' : 'pointer',
                              border: 'none'
                            }}
                            title={isMainAdmin ? 'No se puede eliminar' : 'Eliminar Colaborador'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PESTAÑA 2: MATRIZ DE ROLES & PERMISOS */}
      {activeTab === 'matrix' && (
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #EEF3F0', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1C2A38', margin: 0 }}>
              Matriz Comparativa de Roles
            </h3>
            <p style={{ fontSize: '13.5px', color: '#788A9B', marginTop: '4px', margin: 0 }}>
              Configuración de accesos predeterminada por función. Recuerda que al editar un colaborador puedes personalizar permisos específicos.
            </p>
          </div>

          <div className="table-responsive-container">
            <table>
              <thead>
                <tr style={{ background: '#F8FAF9', borderBottom: '2px solid #E2ECE8' }}>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12.5px', fontWeight: '700', color: '#1C2A38' }}>Módulo del Sistema</th>
                  <th style={{ padding: '14px 18px', textAlign: 'center', fontSize: '12.5px', fontWeight: '700', color: '#7E22CE' }}>Administrador</th>
                  <th style={{ padding: '14px 18px', textAlign: 'center', fontSize: '12.5px', fontWeight: '700', color: '#1D4ED8' }}>Vendedor / Asesor</th>
                  <th style={{ padding: '14px 18px', textAlign: 'center', fontSize: '12.5px', fontWeight: '700', color: '#B45309' }}>Taller & Prep.</th>
                  <th style={{ padding: '14px 18px', textAlign: 'center', fontSize: '12.5px', fontWeight: '700', color: '#047857' }}>Repartidor</th>
                </tr>
              </thead>
              <tbody>
                {MODULE_DEFINITIONS.map(mod => {
                  const Icon = mod.icon;
                  return (
                    <tr key={mod.id} style={{ borderBottom: '1px solid #F0F4F2' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={17} />
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#1C2A38' }}>{mod.label}</div>
                            <div style={{ fontSize: '11.5px', color: '#788A9B' }}>{mod.desc}</div>
                          </div>
                        </div>
                      </td>

                      {/* Admin */}
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#F3E8FF', color: '#7E22CE', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={16} strokeWidth={3} />
                        </span>
                      </td>

                      {/* Vendedor */}
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        {['pos', 'orders', 'inventory', 'categories', 'customers'].includes(mod.id) ? (
                          <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#EFF6FF', color: '#1D4ED8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={16} strokeWidth={3} />
                          </span>
                        ) : (
                          <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#F8FAF9', color: '#CBD5E1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={15} />
                          </span>
                        )}
                      </td>

                      {/* Taller */}
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        {['orders', 'inventory'].includes(mod.id) ? (
                          <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#FEF3C7', color: '#B45309', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={16} strokeWidth={3} />
                          </span>
                        ) : (
                          <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#F8FAF9', color: '#CBD5E1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={15} />
                          </span>
                        )}
                      </td>

                      {/* Repartidor */}
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        {['orders'].includes(mod.id) ? (
                          <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#ECFDF5', color: '#047857', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={16} strokeWidth={3} />
                          </span>
                        ) : (
                          <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#F8FAF9', color: '#CBD5E1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={15} />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Crear / Editar Colaborador */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px', maxHeight: '92vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <UserCheck size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1C2A38', margin: 0 }}>
                    {editingUser ? 'Editar Colaborador & Permisos' : 'Registrar Nuevo Colaborador'}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#788A9B' }}>
                    Asigna su rol y activa los módulos a los que tendrá acceso.
                  </span>
                </div>
              </div>
              <button aria-label="Cerrar" onClick={() => setShowModal(false)} style={{ color: '#9EAFBF', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveUser}>
              {/* Datos Básicos */}
              <div className="modal-form-grid-2">
                <div className="form-group">
                  <label className="form-label">Nombre Completo *</label>
                  <div className="form-input-box">
                    <input
                      type="text"
                      required
                      placeholder="Ej. Carmen Salinas Gómez"
                      value={userForm.nombre}
                      onChange={e => setUserForm(prev => ({ ...prev, nombre: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Correo Electrónico (Login) *</label>
                  <div className="form-input-box">
                    <input
                      type="email"
                      required
                      placeholder="carmen@regalodeensueno.com"
                      value={userForm.email}
                      onChange={e => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-form-grid-2">
                <div className="form-group">
                  <label className="form-label">
                    {editingUser ? 'Nueva Contraseña (Opcional)' : 'Contraseña de Acceso *'}
                  </label>
                  <div className="form-input-box" style={{ position: 'relative' }}>
                    <Key size={16} color="#9EAFBF" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!editingUser}
                      placeholder={editingUser ? 'Conservar contraseña actual' : 'Mínimo 6 caracteres'}
                      value={userForm.password}
                      onChange={e => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ color: '#9EAFBF', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Teléfono / WhatsApp</label>
                  <div className="form-input-box">
                    <Phone size={16} color="#9EAFBF" />
                    <input
                      type="text"
                      placeholder="+51 987 654 321"
                      value={userForm.telefono}
                      onChange={e => setUserForm(prev => ({ ...prev, telefono: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Selector de Rol */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Perfil / Rol Predeterminado</span>
                  <span style={{ fontSize: '11px', color: '#788A9B', fontWeight: '500' }}>
                    Al hacer clic se reconfigura la plantilla de permisos
                  </span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {rolesConfig.map(r => {
                    const isSelected = userForm.rol === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => handleRolePresetSelect(r.id)}
                        style={{
                          border: isSelected ? '2px solid var(--primary)' : '1px solid #E2ECE8',
                          background: isSelected ? '#FFF5F2' : '#FFFFFF',
                          borderRadius: '12px',
                          padding: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '12.5px', fontWeight: '700', color: isSelected ? 'var(--primary)' : '#1C2A38' }}>
                          {r.nombre}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#788A9B', marginTop: '2px' }}>
                          {r.id === 'admin' ? 'Total' : r.id === 'vendedor' ? 'Venta & POS' : r.id === 'taller' ? 'Producción' : 'Delivery'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Avatar</label>
                <AvatarPicker value={userForm.avatar} rol={userForm.rol} onChange={(avatar) => setUserForm({ ...userForm, avatar })} />
              </div>

              {/* Matriz de Permisos Granulares */}
              <div className="form-group" style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Permisos Granulares por Módulo
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const allTrue = {};
                      MODULE_DEFINITIONS.forEach(m => { allTrue[m.id] = true; });
                      setUserForm(prev => ({ ...prev, permisos: allTrue }));
                    }}
                    style={{ fontSize: '11.5px', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Activar todos
                  </button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '10px',
                  background: '#F8FAF9',
                  border: '1px solid #EEF3F0',
                  borderRadius: '14px',
                  padding: '12px'
                }}>
                  {MODULE_DEFINITIONS.map(mod => {
                    const Icon = mod.icon;
                    const isChecked = !!userForm.permisos?.[mod.id];

                    return (
                      <div
                        key={mod.id}
                        onClick={() => handleTogglePermission(mod.id)}
                        style={{
                          background: isChecked ? '#FFFFFF' : '#F1F5F3',
                          border: isChecked ? '1.5px solid var(--primary)' : '1px solid #E2ECE8',
                          borderRadius: '10px',
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Manejado por el contenedor
                          style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12.5px', fontWeight: '700', color: isChecked ? '#1C2A38' : '#788A9B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Icon size={14} color={isChecked ? 'var(--primary)' : '#9EAFBF'} />
                            <span>{mod.label}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Estado Activo / Inactivo */}
              <div style={{
                background: '#F8FAF9',
                border: '1px solid #EEF3F0',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                margin: '18px 0 22px'
              }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#1C2A38' }}>
                    Estado de la Cuenta
                  </div>
                  <div style={{ fontSize: '12px', color: '#788A9B' }}>
                    Los usuarios inactivos no pueden ingresar al sistema ni cobrar en caja.
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={userForm.estado === 1}
                    onChange={e => setUserForm(prev => ({ ...prev, estado: e.target.checked ? 1 : 0 }))}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: userForm.estado === 1 ? '#10B981' : '#788A9B' }}>
                    {userForm.estado === 1 ? 'Activo' : 'Inactivo'}
                  </span>
                </label>
              </div>

              {/* Botones de Acción */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    background: '#F1F5F3',
                    color: '#5A6E82',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ width: 'auto', padding: '10px 22px', fontSize: '13.5px' }}
                >
                  {editingUser ? 'Guardar Cambios' : 'Registrar Colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar Borrado */}
      {deleteConfirmUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px', textAlign: 'center', padding: '28px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: '#FFF1F2',
              color: '#EF4444',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Trash2 size={28} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1C2A38', marginBottom: '8px' }}>
              ¿Eliminar Colaborador?
            </h3>
            <p style={{ fontSize: '13.5px', color: '#788A9B', marginBottom: '22px', lineHeight: '1.5' }}>
              Estás a punto de eliminar a <strong>"{deleteConfirmUser.nombre}"</strong> ({deleteConfirmUser.email}).
              Perderá el acceso inmediatamente.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteConfirmUser(null)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: '#F1F5F3',
                  color: '#5A6E82',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteUserAction}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
