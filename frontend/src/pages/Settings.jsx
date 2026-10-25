import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Coins, 
  Truck, 
  Save, 
  CheckCircle2, 
  Store, 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  Image as ImageIcon, 
  FileText, 
  DollarSign, 
  Plus, 
  Trash2, 
  Database,
  Sparkles,
  ArrowRight,
  Upload,
  Eye,
  EyeOff,
  Pencil,
  Check
} from 'lucide-react';
import { settingsAPI } from '../api';
import DocConfigPanel from '../components/DocInfoFields';
import { applyTheme, applySidebar, sidebarFromSettings, PRESETS, DEFAULT_PRIMARY } from '../utils/theme';

export default function Settings({ onNavigateBackup, onSaved }) {
  const [activeTab, setActiveTab] = useState('empresa');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Datos de Configuración
  const [settings, setSettings] = useState({
    nombre_tienda: 'Genia Creativa',
    ruc: '20608945123',
    slogan: 'Momentos inolvidables que llegan al corazón',
    telefono_whatsapp: '+51 987 654 321',
    telefono_fijo: '(01) 456-7890',
    email_contacto: 'contacto@regalodeensueno.com',
    direccion: 'Av. Las Flores 450, Centro',
    horario_atencion: 'Lunes a Sábado: 8:00 AM - 8:00 PM',
    logo_url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=200&auto=format&fit=crop&q=80',
    moneda_simbolo: 'S/.',
    moneda_codigo: 'PEN',
    separador_decimales: '.',
    separador_miles: ',',
    costo_delivery_base: 12.00,
    zonas_reparto: '[{"zona":"San Isidro / Miraflores","costo":12},{"zona":"Surco / San Borja","costo":15},{"zona":"La Molina / Barranco","costo":18},{"zona":"Centro de Lima / Jesús María","costo":14}]',
    mensaje_whatsapp_plantilla: '¡Hola {cliente}! Tu sorpresa para {destinatario} con número de pedido #{pedido} ya está en camino 🎁✨',
    pie_ticket: '¡Gracias por confiar en nosotros para hacer inolvidable este momento mágico! 🎁✨'
  });

  const [parsedZonas, setParsedZonas] = useState([]);
  const [newZonaName, setNewZonaName] = useState('');
  const [newZonaCosto, setNewZonaCosto] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await settingsAPI.get();
      if (res.success && res.settings) {
        setSettings(res.settings);
        let zs = [];
        try {
          const zonas = typeof res.settings.zonas_reparto === 'string' 
            ? JSON.parse(res.settings.zonas_reparto) 
            : (res.settings.zonas_reparto || []);
          zs = Array.isArray(zonas) ? zonas : [];
        } catch (e) {
          zs = [];
        }
        setParsedZonas(zs);
        savedSig.current = JSON.stringify({ s: res.settings, z: zs });
        loadedOk.current = true;
      }
    } catch (err) {
      console.error('Error cargando configuración:', err);
    } finally {
      setLoading(false);
    }
  };

  const setSb = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    applySidebar(sidebarFromSettings(next));
  };

  // Control de cambios sin guardar
  const savedSig = useRef('');
  const loadedOk = useRef(false);
  const latest = useRef({});
  latest.current = { settings, parsedZonas };
  const dirty = loadedOk.current && JSON.stringify({ s: settings, z: parsedZonas }) !== savedSig.current;

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...settings,
        zonas_reparto: JSON.stringify(parsedZonas)
      };
      const res = await settingsAPI.update(payload);
      // Se vuelve a leer lo guardado en la base de datos: lo que ves es lo que quedó guardado
      await loadSettings();
      if (res && res.settings) onSaved && onSaved(res.settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      alert('Error guardando configuración: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Si sales de Configuración con cambios sin guardar, se guardan automáticamente (evita perder datos)
  useEffect(() => () => {
    const { settings: st, parsedZonas: zs } = latest.current;
    if (loadedOk.current && JSON.stringify({ s: st, z: zs }) !== savedSig.current) {
      settingsAPI.update({ ...st, zonas_reparto: JSON.stringify(zs) }).then((r) => { if (r && r.settings) onSaved && onSaved(r.settings); }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Aviso del navegador si cierra la pestaña con cambios sin guardar
  useEffect(() => {
    const h = (e) => { if (loadedOk.current && JSON.stringify({ s: latest.current.settings, z: latest.current.parsedZonas }) !== savedSig.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  // Subida del logotipo: se reduce a máx. 360 px y se guarda en la base de datos
  const handleLogoFile = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('La imagen no puede pesar más de 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, 360 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.width * scale));
        cv.height = Math.max(1, Math.round(img.height * scale));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        setSettings((prev) => ({ ...prev, logo_url: cv.toDataURL('image/png') }));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  // Manejo de cargos (embalaje, traslado a agencia)
  const addZona = () => {
    if (!newZonaName.trim() || !newZonaCosto) return;
    setParsedZonas([...parsedZonas, { zona: newZonaName.trim(), costo: Number(newZonaCosto) }]);
    setNewZonaName('');
    setNewZonaCosto('');
  };

  const [editZona, setEditZona] = useState(null); // { idx, nombre }
  const toggleZona = (index) => setParsedZonas(parsedZonas.map((z, i) => (i === index ? { ...z, visible: z.visible === false } : z)));
  const renameZona = () => {
    if (editZona && editZona.nombre.trim()) setParsedZonas(parsedZonas.map((z, i) => (i === editZona.idx ? { ...z, zona: editZona.nombre.trim() } : z)));
    setEditZona(null);
  };
  const removeZona = (index) => {
    setParsedZonas(parsedZonas.filter((_, i) => i !== index));
  };

  // Función para formatear número de ejemplo
  const formatExampleNumber = (number) => {
    const dec = settings.separador_decimales || '.';
    const mil = settings.separador_miles || ',';
    const parts = number.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, mil);
    return `${settings.moneda_simbolo || 'S/.'} ${parts.join(dec)}`;
  };

  const tabs = [
    { id: 'empresa', label: 'Empresa & Identidad', icon: Building2 },
    { id: 'moneda', label: 'Moneda & Formato Numérico', icon: Coins },
    { id: 'delivery', label: 'Cargos de Envío & Embalaje', icon: Truck },
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'apariencia', label: 'Apariencia', icon: Sparkles },
  ];

  return (
    <div className="content-body animate-fade-in" style={{ paddingBottom: '50px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Building2 size={24} color="var(--primary)" />
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1C2A38', margin: 0 }}>
              Configuración de la Empresa
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: '#788A9B', marginTop: '4px' }}>
            Personaliza los datos fiscales de tu negocio, logotipo, moneda regional y tarifas de despacho.
          </p>
        </div>

        <button 
          onClick={handleSaveSettings}
          disabled={saving}
          className="btn-primary" 
          style={{ width: 'auto', padding: '10px 24px', borderRadius: '12px', fontSize: '14px' }}
        >
          <Save size={18} />
          <span>{saving ? 'Guardando Cambios...' : dirty ? 'Guardar Cambios (pendientes)' : 'Guardar Cambios'}</span>
        </button>
      </div>

      {/* Banner de acceso directo al módulo de Copia de Seguridad */}
      {onNavigateBackup && (
        <div style={{
          background: 'linear-gradient(135deg, #FFF7F5 0%, #FFF0EB 100%)',
          border: '1px solid #FFD8CC',
          borderRadius: '16px',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database size={20} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#1C2A38' }}>
                ¿Deseas respaldar o reiniciar el sistema para una nueva empresa?
              </div>
              <div style={{ fontSize: '12px', color: '#788A9B' }}>
                Accede al módulo dedicado de Copias de Seguridad para descargar tu respaldo o hacer un reseteo de fábrica.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateBackup}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              background: 'var(--primary)',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>Ir a Copia de Seguridad</span>
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {dirty && !saving && (
        <div style={{ position: 'sticky', top: 8, zIndex: 20, background: '#FFF7ED', border: '1px solid #FDBA74', color: '#9A3412', padding: '10px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
          <span>Tienes cambios sin guardar.</span>
          <button type="button" onClick={handleSaveSettings} className="btn-primary" style={{ width: 'auto', padding: '6px 16px', borderRadius: 10, fontSize: 13 }}>Guardar ahora</button>
        </div>
      )}

      {saveSuccess && (
        <div style={{ 
          background: '#E8F5E9', 
          color: '#2E7D32', 
          padding: '12px 18px', 
          borderRadius: '12px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          marginBottom: '20px', 
          fontWeight: '600',
          fontSize: '13px',
          boxShadow: '0 2px 8px rgba(46, 125, 50, 0.1)'
        }}>
          <CheckCircle2 size={18} />
          <span>¡Configuración actualizada y aplicada exitosamente!</span>
        </div>
      )}

      {/* Tabs Selector */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        borderBottom: '1px solid #E2ECE8', 
        paddingBottom: '12px', 
        marginBottom: '24px',
        overflowX: 'auto'
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: isActive ? '700' : '600',
                background: isActive ? 'var(--primary-light)' : '#FFFFFF',
                color: isActive ? 'var(--primary)' : '#5A6E82',
                border: isActive ? '1.5px solid var(--primary)' : '1px solid #E2ECE8',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={17} color={isActive ? 'var(--primary)' : '#788A9B'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: DATOS DE LA EMPRESA & LOGO */}
      {activeTab === 'empresa' && (
        <div className="settings-grid-2col">
          {/* Formulario Principal de Datos de Empresa */}
          <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #EEF3F0', padding: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1C2A38', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Store size={20} color="var(--primary)" />
              <span>Información Comercial y Fiscal</span>
            </h3>

            <div className="settings-form-row-2">
              <div>
                <label className="form-label">Nombre Comercial de la Empresa *</label>
                <div className="form-input-box">
                  <Store size={18} color="#9EAFBF" />
                  <input 
                    type="text" 
                    value={settings.nombre_tienda || ''}
                    onChange={e => setSettings({ ...settings, nombre_tienda: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">RUC / Identificación Fiscal</label>
                <div className="form-input-box">
                  <FileText size={18} color="#9EAFBF" />
                  <input 
                    type="text" 
                    value={settings.ruc || ''}
                    onChange={e => setSettings({ ...settings, ruc: e.target.value })}
                    placeholder="Ej. 20608945123"
                  />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">Slogan o Lema Comercial</label>
              <div className="form-input-box">
                <Sparkles size={18} color="#9EAFBF" />
                <input 
                  type="text" 
                  value={settings.slogan || ''}
                  onChange={e => setSettings({ ...settings, slogan: e.target.value })}
                  placeholder="Ej. Detalles inolvidables que llegan al corazón"
                />
              </div>
            </div>

            <div className="settings-form-row-2">
              <div>
                <label className="form-label">WhatsApp de Atención & Pedidos *</label>
                <div className="form-input-box">
                  <Phone size={18} color="#9EAFBF" />
                  <input 
                    type="text" 
                    value={settings.telefono_whatsapp || ''}
                    onChange={e => setSettings({ ...settings, telefono_whatsapp: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Teléfono Fijo / Central</label>
                <div className="form-input-box">
                  <Phone size={18} color="#9EAFBF" />
                  <input 
                    type="text" 
                    value={settings.telefono_fijo || ''}
                    onChange={e => setSettings({ ...settings, telefono_fijo: e.target.value })}
                    placeholder="(01) 456-7890"
                  />
                </div>
              </div>
            </div>

            <div className="settings-form-row-2">
              <div>
                <label className="form-label">Correo Electrónico Corporativo</label>
                <div className="form-input-box">
                  <Mail size={18} color="#9EAFBF" />
                  <input 
                    type="email" 
                    value={settings.email_contacto || ''}
                    onChange={e => setSettings({ ...settings, email_contacto: e.target.value })}
                    placeholder="contacto@empresa.com"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Horario de Atención al Público</label>
                <div className="form-input-box">
                  <Clock size={18} color="#9EAFBF" />
                  <input 
                    type="text" 
                    value={settings.horario_atencion || ''}
                    onChange={e => setSettings({ ...settings, horario_atencion: e.target.value })}
                    placeholder="Lun - Sáb: 8:00 AM - 8:00 PM"
                  />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">Dirección del Local / Taller Principal</label>
              <div className="form-input-box">
                <MapPin size={18} color="#9EAFBF" />
                <input 
                  type="text" 
                  value={settings.direccion || ''}
                  onChange={e => setSettings({ ...settings, direccion: e.target.value })}
                  placeholder="Av. El Sol 124, Miraflores"
                  required
                />
              </div>
            </div>
          </div>

          {/* Logo y Branding */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #EEF3F0', padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1C2A38', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ImageIcon size={20} color="var(--primary)" />
                <span>Logotipo de la Empresa</span>
              </h3>

              <p style={{ fontSize: '12px', color: '#788A9B', marginBottom: '16px' }}>
                Se muestra en la barra lateral del sistema, pedidos, cotizaciones y comprobantes (no en tickets de 80 mm).
              </p>

              {/* Previsualización del Logo */}
              <div style={{ 
                width: '100%', 
                height: '140px', 
                borderRadius: '14px', 
                background: '#F8FAF9', 
                border: '2px dashed #CBD5E1', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                overflow: 'hidden',
                marginBottom: '16px',
                position: 'relative'
              }}>
                {settings.logo_url ? (
                  <img 
                    src={settings.logo_url} 
                    alt="Logo preview" 
                    style={{ maxHeight: '110px', maxWidth: '85%', objectFit: 'contain' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: '#94A3B8' }}>
                    <ImageIcon size={38} strokeWidth={1.5} />
                    <div style={{ fontSize: '12px', marginTop: '6px' }}>Sin logotipo configurado</div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <label className="btn-primary" style={{ width: 'auto', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px' }}>
                  <Upload size={16} />
                  <span>{settings.logo_url ? 'Cambiar logotipo' : 'Subir logotipo'}</span>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleLogoFile(e.target.files[0])} />
                </label>
                {settings.logo_url && (
                  <button type="button" onClick={() => setSettings({ ...settings, logo_url: '' })}
                    style={{ padding: '10px 14px', borderRadius: '10px', background: '#FEF2F2', color: '#B91C1C', fontWeight: '700', fontSize: '13px' }}>
                    Quitar
                  </button>
                )}
              </div>
              <p style={{ fontSize: '11.5px', color: '#788A9B', marginTop: '10px' }}>
                PNG, JPG o SVG. Aparece en pedidos, cotizaciones y comprobantes (A4 / A5). Los tickets de 80 mm van sin logotipo.
                Recuerda pulsar “Guardar” para aplicar el cambio.
              </p>
            </div>

            {/* Tarjeta de Resumen Comercial */}
            <div style={{ background: 'linear-gradient(135deg, #FFF6F3 0%, #FFEFEA 100%)', borderRadius: '16px', border: '1px solid #FFD8CC', padding: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)', marginBottom: '6px' }}>
                ✨ Vista Previa en Cabecera
              </div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#1C2A38' }}>
                {settings.nombre_tienda || 'Tu Tienda'}
              </div>
              <div style={{ fontSize: '12px', color: '#788A9B', fontStyle: 'italic', marginTop: '2px' }}>
                "{settings.slogan || 'Slogan de tu negocio'}"
              </div>
              <div style={{ fontSize: '11px', color: '#5A6E82', marginTop: '8px' }}>
                📍 {settings.direccion || 'Dirección no configurada'} • 📞 {settings.telefono_whatsapp}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MONEDA & FORMATO NUMÉRICO */}
      {activeTab === 'documentos' && <DocConfigPanel store={settings} />}

      {activeTab === 'apariencia' && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EEF3F0', padding: 24, maxWidth: 760 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>Color principal de la aplicación</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#788A9B' }}>
            Cambia el color del menú, botones y resaltados. Se ve al instante como vista previa; pulsa "Guardar" para que quede para todos los usuarios.
            El color de los documentos impresos se cambia en la pestaña "Documentos".
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            {PRESETS.map((x) => {
              const on = (settings.color_principal || DEFAULT_PRIMARY).toLowerCase() === x.hex.toLowerCase();
              return (
                <button type="button" key={x.hex} onClick={() => { setSettings({ ...settings, color_principal: x.hex }); applyTheme(x.hex); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 12, cursor: 'pointer', background: '#fff', fontWeight: 700, fontSize: 13,
                    border: on ? `2px solid ${x.hex}` : '1px solid #E2E8F0' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 999, background: x.hex, display: 'inline-block' }} /> {x.name}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 700 }}>Color personalizado</label>
            <input type="color" value={settings.color_principal || DEFAULT_PRIMARY}
              onChange={(e) => { setSettings({ ...settings, color_principal: e.target.value }); applyTheme(e.target.value); }}
              style={{ width: 54, height: 38, padding: 2, border: '1px solid #E2E8F0', borderRadius: 8 }} />
            <button type="button" onClick={() => { setSettings({ ...settings, color_principal: DEFAULT_PRIMARY }); applyTheme(DEFAULT_PRIMARY); }}
              style={{ border: 0, background: 'none', color: '#4F8EF7', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Volver al naranja original</button>
          </div>
          <hr style={{ border: 0, borderTop: '1px solid #EEF3F0', margin: '22px 0' }} />
          <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>Menú lateral</h3>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#788A9B' }}>
            Si no eliges nada, el menú usa el color principal con texto blanco. Elige un fondo oscuro con texto claro, o un fondo claro con texto oscuro; la vista previa es inmediata.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
            {[
              ['sidebar_bg', 'Color de fondo', DEFAULT_PRIMARY],
              ['sidebar_texto', 'Color de texto e iconos', '#FFFFFF'],
              ['sidebar_activo_bg', 'Fondo de la opción activa', '#FFFFFF'],
              ['sidebar_activo_texto', 'Texto de la opción activa', DEFAULT_PRIMARY]
            ].map(([k, label, def]) => (
              <div key={k}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>{label}</label>
                <input type="color" value={settings[k] || (k === 'sidebar_bg' || k === 'sidebar_activo_texto' ? (settings.color_principal || def) : def)}
                  onChange={(e) => setSb({ [k]: e.target.value })}
                  style={{ width: 54, height: 38, padding: 2, border: '1px solid #E2E8F0', borderRadius: 8 }} />
                {settings[k] && <button type="button" onClick={() => setSb({ [k]: '' })} style={{ marginLeft: 6, border: 0, background: 'none', color: '#4F8EF7', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Automático</button>}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {[
              ['Oscuro elegante', { sidebar_bg: '#1E293B', sidebar_texto: '#E2E8F0', sidebar_activo_bg: '#FFFFFF', sidebar_activo_texto: '#1E293B' }],
              ['Claro', { sidebar_bg: '#FFFFFF', sidebar_texto: '#334155', sidebar_activo_bg: '#F1F5F9', sidebar_activo_texto: '#0F172A' }],
              ['Negro', { sidebar_bg: '#0F172A', sidebar_texto: '#F8FAFC', sidebar_activo_bg: '#FFFFFF', sidebar_activo_texto: '#0F172A' }],
              ['Restablecer menú', { sidebar_bg: '', sidebar_texto: '', sidebar_activo_bg: '', sidebar_activo_texto: '' }]
            ].map(([n, v]) => (
              <button type="button" key={n} onClick={() => setSb(v)}
                style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{n}</button>
            ))}
          </div>
          <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button type="button" className="btn-primary" style={{ width: 'auto', padding: '10px 22px', borderRadius: 12 }} onClick={handleSaveSettings} disabled={saving}>
              {saving ? 'Guardando...' : saveSuccess ? 'Guardado' : 'Guardar apariencia'}
            </button>
            <span style={{ fontSize: 12, color: '#788A9B' }}>Elige un color con buen contraste con el texto blanco (evita amarillos muy claros).</span>
          </div>
        </div>
      )}


      {activeTab === 'moneda' && (
        <div className="settings-grid-2col">
          <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #EEF3F0', padding: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1C2A38', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Coins size={20} color="var(--primary)" />
              <span>Configuración de Moneda y Formato Regional</span>
            </h3>

            {/* Presets Rápidos de Moneda */}
            <div style={{ marginBottom: '20px' }}>
              <label className="form-label">Selección Rápida de Moneda Regional</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { label: '🇵🇪 Soles (S/.)', simbolo: 'S/.', codigo: 'PEN', dec: '.', mil: ',' },
                  { label: '🇺🇸 Dólares ($)', simbolo: '$', codigo: 'USD', dec: '.', mil: ',' },
                  { label: '🇪🇺 Euros (€)', simbolo: '€', codigo: 'EUR', dec: ',', mil: '.' },
                  { label: '🇲🇽 Pesos Mexicanos ($)', simbolo: 'MXN$', codigo: 'MXN', dec: '.', mil: ',' },
                  { label: '🇨🇴 Pesos Colombianos ($)', simbolo: 'COP$', codigo: 'COP', dec: ',', mil: '.' },
                ].map((curr, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSettings({
                        ...settings,
                        moneda_simbolo: curr.simbolo,
                        moneda_codigo: curr.codigo,
                        separador_decimales: curr.dec,
                        separador_miles: curr.mil
                      });
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: settings.moneda_codigo === curr.codigo ? 'var(--primary)' : '#F1F5F3',
                      color: settings.moneda_codigo === curr.codigo ? '#FFFFFF' : '#1C2A38',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {curr.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-form-row-2">
              <div>
                <label className="form-label">Símbolo de Moneda *</label>
                <div className="form-input-box">
                  <DollarSign size={18} color="#9EAFBF" />
                  <input 
                    type="text" 
                    value={settings.moneda_simbolo || ''}
                    onChange={e => setSettings({ ...settings, moneda_simbolo: e.target.value })}
                    placeholder="Ej. S/. o $"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Código ISO *</label>
                <div className="form-input-box">
                  <Coins size={18} color="#9EAFBF" />
                  <input 
                    type="text" 
                    value={settings.moneda_codigo || ''}
                    onChange={e => setSettings({ ...settings, moneda_codigo: e.target.value.toUpperCase() })}
                    placeholder="PEN, USD, EUR"
                  />
                </div>
              </div>
            </div>

            <div className="settings-form-row-2">
              <div>
                <label className="form-label">Separador de Decimales</label>
                <div className="form-input-box">
                  <select 
                    value={settings.separador_decimales || '.'}
                    onChange={e => setSettings({ ...settings, separador_decimales: e.target.value })}
                    style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontWeight: '600' }}
                  >
                    <option value=".">. (Punto decimal)</option>
                    <option value=",">, (Coma decimal)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Separador de Miles</label>
                <div className="form-input-box">
                  <select 
                    value={settings.separador_miles || ','}
                    onChange={e => setSettings({ ...settings, separador_miles: e.target.value })}
                    style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontWeight: '600' }}
                  >
                    <option value=",">, (Coma de miles)</option>
                    <option value=".">. (Punto de miles)</option>
                    <option value=" ">  (Espacio de miles)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Caja de Vista Previa Interactiva */}
          <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #EEF3F0', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1C2A38', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} color="var(--primary)" />
              <span>Visor de Precios en Vivo</span>
            </h3>

            <p style={{ fontSize: '13px', color: '#788A9B', marginBottom: '20px' }}>
              Así se visualizarán los montos en el catálogo del POS, reportes ejecutivos y tickets de venta:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#F8FAF9', padding: '14px 18px', borderRadius: '12px', border: '1px solid #EBF1EE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#5A6E82' }}>Precio Unitario de Regalo:</span>
                <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>
                  {formatExampleNumber(145.00)}
                </span>
              </div>

              <div style={{ background: '#F8FAF9', padding: '14px 18px', borderRadius: '12px', border: '1px solid #EBF1EE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#5A6E82' }}>Venta Total de Pedido:</span>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#1C2A38' }}>
                  {formatExampleNumber(1450.50)}
                </span>
              </div>

              <div style={{ background: '#F8FAF9', padding: '14px 18px', borderRadius: '12px', border: '1px solid #EBF1EE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#5A6E82' }}>Facturación Mensual Global:</span>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#10B981' }}>
                  {formatExampleNumber(12414.00)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DELIVERY & ZONAS */}
      {activeTab === 'delivery' && (
        <div className="settings-grid-2col" style={{ gridTemplateColumns: 'minmax(0, 760px)' }}>
          {/* Zonas de Reparto */}
          <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #EEF3F0', padding: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1C2A38', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={20} color="var(--primary)" />
              <span>Cargos por embalaje y traslado a Agencia</span>
            </h3>

            <p style={{ fontSize: '12.5px', color: '#788A9B', marginBottom: '14px' }}>
              Estos cargos se seleccionan al hacer una cotización, al vender con la opción <strong>Envío</strong> o al editar un pedido,
              y se suman al saldo restante. Ejemplos: Traslado a Agencia Shalom, Traslado a Agencia Terminal Terrestre - Arequipa, Tarifa de embalaje.
            </p>

            <div style={{ borderTop: '1px solid #EBF1EE', paddingTop: '16px', marginBottom: '14px' }}>
              <label className="form-label">Cargos configurados</label>
              
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <input 
                  type="text" 
                  placeholder="Cargo (Ej. Traslado a Agencia Shalom)"
                  value={newZonaName}
                  onChange={e => setNewZonaName(e.target.value)}
                  style={{ flex: 2, padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
                <input 
                  type="number" 
                  placeholder="Monto S/."
                  value={newZonaCosto}
                  onChange={e => setNewZonaCosto(e.target.value)}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
                <button 
                  type="button" 
                  onClick={addZona}
                  className="btn-primary" 
                  style={{ width: 'auto', padding: '0 16px', borderRadius: '10px' }}
                >
                  <Plus size={16} />
                  <span>Añadir</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {parsedZonas.map((z, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAF9', padding: '10px 16px', borderRadius: '10px', border: '1px solid #EBF1EE' }}>
                    {editZona && editZona.idx === idx ? (
                      <input autoFocus value={editZona.nombre} onChange={(e) => setEditZona({ idx, nombre: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') renameZona(); if (e.key === 'Escape') setEditZona(null); }}
                        style={{ flex: 1, marginRight: 10, padding: '6px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }} />
                    ) : (
                      <span style={{ fontSize: '13px', fontWeight: '600', color: z.visible === false ? '#94A3B8' : '#1C2A38', textDecoration: z.visible === false ? 'line-through' : 'none' }}>{z.zona}{z.visible === false ? ' (oculto)' : ''}</span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)' }}>
                        {settings.moneda_simbolo || 'S/.'} {Number(z.costo).toFixed(2)}
                      </span>
                      <button type="button" onClick={() => toggleZona(idx)} style={{ color: z.visible === false ? '#94A3B8' : '#10B981' }} title={z.visible === false ? 'Oculto al cotizar/vender: clic para mostrar' : 'Visible al cotizar/vender: clic para ocultar'}>
                        {z.visible === false ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      {editZona && editZona.idx === idx
                        ? <button type="button" onClick={renameZona} style={{ color: '#10B981' }} title="Guardar nombre"><Check size={16} /></button>
                        : <button type="button" onClick={() => setEditZona({ idx, nombre: z.zona })} style={{ color: '#64748B' }} title="Editar nombre"><Pencil size={16} /></button>}
                      <button onClick={() => removeZona(idx)} style={{ color: '#EF4444' }} title="Eliminar cargo">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
