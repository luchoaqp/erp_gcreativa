import { imgSrc, thumbSrc, thumbFallback } from '../utils/img';
import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Heart, 
  Gift, 
  Truck, 
  Calendar, 
  Clock, 
  CreditCard, 
  CheckCircle2, 
  Printer, 
  X,
  FileText,
  Banknote
} from 'lucide-react';
import { productsAPI, categoriesAPI, ordersAPI } from '../api';
import DeliveryFields, { entregaPayload, emptyDelivery, sumCargos, useCharges } from '../components/DeliveryFields';
import { entregaLabel } from '../utils/entrega';
import { precioPorCantidad } from '../utils/precios';

const miniBtn = { fontSize: 11, fontWeight: 700, color: '#475569', background: '#F1F5F9', border: 0, borderRadius: 6, padding: '3px 8px', cursor: 'pointer' };
const miniIn = { fontSize: 12, border: '1.5px solid #D6E0DB', borderRadius: 6, padding: '3px 6px', width: 80, background: '#fff' };
const editBox = { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 5, background: '#F8FAFC', borderRadius: 8, padding: '6px 8px' };

export default function POS({ user, onOrderCreated, onGoToSales }) {
  const isAdmin = user?.rol === 'admin';
  const [editor, setEditor] = useState(null); // { id, kind: 'precio' | 'dto' } | { kind: 'dtoTotal' }
  const [dtoTotal, setDtoTotal] = useState({ tipo: 'monto', valor: '' });
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [occasions, setOccasions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedOccasion, setSelectedOccasion] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState('catalog'); // 'catalog' | 'cart'

  // Formulario de Dedicatoria y Entrega
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  // Entrega: recojo en tienda | por confirmar | envío (ciudad + cargos de embalaje/traslado)
  const [delivery, setDelivery] = useState(emptyDelivery());
  const [clienteVarios, setClienteVarios] = useState(false);
  const charges = useCharges();
  const [paymentMethod, setPaymentMethod] = useState('yape');
  // Adelanto: por porcentaje o por monto exacto
  const [advanceType, setAdvanceType] = useState('porcentaje');
  const [advanceValue, setAdvanceValue] = useState('50');
  
  const [formData, setFormData] = useState({
    clienteNombre: '',
    clienteTelefono: '',
    clienteEmail: '',
    notasTaller: ''
  });

  const [receiptData, setReceiptData] = useState(null);

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes] = await Promise.all([
        productsAPI.getAll(),
        categoriesAPI.getAll()
      ]);
      if (prodRes.success) setProducts(prodRes.products);
      if (catRes.success) {
        setCategories(catRes.categories || []);
        if (catRes.occasions) setOccasions(catRes.occasions);
      }
    } catch (err) {
      console.error('Error cargando catálogo POS:', err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product) => {
    setCart(prev => {
      const exists = prev.find(item => item.id === product.id);
      if (exists) {
        return prev.map(item => item.id === product.id ? { ...item, cantidad: (Number(item.cantidad) || 0) + 1 } : item);
      }
      return [...prev, { ...product, cantidad: 1, personalizacion: '' }];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = (Number(item.cantidad) || 0) + delta;
        return newQty > 0 ? { ...item, cantidad: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  // Cantidad escrita a mano (vacío mientras se edita; mínimo 1 al salir del campo)
  const setQuantity = (id, raw) => {
    if (raw === '') { setCart(prev => prev.map(i => i.id === id ? { ...i, cantidad: '' } : i)); return; }
    const n = Math.min(99999, Math.max(1, Math.floor(Number(raw) || 1)));
    setCart(prev => prev.map(i => i.id === id ? { ...i, cantidad: n } : i));
  };
  const fixQuantity = (id) => setCart(prev => prev.map(i => i.id === id && !(Number(i.cantidad) > 0) ? { ...i, cantidad: 1 } : i));

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const toggleAddon = (product) => {
    const exists = cart.find(item => item.id === product.id);
    if (exists) {
      removeFromCart(product.id);
    } else {
      addToCart(product);
    }
  };

  // Precio unitario aplicado: si el producto tiene precios por cantidad, depende de cuántas unidades lleva el carrito
  // Solo el administrador puede fijar un precio distinto al de la lista; si lo hace, deja de ajustarse por cantidad
  const unitPrice = (item) => (item.precio_manual !== undefined && item.precio_manual !== null && item.precio_manual !== '' ? Number(item.precio_manual) || 0 : precioPorCantidad(item, item.cantidad));
  const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const lineBruto = (item) => r2(unitPrice(item) * (Number(item.cantidad) || 0));
  const calcDto = (tipo, valor, base) => { const v = Math.max(0, Number(valor) || 0); return Math.min(base, r2(tipo === 'pct' ? base * Math.min(v, 100) / 100 : v)); };
  const lineDto = (item) => calcDto(item.dto_tipo, item.dto_valor, lineBruto(item));
  const bruto = r2(cart.reduce((acc, item) => acc + lineBruto(item), 0));
  const descLineas = r2(cart.reduce((acc, item) => acc + lineDto(item), 0));
  const descGlobal = calcDto(dtoTotal.tipo, dtoTotal.valor, r2(bruto - descLineas));
  const subtotal = r2(bruto - descLineas - descGlobal);
  const envioTotal = delivery.tipo_entrega === 'envio' ? sumCargos(delivery.cargos) : 0;
  const total = subtotal + envioTotal;
  const patchItem = (id, patch) => setCart(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
  const advanceRaw = advanceType === 'porcentaje' ? total * (Number(advanceValue) || 0) / 100 : (Number(advanceValue) || 0);
  const advanceAmount = Math.round(Math.min(total, Math.max(0, advanceRaw)) * 100) / 100;

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'all' || (p.categorias_ids || [p.categoria_id]).includes(Number(selectedCategory));
    const matchesOccasion = selectedOccasion === 'all' || p.ocasion_id === Number(selectedOccasion);
    const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.codigo.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesOccasion && matchesSearch;
  });

  const addonProducts = products.filter(p => p.codigo && p.codigo.startsWith('REG-ADD'));

  const handleProcessOrder = async (e) => {
    e.preventDefault();
    try {
      const orderPayload = {
        cliente: clienteVarios ? undefined : {
          nombre: formData.clienteNombre,
          telefono: formData.clienteTelefono,
          email: formData.clienteEmail
        },
        cliente_varios: clienteVarios,
        cliente_nombre: clienteVarios ? undefined : formData.clienteNombre,
        tipo_entrega: delivery.tipo_entrega,
        ciudad_envio: delivery.ciudad_envio,
        fecha_entrega: delivery.fecha_entrega,
        fecha_entrega_diseno: delivery.fecha_entrega_diseno || null,
        diseno_link: (delivery.diseno_link || '').trim() || undefined,
        diseno_foto: delivery.diseno_foto || undefined,
        diseno_links: ((delivery.diseno_links || []).filter((x) => (x.url || '').trim()).map((x) => ({ url: x.url.trim(), comentario: (x.comentario || '').trim() }))).length ? (delivery.diseno_links || []).filter((x) => (x.url || '').trim()).map((x) => ({ url: x.url.trim(), comentario: (x.comentario || '').trim() })) : undefined,
        franja_horaria: delivery.franja_horaria,
        ...entregaPayload(delivery),
        descuento_global: descGlobal,
        cargos: delivery.tipo_entrega === 'envio' ? delivery.cargos : [],
        metodo_pago: paymentMethod,
        adelanto_tipo: advanceType,
        adelanto_valor: Number(advanceValue) || 0,
        items: cart.map(item => ({
          producto_id: item.id,
          cantidad: Number(item.cantidad) || 1,
          precio_unitario: unitPrice(item),
          descuento: lineDto(item),
          proveedor_id: item.lote_id ? null : (item.proveedor_id ? Number(item.proveedor_id) : null),
          lote_id: item.lote_id ? Number(item.lote_id) : null,
          detalles_personalizacion: item.personalizacion || ''
        })),
        notas_taller: formData.notasTaller
      };

      const res = await ordersAPI.create(orderPayload);
      if (res.success) {
        setReceiptData({
          numero_pedido: res.numero_pedido,
          total: res.total,
          cliente: clienteVarios ? 'Cliente Varios' : formData.clienteNombre,
          entrega: (delivery.fecha_por_confirmar ? 'FECHA POR CONFIRMAR' : entregaLabel(delivery.fecha_entrega, delivery.tipo_entrega)) + (delivery.tipo_entrega === 'envio' ? ` · Envío a ${delivery.ciudad_envio}` : delivery.tipo_entrega === 'delivery' ? ' · Delivery' : ''),
          franja: delivery.fecha_por_confirmar ? '' : delivery.hora_por_confirmar ? 'Hora por confirmar' : delivery.franja_horaria,
          metodo_pago: paymentMethod,
          adelanto: res.adelanto,
          saldo: res.saldo,
          items: [...cart]
        });
        setDelivery(emptyDelivery());
        setClienteVarios(false);
        setFormData({ clienteNombre: '', clienteTelefono: '', clienteEmail: '', notasTaller: '' });
        setCart([]);
        setDtoTotal({ tipo: 'monto', valor: '' });
        setEditor(null);
        setShowCheckoutModal(false);
        setReceiptData(null);
        if (onOrderCreated) onOrderCreated();
        if (onGoToSales) onGoToSales();
      }
    } catch (err) {
      alert('Error procesando el pedido: ' + err.message);
    }
  };

  return (
    <div className="content-body animate-fade-in">
      {/* Selector de vistas para pantallas móviles y tablets pequeñas */}
      <div className="pos-mobile-tabs">
        <button 
          type="button"
          className={`pos-mobile-tab-btn ${mobileTab === 'catalog' ? 'active' : ''}`}
          onClick={() => setMobileTab('catalog')}
        >
          🎁 Catálogo ({filteredProducts.length})
        </button>
        <button 
          type="button"
          className={`pos-mobile-tab-btn ${mobileTab === 'cart' ? 'active' : ''}`}
          onClick={() => setMobileTab('cart')}
        >
          🛒 Detalle de Pedido ({cart.reduce((a, b) => a + (Number(b.cantidad) || 0), 0)}) • S/. {total.toFixed(2)}
        </button>
      </div>

      <div className="pos-layout">
        {/* Panel del Catálogo de Productos y Regalos con Recuadro Estilizado */}
        <div className={`pos-catalog ${mobileTab === 'cart' ? 'mobile-hidden' : ''}`}>
          {/* Cabecera del Catálogo */}
          <div className="pos-catalog-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="catalog-icon-badge">
                <Gift size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1C2A38', margin: 0 }}>
                  Catálogo de Regalos & Sorpresas
                </h2>
                <span style={{ fontSize: '12px', color: '#788A9B', fontWeight: '500' }}>
                  {filteredProducts.length} productos disponibles
                </span>
              </div>
            </div>

            <div className="catalog-search-box">
              <Search size={16} color="#9EAFBF" />
              <input 
                type="text" 
                placeholder="Buscar por nombre o código..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="catalog-search-input"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  style={{ color: '#9EAFBF', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                  title="Limpiar búsqueda"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* RECUADRO DE FILTROS & CATEGORÍAS (Diseño Visual Estilizado) */}
          <div className="catalog-filters-card">
            <div className="filter-row-header">
              <span className="filter-row-label">
                <span>📁 Categorías de Regalo</span>
                <span className="filter-count-badge">{categories.length + 1}</span>
              </span>
            </div>

            {/* Filtros de Categorías */}
            <div className="categories-bar">
              <button 
                className={`cat-chip ${selectedCategory === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                <span>Todos</span>
                <span className="cat-chip-badge">{products.length}</span>
              </button>
              {categories.map(cat => {
                const count = products.filter(p => (p.categorias_ids || [p.categoria_id]).includes(cat.id)).length;
                return (
                  <button 
                    key={cat.id} 
                    className={`cat-chip ${selectedCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    <span>{cat.nombre}</span>
                    <span className="cat-chip-badge">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Filtros de Ocasión */}
            {occasions.length > 0 && (
              <div className="occasions-substrip">
                <div className="occasions-bar">
                  <span className="occasion-tag-label">
                    🎉 Ocasión:
                  </span>
                  <button 
                    className={`occasion-chip ${selectedOccasion === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedOccasion('all')}
                  >
                    Todas las ocasiones
                  </button>
                  {occasions.map(occ => (
                    <button 
                      key={occ.id} 
                      className={`occasion-chip ${selectedOccasion === occ.id ? 'active' : ''}`}
                      onClick={() => setSelectedOccasion(occ.id)}
                    >
                      {occ.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Grid de Productos dentro del Recuadro del Catálogo */}
          {filteredProducts.length === 0 ? (
            <div className="catalog-empty-state">
              <Search size={38} color="#CBD5E1" />
              <p style={{ fontWeight: '700', fontSize: '15px', color: '#1C2A38', margin: 0 }}>
                No se encontraron regalos
              </p>
              <p style={{ fontSize: '12px', color: '#788A9B', margin: 0 }}>
                Intenta buscar con otra palabra clave o selecciona otra categoría.
              </p>
              <button 
                onClick={() => { setSelectedCategory('all'); setSelectedOccasion('all'); setSearchTerm(''); }}
                className="btn-primary"
                style={{ width: 'auto', padding: '6px 16px', fontSize: '12px', borderRadius: '999px', marginTop: '8px' }}
              >
                Restablecer Filtros
              </button>
            </div>
          ) : (
            <div className="products-grid">
              {filteredProducts.map(p => (
                <div 
                  key={p.id} 
                  className="product-pos-card"
                  onClick={() => addToCart(p)}
                >
                  <div className="product-pos-img-wrap">
                    <img src={imgSrc(p.imagen_url)} alt={p.nombre} className="product-pos-img" loading="lazy" decoding="async" />
                    <span className="product-sku-badge">
                      {p.codigo}
                    </span>
                    <button 
                      className="product-quick-add-btn" 
                      onClick={(e) => { e.stopPropagation(); addToCart(p); }}
                      title="Agregar al pedido"
                    >
                      <Plus size={16} strokeWidth={2.8} />
                    </button>
                  </div>

                  <div className="product-pos-body">
                    <div className="product-pos-title" title={p.nombre}>{p.nombre}</div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '6px' }}>
                      <div className="product-pos-price">S/. {Number(p.precio_venta).toFixed(2)}</div>
                      <span style={{
                        fontSize: '11px',
                        background: p.stock <= p.stock_minimo ? '#FEE2E2' : '#E8F5E9',
                        color: p.stock <= p.stock_minimo ? '#B91C1C' : '#2E7D32',
                        padding: '2px 7px',
                        borderRadius: '6px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: p.stock <= p.stock_minimo ? '#EF4444' : '#10B981' }}></span>
                        {p.stock} un.
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel del Carrito / Registro de Venta */}
        <div className={`pos-cart-panel ${mobileTab === 'catalog' ? 'mobile-hidden' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #EBF1EE', paddingBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingCart size={20} color="var(--primary)" />
              <span style={{ fontWeight: '700', fontSize: '17px' }}>Detalle de Pedido</span>
            </div>
            <span style={{ fontSize: '12px', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: '700', padding: '3px 9px', borderRadius: '999px' }}>
              {cart.reduce((a, b) => a + (Number(b.cantidad) || 0), 0)} ítems
            </span>
          </div>

          {cart.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#788A9B', gap: '10px' }}>
              <Gift size={44} strokeWidth={1.5} color="#CBD5E1" />
              <p style={{ fontSize: '13px', textAlign: 'center' }}>Selecciona los regalos o sorpresas del catálogo para iniciar el pedido.</p>
            </div>
          ) : (
            <div className="cart-items-scroll">
              {cart.map(item => (
                <div key={item.id} className="cart-item">
                  <img src={thumbSrc(item.imagen_url)} onError={thumbFallback(item.imagen_url)} alt="" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#1C2A38', lineHeight: '1.2' }}>{item.nombre}</div>
                    <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '700', marginTop: '2px' }}>
                      {lineDto(item) > 0 && <span style={{ color: '#94A3B8', textDecoration: 'line-through', marginRight: 6, fontWeight: 600 }}>S/. {lineBruto(item).toFixed(2)}</span>}
                      S/. {(lineBruto(item) - lineDto(item)).toFixed(2)}{unitPrice(item) !== Number(item.precio_venta) && <span style={{ fontSize: '10.5px', color: '#10B981', marginLeft: '6px' }}>S/. {unitPrice(item).toFixed(2)} c/u</span>}
                      {item.precio_manual !== undefined && item.precio_manual !== null && <span style={{ fontSize: '10px', color: '#B45309', marginLeft: 6 }}>precio editado</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {isAdmin && <button type="button" onClick={() => setEditor(editor?.id === item.id && editor.kind === 'precio' ? null : { id: item.id, kind: 'precio' })} style={miniBtn}>✎ Precio</button>}
                      <button type="button" onClick={() => setEditor(editor?.id === item.id && editor.kind === 'dto' ? null : { id: item.id, kind: 'dto' })} style={miniBtn}>% Descuento{lineDto(item) > 0 ? ` (−${lineDto(item).toFixed(2)})` : ''}</button>
                    </div>
                    {editor?.id === item.id && editor.kind === 'precio' && isAdmin && (
                      <div style={editBox}>
                        <span style={{ fontSize: 11 }}>Precio unitario S/.</span>
                        <input type="number" min="0" step="0.01" autoFocus style={miniIn} value={item.precio_manual ?? unitPrice(item)} onChange={e => patchItem(item.id, { precio_manual: e.target.value })} />
                        {item.precio_manual !== undefined && item.precio_manual !== null && <button type="button" style={{ ...miniBtn, color: '#B45309' }} onClick={() => patchItem(item.id, { precio_manual: null })}>Restaurar automático</button>}
                      </div>
                    )}
                    {editor?.id === item.id && editor.kind === 'dto' && (
                      <div style={editBox}>
                        <select style={miniIn} value={item.dto_tipo || 'monto'} onChange={e => patchItem(item.id, { dto_tipo: e.target.value })}><option value="monto">S/.</option><option value="pct">%</option></select>
                        <input type="number" min="0" step="0.01" autoFocus style={miniIn} placeholder="0" value={item.dto_valor ?? ''} onChange={e => patchItem(item.id, { dto_valor: e.target.value })} />
                        {lineDto(item) > 0 && <button type="button" style={{ ...miniBtn, color: '#B91C1C' }} onClick={() => patchItem(item.id, { dto_valor: '' })}>Quitar</button>}
                      </div>
                    )}
                  </div>
                  {(item.lotes || []).length > 1 && (
                    <select
                      value={item.lote_id || ''} aria-label="Lote del stock"
                      onChange={e => setCart(prev => prev.map(i => i.id === item.id ? { ...i, lote_id: e.target.value } : i))}
                      title="De qué lote sale este producto (define el costo real y el margen de la venta). Automático = el lote más antiguo."
                      style={{ fontSize: '11px', maxWidth: '150px', border: '1.5px solid #D6E0DB', borderRadius: '8px', padding: '3px 4px', background: '#fff' }}
                    >
                      <option value="">Lote: automático (más antiguo)</option>
                      {item.lotes.map(l => <option key={l.id} value={l.id}>{`${l.codigo || 'Lote'} · ${l.proveedor} · ${l.stock} u. · S/ ${Number(l.costo_unit).toFixed(2)}`}</option>)}
                    </select>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={() => updateQuantity(item.id, -1)} style={{ width: '24px', height: '24px', background: '#F1F5F3', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Minus size={12} />
                    </button>
                    <input
                      type="number" min="1" inputMode="numeric" value={item.cantidad} aria-label={`Cantidad de ${item.nombre}`}
                      onChange={e => setQuantity(item.id, e.target.value)}
                      onBlur={() => fixQuantity(item.id)}
                      onFocus={e => e.target.select()}
                      style={{ width: '46px', textAlign: 'center', fontSize: '13px', fontWeight: '700', border: '1.5px solid #D6E0DB', borderRadius: '8px', padding: '3px 2px', background: '#fff' }}
                    />
                    <button onClick={() => updateQuantity(item.id, 1)} style={{ width: '24px', height: '24px', background: '#F1F5F3', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Plus size={12} />
                    </button>
                    <button onClick={() => removeFromCart(item.id)} style={{ color: '#EF4444', marginLeft: '4px' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Resumen Totales */}
          <div style={{ borderTop: '1px solid #EBF1EE', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#788A9B' }}>
              <span>Subtotal Productos:</span>
              <span>S/. {bruto.toFixed(2)}</span>
            </div>
            {descLineas > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#B91C1C' }}>
                <span>Descuentos por producto:</span><span>− S/. {descLineas.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: descGlobal > 0 ? '#B91C1C' : '#788A9B' }}>
              <button type="button" onClick={() => setEditor(editor?.kind === 'dtoTotal' ? null : { kind: 'dtoTotal' })} style={miniBtn}>% Descuento al total</button>
              <span>{descGlobal > 0 ? `− S/. ${descGlobal.toFixed(2)}` : ''}</span>
            </div>
            {editor?.kind === 'dtoTotal' && (
              <div style={editBox}>
                <select style={miniIn} value={dtoTotal.tipo} onChange={e => setDtoTotal({ ...dtoTotal, tipo: e.target.value })}><option value="monto">S/.</option><option value="pct">%</option></select>
                <input type="number" min="0" step="0.01" autoFocus style={miniIn} placeholder="0" value={dtoTotal.valor} onChange={e => setDtoTotal({ ...dtoTotal, valor: e.target.value })} />
                {descGlobal > 0 && <button type="button" style={{ ...miniBtn, color: '#B91C1C' }} onClick={() => setDtoTotal({ ...dtoTotal, valor: '' })}>Quitar</button>}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#788A9B' }}>
              <span>Envío / cargos:</span>
              <span>{delivery.tipo_entrega === 'envio' ? `S/. ${envioTotal.toFixed(2)}` : 'S/. 0.00'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '800', color: '#1C2A38', marginTop: '4px' }}>
              <span>Total a Cobrar:</span>
              <span style={{ color: 'var(--primary)' }}>S/. {total.toFixed(2)}</span>
            </div>

            <button 
              disabled={cart.length === 0}
              onClick={() => setShowCheckoutModal(true)}
              className="btn-primary"
              style={{ marginTop: '10px' }}
            >
              <Banknote size={18} />
              <span>Continuar pedido</span>
            </button>
          </div>
        </div>
      </div>

      {/* Botón flotante móvil para acceder al Carrito cuando hay items */}
      {cart.length > 0 && mobileTab === 'catalog' && (
        <div 
          className="pos-floating-cart-bar"
          onClick={() => setMobileTab('cart')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'var(--primary)',
              color: '#FFFFFF',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '800',
              fontSize: '13px'
            }}>
              {cart.reduce((a, b) => a + (Number(b.cantidad) || 0), 0)}
            </div>
            <div>
              <div style={{ fontSize: '11px', opacity: 0.85 }}>Ver Detalle del Pedido</div>
              <div style={{ fontSize: '15px', fontWeight: '800' }}>S/. {total.toFixed(2)}</div>
            </div>
          </div>
          <button 
            type="button"
            style={{
              background: 'var(--primary)',
              color: '#FFFFFF',
              padding: '7px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Ver Pedido ➔
          </button>
        </div>
      )}

      {/* Modal de Personalización, Dedicatoria y Entrega */}
      {showCheckoutModal && (
        <div className="modal-overlay" data-noguard>
          <div className="modal-content animate-fade-in" style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #EBF1EE', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={22} color="var(--primary)" />
                <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Datos del Pedido & Entrega</h3>
              </div>
              <button onClick={() => setShowCheckoutModal(false)} style={{ color: '#788A9B' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleProcessOrder}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, marginBottom: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={clienteVarios} onChange={(e) => setClienteVarios(e.target.checked)} />
                Cliente Varios (venta sin datos del cliente)
              </label>
              <div className="modal-form-grid-2" style={clienteVarios ? { opacity: 0.45, pointerEvents: 'none' } : undefined}>
                <div>
                  <label className="form-label">Nombre del Cliente (Comprador)</label>
                  <div className="form-input-box">
                    <input 
                      type="text" 
                      value={formData.clienteNombre}
                      onChange={e => setFormData({ ...formData, clienteNombre: e.target.value })}
                      required={!clienteVarios}
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label">Teléfono del Comprador</label>
                  <div className="form-input-box">
                    <input 
                      type="text" 
                      value={formData.clienteTelefono}
                      onChange={e => setFormData({ ...formData, clienteTelefono: e.target.value })}
                      required={!clienteVarios}
                    />
                  </div>
                </div>
              </div>

              {/* Entrega: tipo, ciudad, fecha, horario y cargos */}
              <div style={{ marginBottom: '16px' }}>
                <DeliveryFields value={delivery} onChange={setDelivery} charges={charges} chargesMode="envio" sym="S/." showDesign={false} />
              </div>

              {/* Selección de Adicionales para el Regalo */}
              {addonProducts.length > 0 && (
                <div style={{ marginBottom: '18px', background: '#F8FAF9', borderRadius: '12px', padding: '14px', border: '1px solid #E2ECE8' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#1C2A38', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>✨ Adicionales para el regalo (Globos, chocolates, polaroid):</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {addonProducts.map(addon => {
                      const inCart = cart.some(item => item.id === addon.id);
                      return (
                        <div 
                          key={addon.id}
                          onClick={() => toggleAddon(addon)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            background: inCart ? '#FFF3EE' : '#FFFFFF',
                            border: inCart ? '1.5px solid var(--primary)' : '1px solid #E2ECE8',
                            cursor: 'pointer',
                            userSelect: 'none',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#1C2A38' }}>{addon.nombre}</div>
                            <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700' }}>+ S/. {Number(addon.precio_venta).toFixed(2)}</div>
                          </div>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            background: inCart ? 'var(--primary)' : '#F1F5F3',
                            color: inCart ? '#FFFFFF' : '#788A9B',
                            padding: '3px 8px',
                            borderRadius: '999px'
                          }}>
                            {inCart ? '✓ Añadido' : '+ Añadir'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="modal-form-grid-2">
                <div>
                  <label className="form-label">Notas para el taller (opcional)</label>
                  <div className="form-input-box">
                    <textarea
                      rows={3}
                      value={formData.notasTaller}
                      onChange={e => setFormData({ ...formData, notasTaller: e.target.value })}
                      placeholder="Ej: lazo dorado, globo con helio (Enter = nueva línea)"
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label">Método de Pago</label>
                  <div className="form-input-box">
                    <select 
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', fontWeight: '600' }}
                    >
                      <option value="yape">💜 Yape (App Móvil)</option>
                      <option value="plin">💙 Plin</option>
                      <option value="tarjeta">💳 Tarjeta Débito/Crédito</option>
                      <option value="efectivo">💵 Efectivo</option>
                      <option value="transferencia">🏦 Transferencia Bancaria</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Adelanto del cliente: porcentaje o monto exacto */}
              <div style={{ marginTop: '14px', background: '#FFF8F5', border: '1px solid #FFE1D6', borderRadius: '12px', padding: '12px 14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#1C2A38', marginBottom: '8px' }}>💰 Adelanto del cliente</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    value={advanceType}
                    onChange={e => { setAdvanceType(e.target.value); setAdvanceValue(e.target.value === 'porcentaje' ? '50' : ''); }}
                    style={{ padding: '8px 10px', borderRadius: '10px', border: '1px solid #E2E8F0', fontWeight: '600' }}
                  >
                    <option value="porcentaje">Porcentaje (%)</option>
                    <option value="monto">Monto exacto (S/.)</option>
                  </select>
                  <input
                    type="number" min="0" step="0.01"
                    value={advanceValue}
                    onChange={e => setAdvanceValue(e.target.value)}
                    style={{ width: '100px', padding: '8px 10px', borderRadius: '10px', border: '1px solid #E2E8F0' }}
                  />
                  {advanceType === 'porcentaje' && [50, 75, 100].map(pct => (
                    <button
                      key={pct} type="button" onClick={() => setAdvanceValue(String(pct))}
                      style={{ padding: '6px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '700', border: '1px solid #FFD7CB', background: Number(advanceValue) === pct ? 'var(--primary)' : '#fff', color: Number(advanceValue) === pct ? '#fff' : 'var(--primary)' }}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '13px', marginTop: '8px', color: '#475569' }}>
                  Adelanto a cobrar ahora: <strong style={{ color: 'var(--primary)' }}>S/. {advanceAmount.toFixed(2)}</strong>
                  {' · '}Saldo pendiente: <strong>S/. {(total - advanceAmount).toFixed(2)}</strong>
                </div>
                <div style={{ fontSize: '11.5px', color: '#788A9B', marginTop: '4px' }}>
                  El saldo se cobra en el módulo Ventas; el pedido no puede salir a ruta hasta quedar pagado. El stock se descuenta al generar el comprobante.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', borderTop: '1px solid #EBF1EE', paddingTop: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#788A9B' }}>Total con Entrega:</div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--primary)' }}>S/. {total.toFixed(2)}</div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setShowCheckoutModal(false)} style={{ padding: '12px 20px', borderRadius: '12px', background: '#F1F5F3', fontWeight: '600', color: '#788A9B' }}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary" style={{ width: 'auto' }}>
                    <CheckCircle2 size={18} />
                    <span>Confirmar y generar venta</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Ticket y Boleta Generada */}
      {receiptData && (
        <div className="modal-overlay" data-noguard>
          <div className="modal-content animate-fade-in" style={{ maxWidth: '460px', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#E8F5E9', color: '#2E7D32', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <CheckCircle2 size={32} />
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>¡Venta Registrada con Éxito!</h3>
            <p style={{ fontSize: '13px', color: '#788A9B', marginBottom: '16px' }}>Pedido #{receiptData.numero_pedido}</p>

            <div style={{ background: '#F8FAF9', border: '1px dashed #CBD5E1', borderRadius: '14px', padding: '16px', textAlign: 'left', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#788A9B' }}>Cliente:</span>
                <strong>{receiptData.cliente}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                <span style={{ color: '#788A9B' }}>Entrega:</span>
                <span style={{ textAlign: 'right' }}>{receiptData.entrega}{receiptData.franja ? ` (${receiptData.franja})` : ''}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#788A9B' }}>Método de Pago:</span>
                <strong style={{ textTransform: 'uppercase' }}>{receiptData.metodo_pago}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E2ECE8', paddingTop: '8px', fontSize: '16px', fontWeight: '800' }}>
                <span>Total del pedido:</span>
                <span style={{ color: 'var(--primary)' }}>S/. {Number(receiptData.total).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#788A9B' }}>Adelanto cobrado:</span>
                <strong>S/. {Number(receiptData.adelanto || 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#788A9B' }}>Saldo pendiente:</span>
                <strong style={{ color: Number(receiptData.saldo || 0) > 0 ? '#B45309' : '#047857' }}>S/. {Number(receiptData.saldo || 0).toFixed(2)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => window.print()}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', background: '#F1F5F3', fontWeight: '600', color: '#1C2A38' }}
              >
                <Printer size={16} />
                <span>Imprimir</span>
              </button>
              <button 
                onClick={() => setReceiptData(null)}
                className="btn-primary"
                style={{ flex: 1 }}
              >
                Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
