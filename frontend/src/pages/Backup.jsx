import React, { useState, useEffect, useRef } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  FileText, 
  Clock, 
  HardDrive, 
  Layers, 
  Gift, 
  Users, 
  ShoppingBag, 
  Trash2,
  Lock,
  ArrowRight,
  Info
} from 'lucide-react';
import { backupAPI } from '../api';

export default function Backup() {
  const [backups, setBackups] = useState([]);
  const [dbStats, setDbStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Selector de archivo para restauración
  const fileInputRef = useRef(null);
  const [selectedFileBackup, setSelectedFileBackup] = useState(null);

  // Modal de Peligro para Reset
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetMode, setResetMode] = useState('nuevo_inicio');
  const [stockMode, setStockMode] = useState('saldo_inicial');
  const [safetyInput, setSafetyInput] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [histRes, sumRes] = await Promise.all([
        backupAPI.getHistory(),
        backupAPI.getSummary()
      ]);
      if (histRes.success) setBackups(histRes.backups || []);
      if (sumRes.success) setDbStats(sumRes.summary);
    } catch (err) {
      console.error('Error cargando módulo de copias:', err);
    } finally {
      setLoading(false);
    }
  };

  // 1. Sacar copia de seguridad y descargar
  const handleCreateBackup = async () => {
    try {
      setActionLoading(true);
      setFeedback(null);
      const res = await backupAPI.create();
      if (res.success) {
        // Disparar descarga directa del archivo en el navegador
        const blob = new Blob([JSON.stringify(res.backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename || `copia_seguridad_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setFeedback({ 
          type: 'success', 
          message: `¡Copia de seguridad "${res.filename}" generada y descargada exitosamente!` 
        });
        loadData();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Error generando copia de seguridad: ' + err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Manejo de archivo para restauración
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.tables) {
          throw new Error('El archivo no tiene la estructura de tablas de la Tienda de Regalos.');
        }
        setSelectedFileBackup({
          name: file.name,
          size: file.size,
          data: parsed
        });
      } catch (err) {
        setFeedback({ type: 'error', message: 'Archivo inválido: ' + err.message });
        setSelectedFileBackup(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!selectedFileBackup) return;
    if (!window.confirm(`¿Confirmas restaurar el archivo "${selectedFileBackup.name}"? Los datos actuales serán reemplazados por los de la copia.`)) return;

    try {
      setActionLoading(true);
      setFeedback(null);
      const res = await backupAPI.restore({ backupData: selectedFileBackup.data });
      if (res.success) {
        setFeedback({ 
          type: 'success', 
          message: `¡Restauración exitosa! Se restauraron ${res.restoredCounts?.productos || 0} productos, ${res.restoredCounts?.clientes || 0} clientes y ${res.restoredCounts?.pedidos || 0} pedidos.` 
        });
        setSelectedFileBackup(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        loadData();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Error al restaurar: ' + err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Restaurar desde historial del servidor
  const handleRestoreFromHistory = async (filename) => {
    if (!window.confirm(`¿Deseas restaurar la copia del servidor "${filename}"? Esta acción sobreescribirá la base de datos actual.`)) return;
    try {
      setActionLoading(true);
      setFeedback(null);
      const res = await backupAPI.restore({ filename });
      if (res.success) {
        setFeedback({ type: 'success', message: `¡Copia "${filename}" restaurada con éxito total!` });
        loadData();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Error al restaurar desde el servidor: ' + err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Ejecutar Reset del Sistema
  const handleExecuteReset = async (e) => {
    e.preventDefault();
    if (safetyInput !== 'RESET-EMPRESA') {
      alert('Debes escribir exactamente "RESET-EMPRESA" para confirmar la operación.');
      return;
    }

    try {
      setResetting(true);
      const res = await backupAPI.reset({
        safetyCode: safetyInput,
        mode: resetMode,
        stockMode,
        newCompany: {
          nombre_tienda: newCompanyName.trim() || 'Mi Nueva Tienda de Regalos',
          slogan: 'Momentos inolvidables y detalles mágicos'
        }
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setShowResetModal(false);
        setSafetyInput('');
        setNewCompanyName('');
        loadData();
      }
    } catch (err) {
      alert('Error ejecutando el reset: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="content-body animate-fade-in" style={{ paddingBottom: '60px' }}>
      {/* Header Principal */}
      <div className="page-header-responsive" style={{ alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Database size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1C2A38', margin: 0 }}>
                Copia de Seguridad & Mantenimiento del Sistema
              </h2>
              <p style={{ fontSize: '13px', color: '#788A9B', margin: '4px 0 0 0' }}>
                Resguardo completo de datos, restauración de copias de seguridad y reinicio de fábrica para nueva empresa.
              </p>
            </div>
          </div>
        </div>

        {/* Badge de Estado del Servidor */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          padding: '8px 16px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: '700',
          color: '#065F46'
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
          <span>MySQL Activo{dbStats?.database ? ` • ${dbStats.database}` : ''}</span>
        </div>
      </div>

      {/* Alerta de Notificación / Feedback */}
      {feedback && (
        <div style={{
          background: feedback.type === 'success' ? '#E8F5E9' : '#FEF2F2',
          color: feedback.type === 'success' ? '#1B5E20' : '#B91C1C',
          border: `1px solid ${feedback.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
          padding: '14px 18px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '24px',
          fontSize: '13px',
          fontWeight: '600'
        }}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Tarjetas KPI de Estado de Base de Datos */}
      <div className="responsive-grid-4" style={{ marginBottom: '28px' }}>
        <div className="kpi-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Gift size={20} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#788A9B', textTransform: 'uppercase' }}>Catálogo activo</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#1C2A38' }}>{dbStats ? `${dbStats.productos} productos${dbStats.packs ? ` · ${dbStats.packs} packs` : ''}` : '—'}</div>
            </div>
          </div>
        </div>

        <div className="kpi-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={20} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#788A9B', textTransform: 'uppercase' }}>Ventas & Pedidos</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#1C2A38' }}>
                {dbStats ? `${dbStats.ventas} ventas${dbStats.ventasPendientes ? ` · ${dbStats.ventasPendientes} sin entregar` : ''}` : '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="kpi-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#F0FDF4', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#788A9B', textTransform: 'uppercase' }}>Clientes Registrados</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#1C2A38' }}>
                {dbStats ? `${dbStats.clientes} clientes` : '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="kpi-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#FAF5FF', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HardDrive size={20} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#788A9B', textTransform: 'uppercase' }}>Copias en Servidor</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#1C2A38' }}>{backups.length} respaldos</div>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones Principales: Grid de 2 Columnas (Exportar vs Restaurar) */}
      <div className="responsive-grid-2" style={{ marginBottom: '28px' }}>
        {/* Tarjeta 1: Sacar Copia de Seguridad */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '18px',
          border: '1px solid #EEF3F0',
          padding: '30px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Download size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1C2A38', margin: 0 }}>
                Sacar Copia de Seguridad
              </h3>
              <span style={{ fontSize: '12px', color: '#788A9B' }}>
                Genera un archivo descargable con toda la información del negocio.
              </span>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: '#5A6E82', lineHeight: '1.6', marginBottom: '20px' }}>
            Crea un respaldo estructurado e inalterable que incluye toda la información del negocio: productos y packs, categorías, ocasiones, clientes, ventas y pedidos, cotizaciones, comprobantes, compras, gastos, usuarios y la configuración de la empresa. Las fotos de productos están en la carpeta backend/uploads: cópiala junto con el respaldo.
          </p>

          <div style={{
            background: '#F8FAF9',
            borderRadius: '12px',
            border: '1px solid #E2ECE8',
            padding: '14px',
            fontSize: '12px',
            color: '#475569',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            marginBottom: '24px'
          }}>
            <div>✓ Formato estándar: <strong>JSON estructurado (Portátil y verificable)</strong></div>
            <div>✓ Destino: <strong>Descarga directa al navegador + Almacenamiento local en servidor</strong></div>
            <div>✓ Seguridad: <strong>Hash seguro de contraseñas y llaves de integridad referencial</strong></div>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <button
              onClick={handleCreateBackup}
              disabled={actionLoading}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Download size={18} />
              <span>{actionLoading ? 'Generando Respaldo...' : 'Sacar y Descargar Copia de Seguridad'}</span>
            </button>
          </div>
        </div>

        {/* Tarjeta 2: Restaurar Copia de Seguridad */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '18px',
          border: '1px solid #EEF3F0',
          padding: '30px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Upload size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1C2A38', margin: 0 }}>
                Restauración de Copia de Seguridad
              </h3>
              <span style={{ fontSize: '12px', color: '#788A9B' }}>
                Carga un archivo de copia previo para reponer el estado del sistema.
              </span>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: '#5A6E82', lineHeight: '1.6', marginBottom: '16px' }}>
            Selecciona un archivo de respaldo generado anteriormente. El sistema verificará la estructura de tablas y ejecutará una restauración transaccional segura.
          </p>

          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".json"
            style={{ display: 'none' }}
          />

          {/* Zona de Drop / Selección de Archivo */}
          {!selectedFileBackup ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #93C5FD',
                background: '#F8FAFC',
                borderRadius: '12px',
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: '20px',
                transition: 'all 0.2s'
              }}
            >
              <Upload size={32} color="#3B82F6" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1E40AF' }}>
                Haz clic aquí para seleccionar el archivo de respaldo (.json)
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                Archivos compatibles: backup_tienda_regalos_*.json
              </div>
            </div>
          ) : (
            <div style={{
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#1E40AF' }}>
                    📄 {selectedFileBackup.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#3B82F6', marginTop: '2px' }}>
                    Tamaño: {(selectedFileBackup.size / 1024).toFixed(1)} KB • Sistema: {selectedFileBackup.data?.system || 'Tienda de Regalos'}
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedFileBackup(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  style={{ color: '#EF4444', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  title="Quitar archivo"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div style={{ fontSize: '11px', color: '#475569', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #BFDBFE' }}>
                ✓ {Object.keys(selectedFileBackup.data?.tables || {}).length} tablas detectadas para restaurar.
              </div>
            </div>
          )}

          <div style={{ marginTop: 'auto' }}>
            <button
              onClick={handleExecuteRestore}
              disabled={!selectedFileBackup || actionLoading}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '700',
                background: selectedFileBackup ? '#2563EB' : '#94A3B8',
                color: '#FFFFFF',
                border: 'none',
                cursor: selectedFileBackup ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <RefreshCw size={18} className={actionLoading ? 'animate-spin' : ''} />
              <span>{actionLoading ? 'Restaurando Base de Datos...' : 'Ejecutar Restauración de la Copia'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Historial de Copias Locales Disponibles */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '18px',
        border: '1px solid #EEF3F0',
        padding: '26px',
        marginBottom: '28px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
      }}>
        <div className="page-header-responsive" style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1C2A38', margin: 0 }}>
              Historial de Copias de Seguridad en el Servidor ({backups.length})
            </h3>
          </div>

          <button 
            onClick={loadData}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#5A6E82', background: '#F1F5F3', padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            <RefreshCw size={14} /> Refrescar
          </button>
        </div>

        {backups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: '#788A9B', fontSize: '13px' }}>
            No hay copias de seguridad archivadas localmente. Genera tu primera copia usando el botón superior.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {backups.map((b, idx) => (
              <div 
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#F8FAF9',
                  padding: '14px 20px',
                  borderRadius: '12px',
                  border: '1px solid #EBF1EE',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FileText size={20} color="var(--primary)" />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#1C2A38' }}>{b.filename}</div>
                    <div style={{ fontSize: '11px', color: '#788A9B', marginTop: '2px' }}>
                      Generado: {new Date(b.created_at).toLocaleString()} • Tamaño: {(b.sizeBytes / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleRestoreFromHistory(b.filename)}
                    disabled={actionLoading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      background: '#FFFFFF',
                      border: '1.5px solid #2563EB',
                      color: '#2563EB',
                      cursor: 'pointer'
                    }}
                  >
                    Restaurar Ésta
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ZONA DE PELIGRO: RESETEAR EL SISTEMA PARA UNA EMPRESA NUEVA */}
      <div style={{
        background: '#FFF5F5',
        borderRadius: '18px',
        border: '2px solid #FECACA',
        padding: '30px',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: '#FEE2E2',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertTriangle size={26} />
          </div>

          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '19px', fontWeight: '800', color: '#991B1B', margin: '0 0 6px 0' }}>
              Zona de Peligro: Resetear el Sistema para una Empresa Nueva
            </h3>
            <p style={{ fontSize: '13px', color: '#7F1D1D', lineHeight: '1.6', margin: '0 0 20px 0', maxWidth: '850px' }}>
              Utiliza esta función cuando desees <strong>limpiar las ventas y pedidos de prueba</strong> para comenzar las ventas reales en limpio, o cuando desees <strong>traspasar el software a una empresa completamente nueva</strong> reiniciando de fábrica la configuración y los clientes.
            </p>

            <button
              onClick={() => setShowResetModal(true)}
              style={{
                padding: '12px 26px',
                borderRadius: '12px',
                background: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)'
              }}
            >
              <AlertTriangle size={18} />
              <span>Configurar y Resetear Sistema para Empresa Nueva...</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE SEGURIDAD PARA RESETEAR */}
      {showResetModal && (
        <div className="modal-overlay" data-noguard>
          <div className="modal-content animate-fade-in" style={{ maxWidth: '580px', borderTop: '6px solid #DC2626' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626' }}>
                <AlertTriangle size={24} />
                <h3 style={{ fontSize: '19px', fontWeight: '800', margin: 0 }}>Confirmar Reinicio del Sistema</h3>
              </div>
              <button onClick={() => setShowResetModal(false)} style={{ color: '#788A9B' }}>✕</button>
            </div>

            <p style={{ fontSize: '13px', color: '#5A6E82', lineHeight: '1.5', marginBottom: '20px' }}>
              Por favor selecciona la modalidad de reinicio deseada y confirma escribiendo la clave de verificación.
            </p>

            <form onSubmit={handleExecuteReset}>
              {/* Selector de Modalidad */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px', borderRadius: '12px',
                  border: resetMode === 'nuevo_inicio' ? '2px solid #16A34A' : '1px solid #CBD5E1',
                  background: resetMode === 'nuevo_inicio' ? '#F0FDF4' : '#FFFFFF', cursor: 'pointer'
                }}>
                  <input type="radio" name="resetMode" value="nuevo_inicio" checked={resetMode === 'nuevo_inicio'}
                    onChange={() => setResetMode('nuevo_inicio')} style={{ marginTop: '3px', accentColor: '#16A34A' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#15803D' }}>
                      Modalidad 1: Empezar de cero (versión final) — [Recomendado]
                    </div>
                    <div style={{ fontSize: '12px', color: '#788A9B', marginTop: '3px', lineHeight: '1.4' }}>
                      Borra <strong>ventas, cotizaciones, comprobantes, pedidos, envíos, compras, gastos, clientes y proveedores</strong>. Conserva productos, categorías, usuarios, configuración de la empresa, catálogos y taller. Cotizaciones y pedidos vuelven a empezar en 100. <strong>Guarda un respaldo automático antes de borrar.</strong>
                    </div>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '14px',
                  borderRadius: '12px',
                  border: resetMode === 'transactions_only' ? '2px solid var(--primary)' : '1px solid #CBD5E1',
                  background: resetMode === 'transactions_only' ? '#FFF5F0' : '#FFFFFF',
                  cursor: 'pointer'
                }}>
                  <input 
                    type="radio" 
                    name="resetMode" 
                    value="transactions_only" 
                    checked={resetMode === 'transactions_only'}
                    onChange={() => setResetMode('transactions_only')}
                    style={{ marginTop: '3px', accentColor: 'var(--primary)' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#1C2A38' }}>
                      Modalidad 2: Limpieza Operativa (Solo Ventas y Pedidos)
                    </div>
                    <div style={{ fontSize: '12px', color: '#788A9B', marginTop: '3px', lineHeight: '1.4' }}>
                      Elimina todos los pedidos, entregas y detalles de prueba reiniciando los contadores a #001. <strong>Mantiene intacto el catálogo de regalos, productos, clientes y configuración</strong>.
                    </div>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '14px',
                  borderRadius: '12px',
                  border: resetMode === 'full_factory' ? '2px solid #DC2626' : '1px solid #CBD5E1',
                  background: resetMode === 'full_factory' ? '#FEF2F2' : '#FFFFFF',
                  cursor: 'pointer'
                }}>
                  <input 
                    type="radio" 
                    name="resetMode" 
                    value="full_factory" 
                    checked={resetMode === 'full_factory'}
                    onChange={() => setResetMode('full_factory')}
                    style={{ marginTop: '3px', accentColor: '#DC2626' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#DC2626' }}>
                      Modalidad 3: Reinicio de Fábrica Total para Nueva Empresa
                    </div>
                    <div style={{ fontSize: '12px', color: '#788A9B', marginTop: '3px', lineHeight: '1.4' }}>
                      Limpia todos los pedidos y clientes. Permite ingresar el nombre comercial de la nueva empresa para arrancar desde cero manteniendo al usuario Administrador.
                    </div>
                  </div>
                </label>
              </div>

              {resetMode === 'nuevo_inicio' && (
                <div style={{ marginBottom: '20px', background: '#F8FAF9', padding: '14px 16px', borderRadius: '12px', border: '1px solid #EBF1EE' }}>
                  <label className="form-label" style={{ fontWeight: '700' }}>¿Qué hacer con el stock y el Kardex?</label>
                  <select value={stockMode} onChange={(e) => setStockMode(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}>
                    <option value="saldo_inicial">Limpiar el Kardex y dejar el stock actual como saldo inicial</option>
                    <option value="cero">Poner todo el stock en 0 y limpiar el Kardex (cargaré el stock por Excel)</option>
                    <option value="mantener">No tocar el stock ni el Kardex</option>
                  </select>
                </div>
              )}

              {resetMode === 'full_factory' && (
                <div style={{ marginBottom: '20px', background: '#F8FAF9', padding: '16px', borderRadius: '12px', border: '1px solid #EBF1EE' }}>
                  <label className="form-label" style={{ fontWeight: '700' }}>Nombre de la Nueva Empresa Comercial</label>
                  <input 
                    type="text"
                    value={newCompanyName}
                    onChange={e => setNewCompanyName(e.target.value)}
                    placeholder="Ej. Detalles & Sorpresas San Ángel"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    required
                  />
                </div>
              )}

              {/* Confirmación estricta de seguridad */}
              <div style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ color: '#991B1B', fontWeight: '700', fontSize: '13px' }}>
                  Para confirmar escribe exactamente: <span style={{ fontFamily: 'monospace', background: '#FEE2E2', padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.05em' }}>RESET-EMPRESA</span>
                </label>
                <div className="form-input-box" style={{ border: '2px solid #FCA5A5' }}>
                  <input 
                    type="text" 
                    value={safetyInput}
                    onChange={e => setSafetyInput(e.target.value)}
                    placeholder="Escribe RESET-EMPRESA aquí"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowResetModal(false)}
                  style={{ padding: '12px 20px', borderRadius: '12px', background: '#F1F5F3', fontWeight: '600', color: '#788A9B' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={resetting || safetyInput !== 'RESET-EMPRESA'}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '12px',
                    background: safetyInput === 'RESET-EMPRESA' ? '#DC2626' : '#9CA3AF',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: safetyInput === 'RESET-EMPRESA' ? 'pointer' : 'not-allowed'
                  }}
                >
                  {resetting ? 'Ejecutando Reinicio...' : 'Confirmar y Resetear Sistema'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
