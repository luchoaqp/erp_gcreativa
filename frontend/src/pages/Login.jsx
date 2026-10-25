import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Gift, FileText, Truck } from 'lucide-react';
import { authAPI } from '../api';

export default function Login({ onLoginSuccess }) {
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('remember_tienda_regalos') === 'true';
  });
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('saved_email_tienda_regalos') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const response = await authAPI.login(email, password);
      if (response.success && response.token) {
        if (rememberMe) {
          localStorage.setItem('remember_tienda_regalos', 'true');
          localStorage.setItem('saved_email_tienda_regalos', email);
        } else {
          localStorage.removeItem('remember_tienda_regalos');
          localStorage.removeItem('saved_email_tienda_regalos');
        }
        localStorage.setItem('token_tienda_regalos', response.token);
        localStorage.setItem('user_tienda_regalos', JSON.stringify(response.user));
        onLoginSuccess(response.user);
      } else {
        setErrorMessage(response.message || 'Credenciales inválidas');
      }
    } catch (err) {
      setErrorMessage(err.message || 'No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = () => setErrorMessage('Para restablecer tu clave, pídele al administrador que la cambie en el módulo Usuarios.');

  return (
    <div className="login-screen">
      <div className="login-card-container animate-fade-in">
        {/* Lado izquierdo: Banner de Tienda de Regalos */}
        <div className="login-banner">
          <div className="login-banner-content">
            <img src="/brand/genia-logo-completo.png" alt="Genia Creativa" className="login-wordmark" />
            <span className="login-erp-tag">ERP · Sistema de gestión</span>

            <h1>Ingenio y creatividad para tu marca.</h1>
            <p>
              Gestiona en un solo lugar cotizaciones, ventas, pedidos personalizados, taller, inventario y envíos de Genia Creativa: tazas, botellas, polos y regalos hechos a tu medida.
            </p>

            <div className="login-badges-pills">
              <span className="gift-pill">
                <Gift size={14} /> Personalizados & Regalos
              </span>
              <span className="gift-pill">
                <FileText size={14} /> Cotizaciones & Ventas
              </span>
              <span className="gift-pill">
                <Truck size={14} /> Taller, Pedidos & Envíos
              </span>
            </div>
          </div>

          <div className="login-foot">© 2026 Genia Creativa — ERP v1.0 · WhatsApp 921 663 818</div>
        </div>

        {/* Lado derecho: Formulario de inicio de sesión */}
        <div className="login-form-side">
          <div className="form-header">
            <h2>Iniciar Sesión</h2>
            <p>Ingresa tus credenciales para acceder al sistema</p>
          </div>

          {errorMessage && (
            <div style={{
              background: '#FEF2F2',
              color: '#B91C1C',
              padding: '12px 16px',
              borderRadius: '10px',
              fontSize: '13px',
              marginBottom: '18px',
              border: '1px solid #FCA5A5',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <div className="form-input-box">
                <Mail size={18} color="#9EAFBF" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@geniacreativa.com"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <div className="form-input-box">
                <Lock size={18} color="#9EAFBF" />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ color: '#9EAFBF', display: 'flex' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '13px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#5A6E82', userSelect: 'none' }}>
                <input 
                  type="checkbox" 
                  checked={rememberMe} 
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span>Recordarme</span>
              </label>
              <span 
                style={{ color: 'var(--primary)', fontWeight: '600', cursor: 'pointer' }} 
                onClick={handleForgot}
              >
                ¿Olvidaste tu clave?
              </span>
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              disabled={loading}
              style={{ marginTop: '10px' }}
            >
              {loading ? (
                <span>Ingresando al sistema...</span>
              ) : (
                <>
                  <span>Acceder al Dashboard</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
