import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Gift, 
  Tag, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Sparkles,
  PartyPopper,
  PackageCheck,
  Check
} from 'lucide-react';
import { categoriesAPI } from '../api';

const PRESET_COLORS = [
  { label: 'Coral Pasión', hex: '#FF5E36' },
  { label: 'Rosa Romance', hex: '#EC4899' },
  { label: 'Esmeralda', hex: '#10B981' },
  { label: 'Azul Zafiro', hex: '#3B82F6' },
  { label: 'Dorado Champagne', hex: '#F59E0B' },
  { label: 'Violeta Mágico', hex: '#8B5CF6' },
  { label: 'Cyan Fiesta', hex: '#06B6D4' },
  { label: 'Rojo Pasión', hex: '#EF4444' }
];

const PRESET_EMOJIS = ['🎁', '🎂', '💖', '🎓', '💐', '🧸', '💍', '🌟', '🥂', '🎉', '🍫', '🎈'];

export default function Categories() {
  const [activeTab, setActiveTab] = useState('categories'); // 'categories' | 'occasions'
  const [categories, setCategories] = useState([]);
  const [occasions, setOccasions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Feedback alerts
  const [alertInfo, setAlertInfo] = useState(null); // { type: 'success'|'error', text: '' }

  // Modal Categoría
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [catForm, setCatForm] = useState({
    nombre: '',
    slug: '',
    descripcion: '',
    icono: 'Gift',
    color_badge: '#FF5E36',
    estado: 1
  });

  // Modal Ocasión
  const [showOccasionModal, setShowOccasionModal] = useState(false);
  const [editingOccasion, setEditingOccasion] = useState(null);
  const [occForm, setOccForm] = useState({
    nombre: '',
    icono: '🎉'
  });

  // Modal Confirmar Eliminación
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'category'|'occasion', item: obj }

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
      const res = await categoriesAPI.getAll();
      if (res.success) {
        setCategories(res.categories || []);
        setOccasions(res.occasions || []);
      }
    } catch (err) {
      console.error('Error cargando categorías:', err);
      showAlert('error', 'Error al cargar categorías: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers Categoría ---
  const handleOpenNewCategory = () => {
    setEditingCategory(null);
    setCatForm({
      nombre: '',
      slug: '',
      descripcion: '',
      icono: 'Gift',
      color_badge: '#FF5E36',
      estado: 1
    });
    setShowCategoryModal(true);
  };

  const handleOpenEditCategory = (cat) => {
    setEditingCategory(cat);
    setCatForm({
      nombre: cat.nombre || '',
      slug: cat.slug || '',
      descripcion: cat.descripcion || '',
      icono: cat.icono || 'Gift',
      color_badge: cat.color_badge || '#FF5E36',
      estado: cat.estado !== undefined ? cat.estado : 1
    });
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!catForm.nombre.trim()) {
      showAlert('error', 'Por favor ingresa el nombre de la categoría');
      return;
    }

    try {
      if (editingCategory) {
        const res = await categoriesAPI.update(editingCategory.id, catForm);
        if (res.success) {
          showAlert('success', 'Categoría actualizada exitosamente');
          setShowCategoryModal(false);
          loadData();
        }
      } else {
        const res = await categoriesAPI.create(catForm);
        if (res.success) {
          showAlert('success', 'Categoría creada exitosamente');
          setShowCategoryModal(false);
          loadData();
        }
      }
    } catch (err) {
      showAlert('error', err.message || 'Error al guardar la categoría');
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (cat.total_productos > 0) {
      showAlert('error', `No puedes eliminar "${cat.nombre}" porque tiene ${cat.total_productos} productos vinculados. Reasígnalos primero.`);
      return;
    }
    setDeleteConfirm({ type: 'category', item: cat });
  };

  // --- Handlers Ocasión ---
  const handleOpenNewOccasion = () => {
    setEditingOccasion(null);
    setOccForm({ nombre: '', icono: '🎉' });
    setShowOccasionModal(true);
  };

  const handleOpenEditOccasion = (occ) => {
    setEditingOccasion(occ);
    setOccForm({ nombre: occ.nombre || '', icono: occ.icono || '🎉' });
    setShowOccasionModal(true);
  };

  const handleSaveOccasion = async (e) => {
    e.preventDefault();
    if (!occForm.nombre.trim()) {
      showAlert('error', 'Por favor ingresa el nombre de la ocasión');
      return;
    }

    try {
      if (editingOccasion) {
        const res = await categoriesAPI.updateOccasion(editingOccasion.id, occForm);
        if (res.success) {
          showAlert('success', 'Ocasión actualizada correctamente');
          setShowOccasionModal(false);
          loadData();
        }
      } else {
        const res = await categoriesAPI.createOccasion(occForm);
        if (res.success) {
          showAlert('success', 'Ocasión creada con éxito');
          setShowOccasionModal(false);
          loadData();
        }
      }
    } catch (err) {
      showAlert('error', err.message || 'Error al guardar ocasión');
    }
  };

  const handleDeleteOccasion = async (occ) => {
    if (occ.total_productos > 0) {
      showAlert('error', `No se puede eliminar la ocasión "${occ.nombre}" porque está asignada a ${occ.total_productos} productos.`);
      return;
    }
    setDeleteConfirm({ type: 'occasion', item: occ });
  };

  const confirmDeleteAction = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'category') {
        const res = await categoriesAPI.delete(deleteConfirm.item.id);
        if (res.success) {
          showAlert('success', 'Categoría eliminada');
          loadData();
        }
      } else {
        const res = await categoriesAPI.deleteOccasion(deleteConfirm.item.id);
        if (res.success) {
          showAlert('success', 'Ocasión eliminada');
          loadData();
        }
      }
    } catch (err) {
      showAlert('error', err.message || 'Error al eliminar');
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Cálculos estadísticos
  const totalCategorias = categories.length;
  const activasCategorias = categories.filter(c => c.estado === 1).length;
  const totalOcasiones = occasions.length;
  const totalProductosAsociados = categories.reduce((acc, c) => acc + (c.total_productos || 0), 0);

  // Filtrado de búsqueda
  const filteredCategories = categories.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.descripcion && c.descripcion.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.slug && c.slug.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredOccasions = occasions.filter(o => 
    o.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="content-body animate-fade-in">
      {/* Alertas Flotantes */}
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
            <Layers size={28} color="var(--primary)" />
            Gestión de Categorías & Ocasiones
          </h1>
          <p style={{ color: '#788A9B', fontSize: '14px', marginTop: '4px', margin: 0 }}>
            Líneas de producto y ocasiones especiales para catálogo, tienda y punto de venta.
          </p>
        </div>

        <div className="header-actions-responsive">
          <button 
            onClick={handleOpenNewCategory}
            className="btn-primary" 
            style={{ width: 'auto', padding: '10px 18px', fontSize: '13.5px', borderRadius: '12px' }}
          >
            <Plus size={18} />
            <span>Nueva Categoría</span>
          </button>

          <button 
            onClick={handleOpenNewOccasion}
            style={{ 
              background: 'var(--primary-light)', 
              color: 'var(--primary)', 
              border: '1.5px solid #FFD5CA',
              borderRadius: '12px',
              padding: '10px 18px', 
              fontSize: '13.5px', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <PartyPopper size={18} />
            <span>Nueva Ocasión</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stat-panels-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-panel-card stat-panel-orange">
          <div>
            <div className="stat-panel-value">{totalCategorias}</div>
            <div className="stat-panel-title">Total Categorías</div>
            <div className="stat-panel-subtitle">{activasCategorias} activas para ventas</div>
          </div>
          <div className="stat-panel-watermark"><Layers size={70} /></div>
        </div>

        <div className="stat-panel-card stat-panel-blue">
          <div>
            <div className="stat-panel-value">{totalOcasiones}</div>
            <div className="stat-panel-title">Ocasiones Especiales</div>
            <div className="stat-panel-subtitle">Momentos y celebraciones</div>
          </div>
          <div className="stat-panel-watermark"><PartyPopper size={70} /></div>
        </div>

        <div className="stat-panel-card stat-panel-green">
          <div>
            <div className="stat-panel-value">{totalProductosAsociados}</div>
            <div className="stat-panel-title">Productos en Líneas</div>
            <div className="stat-panel-subtitle">Regalos y boxes catalogados</div>
          </div>
          <div className="stat-panel-watermark"><PackageCheck size={70} /></div>
        </div>

        <div className="stat-panel-card stat-panel-amber">
          <div>
            <div className="stat-panel-value">100%</div>
            <div className="stat-panel-title">Sincronización POS</div>
            <div className="stat-panel-subtitle">Disponibles en caja al instante</div>
          </div>
          <div className="stat-panel-watermark"><Sparkles size={70} /></div>
        </div>
      </div>

      {/* Barra de Pestañas y Búsqueda */}
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
            onClick={() => setActiveTab('categories')}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: '700',
              background: activeTab === 'categories' ? 'var(--primary)' : '#F4F7F6',
              color: activeTab === 'categories' ? '#FFFFFF' : '#5A6E82',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Layers size={16} />
            <span>Categorías de Regalo ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('occasions')}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: '700',
              background: activeTab === 'occasions' ? 'var(--primary)' : '#F4F7F6',
              color: activeTab === 'occasions' ? '#FFFFFF' : '#5A6E82',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <PartyPopper size={16} />
            <span>Ocasiones Especiales ({occasions.length})</span>
          </button>
        </div>

        <div className="search-container" style={{ maxWidth: '300px', margin: 0 }}>
          <Search size={16} color="#9EAFBF" />
          <input 
            type="text" 
            placeholder={`Buscar en ${activeTab === 'categories' ? 'categorías...' : 'ocasiones...'}`}
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

      {/* Contenido Pestaña 1: CATEGORÍAS */}
      {activeTab === 'categories' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '18px'
        }}>
          {filteredCategories.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px 20px', background: '#FFFFFF', borderRadius: '16px', border: '1px dashed #DCE8E5' }}>
              <Layers size={42} color="#CBD5E1" style={{ marginBottom: '10px' }} />
              <p style={{ fontWeight: '700', color: '#1C2A38', margin: 0 }}>No se encontraron categorías</p>
              <p style={{ fontSize: '13px', color: '#788A9B', marginTop: '4px' }}>Crea una nueva categoría o ajusta el término de búsqueda.</p>
            </div>
          ) : (
            filteredCategories.map(cat => (
              <div 
                key={cat.id}
                style={{
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #EEF3F0',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
              >
                {/* Indicador de Color Superior */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: cat.color_badge || '#FF5E36'
                }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      background: `${cat.color_badge || '#FF5E36'}18`,
                      color: cat.color_badge || '#FF5E36',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Gift size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1C2A38', margin: 0 }}>
                        {cat.nombre}
                      </h3>
                      <span style={{ fontSize: '11.5px', color: '#788A9B', fontWeight: '600' }}>
                        slug: /{cat.slug}
                      </span>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '3px 9px',
                    borderRadius: '999px',
                    background: cat.estado === 1 ? '#E8F5E9' : '#F1F5F3',
                    color: cat.estado === 1 ? '#2E7D32' : '#788A9B'
                  }}>
                    {cat.estado === 1 ? 'Activa' : 'Inactiva'}
                  </span>
                </div>

                <p style={{
                  fontSize: '12.5px',
                  color: '#5A6E82',
                  margin: 0,
                  lineHeight: '1.45',
                  minHeight: '36px'
                }}>
                  {cat.descripcion || 'Sin descripción ingresada.'}
                </p>

                <div style={{
                  borderTop: '1px solid #F0F4F2',
                  paddingTop: '12px',
                  marginTop: 'auto',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Tag size={14} color="#788A9B" />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#1C2A38' }}>
                      {cat.total_productos}
                    </span>
                    <span style={{ fontSize: '12px', color: '#788A9B' }}>
                      {cat.total_productos === 1 ? 'producto' : 'productos'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleOpenEditCategory(cat)}
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
                      title="Editar Categoría"
                    >
                      <Edit3 size={14} />
                      <span>Editar</span>
                    </button>

                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      style={{
                        padding: '6px 10px',
                        background: '#FFF1F2',
                        borderRadius: '8px',
                        color: '#E11D48',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer'
                      }}
                      title="Eliminar Categoría"
                    >
                      <Trash2 size={14} />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Contenido Pestaña 2: OCASIONES ESPECIALES */}
      {activeTab === 'occasions' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {filteredOccasions.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px 20px', background: '#FFFFFF', borderRadius: '16px', border: '1px dashed #DCE8E5' }}>
              <PartyPopper size={42} color="#CBD5E1" style={{ marginBottom: '10px' }} />
              <p style={{ fontWeight: '700', color: '#1C2A38', margin: 0 }}>No se encontraron ocasiones</p>
              <p style={{ fontSize: '13px', color: '#788A9B', marginTop: '4px' }}>Crea una nueva ocasión para etiquetar regalos y boxes.</p>
            </div>
          ) : (
            filteredOccasions.map(occ => (
              <div
                key={occ.id}
                style={{
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #EEF3F0',
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    fontSize: '26px',
                    width: '46px',
                    height: '46px',
                    background: '#FFF5F2',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #FFE4DD'
                  }}>
                    {occ.icono || '🎉'}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#1C2A38', margin: 0 }}>
                      {occ.nombre}
                    </h4>
                    <span style={{ fontSize: '11.5px', color: '#788A9B', fontWeight: '600' }}>
                      {occ.total_productos} {occ.total_productos === 1 ? 'regalo vinculado' : 'regalos vinculados'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => handleOpenEditOccasion(occ)}
                    style={{
                      padding: '6px 8px',
                      background: '#F4F7F6',
                      borderRadius: '8px',
                      color: '#1C2A38',
                      cursor: 'pointer'
                    }}
                    title="Editar Ocasión"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteOccasion(occ)}
                    style={{
                      padding: '6px 8px',
                      background: '#FFF1F2',
                      borderRadius: '8px',
                      color: '#E11D48',
                      cursor: 'pointer'
                    }}
                    title="Eliminar Ocasión"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL: Crear / Editar Categoría */}
      {showCategoryModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Layers size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1C2A38', margin: 0 }}>
                    {editingCategory ? 'Editar Categoría de Regalo' : 'Nueva Categoría de Regalo'}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#788A9B' }}>
                    Define la línea de producto y su apariencia en la tienda.
                  </span>
                </div>
              </div>
              <button aria-label="Cerrar" onClick={() => setShowCategoryModal(false)} style={{ color: '#9EAFBF', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory}>
              <div className="form-group">
                <label className="form-label">Nombre de la Categoría *</label>
                <div className="form-input-box">
                  <input
                    type="text"
                    required
                    placeholder="Ej. Boxes Sorpresa de Lujo, Arreglos con Globos..."
                    value={catForm.nombre}
                    onChange={e => {
                      const val = e.target.value;
                      setCatForm(prev => ({
                        ...prev,
                        nombre: val,
                        // auto-slug si es nuevo
                        slug: !editingCategory ? val.toLowerCase().replace(/[^a-z0-9]+/g, '-') : prev.slug
                      }));
                    }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Slug / Identificador URL</label>
                <div className="form-input-box">
                  <input
                    type="text"
                    placeholder="ej: boxes-sorpresa-lujo"
                    value={catForm.slug}
                    onChange={e => setCatForm(prev => ({ ...prev, slug: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea
                  placeholder="Detalles sobre qué tipo de regalos o sorpresas componen esta línea..."
                  rows={3}
                  value={catForm.descripcion}
                  onChange={e => setCatForm(prev => ({ ...prev, descripcion: e.target.value }))}
                  style={{
                    width: '100%',
                    borderRadius: '12px',
                    border: '1.5px solid #EBF0ED',
                    padding: '10px 14px',
                    fontSize: '13.5px',
                    fontFamily: 'inherit',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Selector de Color de Badge */}
              <div className="form-group">
                <label className="form-label">Color Distintivo del Badge</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setCatForm(prev => ({ ...prev, color_badge: c.hex }))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '999px',
                        border: catForm.color_badge === c.hex ? `2px solid ${c.hex}` : '1px solid #E2ECE8',
                        background: catForm.color_badge === c.hex ? `${c.hex}15` : '#FFFFFF',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#1C2A38'
                      }}
                    >
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: c.hex }} />
                      <span>{c.label}</span>
                      {catForm.color_badge === c.hex && <Check size={12} color={c.hex} strokeWidth={3} />}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="color"
                    value={catForm.color_badge}
                    onChange={e => setCatForm(prev => ({ ...prev, color_badge: e.target.value }))}
                    style={{ width: '36px', height: '36px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }}
                  />
                  <span style={{ fontSize: '13px', color: '#788A9B', fontWeight: '600' }}>
                    Código Hex: {catForm.color_badge}
                  </span>
                </div>
              </div>

              {/* Estado Activo */}
              <div style={{
                background: '#F8FAF9',
                border: '1px solid #EEF3F0',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '22px'
              }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#1C2A38' }}>
                    Estado de la Categoría
                  </div>
                  <div style={{ fontSize: '12px', color: '#788A9B' }}>
                    Si está inactiva, no aparecerá como filtro en el catálogo del POS.
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={catForm.estado === 1}
                    onChange={e => setCatForm(prev => ({ ...prev, estado: e.target.checked ? 1 : 0 }))}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: catForm.estado === 1 ? '#10B981' : '#788A9B' }}>
                    {catForm.estado === 1 ? 'Activa' : 'Inactiva'}
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
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
                  {editingCategory ? 'Guardar Cambios' : 'Crear Categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Crear / Editar Ocasión */}
      {showOccasionModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <PartyPopper size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1C2A38', margin: 0 }}>
                    {editingOccasion ? 'Editar Ocasión Especial' : 'Nueva Ocasión Especial'}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#788A9B' }}>
                    Celebración o momento para filtrar sorpresas.
                  </span>
                </div>
              </div>
              <button aria-label="Cerrar" onClick={() => setShowOccasionModal(false)} style={{ color: '#9EAFBF', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveOccasion}>
              <div className="form-group">
                <label className="form-label">Nombre de la Ocasión *</label>
                <div className="form-input-box">
                  <input
                    type="text"
                    required
                    placeholder="Ej. Cumpleaños, Graduación, San Valentín..."
                    value={occForm.nombre}
                    onChange={e => setOccForm(prev => ({ ...prev, nombre: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Icono o Emoji Identificador</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {PRESET_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setOccForm(prev => ({ ...prev, icono: emoji }))}
                      style={{
                        width: '38px',
                        height: '38px',
                        fontSize: '18px',
                        borderRadius: '10px',
                        border: occForm.icono === emoji ? '2px solid var(--primary)' : '1px solid #E2ECE8',
                        background: occForm.icono === emoji ? 'var(--primary-light)' : '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s'
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <div className="form-input-box" style={{ width: '120px' }}>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="Personalizado"
                    value={occForm.icono}
                    onChange={e => setOccForm(prev => ({ ...prev, icono: e.target.value }))}
                    style={{ textAlign: 'center', fontSize: '18px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '22px' }}>
                <button
                  type="button"
                  onClick={() => setShowOccasionModal(false)}
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
                  {editingOccasion ? 'Guardar Cambios' : 'Crear Ocasión'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar Eliminación */}
      {deleteConfirm && (
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
              ¿Eliminar {deleteConfirm.type === 'category' ? 'Categoría' : 'Ocasión'}?
            </h3>
            <p style={{ fontSize: '13.5px', color: '#788A9B', marginBottom: '22px', lineHeight: '1.5' }}>
              Estás a punto de eliminar <strong>"{deleteConfirm.item.nombre}"</strong>. Esta acción no se puede deshacer.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
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
                onClick={confirmDeleteAction}
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
