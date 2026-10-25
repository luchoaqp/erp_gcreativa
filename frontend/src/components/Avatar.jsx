import React from 'react';

// Avatares ilustrados (SVG ligeros, sin fotos). Se guardan como código "av:<rol>-<n>" en usuarios.avatar.
const SKINS = ['#F6D2B8', '#E8B993', '#C98F66', '#8D5A3B'];
const HAIRS = ['#2B2118', '#5A3825', '#C9A227', '#B0432B', '#3B3B4F'];

// Cada rol tiene 4 variantes: cambia piel, pelo, fondo y accesorio propio del rol
const ROLES = {
  admin: { label: 'Administración', bg: ['#6D28D9', '#4C1D95', '#7C3AED', '#1E293B'], acc: 'tie' },
  vendedor: { label: 'Ventas', bg: ['#F97316', '#EC4899', '#0EA5E9', '#10B981'], acc: 'headset' },
  taller: { label: 'Taller', bg: ['#0D9488', '#D97706', '#2563EB', '#65A30D'], acc: 'cap' },
  repartidor: { label: 'Reparto', bg: ['#2563EB', '#DC2626', '#0891B2', '#475569'], acc: 'helmet' }
};
export const AVATAR_ROLES = ROLES;
export const avatarCode = (rol, n) => `av:${rol}-${n}`;
export const isAvatarCode = (v) => /^av:[a-z]+-[0-3]$/.test(v || '');
export const defaultAvatar = (rol) => avatarCode(ROLES[rol] ? rol : 'vendedor', 0);

function Accessory({ kind, hair }) {
  switch (kind) {
    case 'tie': return <><path d="M38 78 L50 90 L62 78 L50 82Z" fill="#fff" /><path d="M47 84 L53 84 L55 100 L50 104 L45 100Z" fill="#E11D48" /></>;
    case 'headset': return <><path d="M27 48 Q27 24 50 24 Q73 24 73 48" fill="none" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" /><rect x="22" y="44" width="8" height="14" rx="4" fill="#1E293B" /><rect x="70" y="44" width="8" height="14" rx="4" fill="#1E293B" /><path d="M74 56 Q74 66 62 66" fill="none" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" /></>;
    case 'cap': return <><path d="M28 40 Q50 14 72 40Z" fill="#FACC15" /><rect x="26" y="38" width="48" height="6" rx="3" fill="#EAB308" /></>;
    case 'helmet': return <><path d="M27 46 Q27 18 50 18 Q73 18 73 46Z" fill="#F8FAFC" /><rect x="25" y="42" width="50" height="6" rx="3" fill="#E2E8F0" /><rect x="46" y="18" width="8" height="26" fill="#EF4444" opacity=".85" /></>;
    default: return null;
  }
}

export function AvatarSvg({ code, size = 40 }) {
  const m = /^av:([a-z]+)-([0-3])$/.exec(code || '');
  const rol = m && ROLES[m[1]] ? m[1] : 'vendedor';
  const n = m ? Number(m[2]) : 0;
  const cfg = ROLES[rol];
  const skin = SKINS[(n + (rol === 'repartidor' ? 1 : 0)) % 4];
  const hair = HAIRS[(n * 2 + 1) % HAIRS.length];
  const longHair = n % 2 === 1 && rol !== 'repartidor' && rol !== 'taller';
  const covers = cfg.acc === 'cap' || cfg.acc === 'helmet';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={cfg.label} style={{ borderRadius: '50%', flexShrink: 0, display: 'block' }}>
      <rect width="100" height="100" fill={cfg.bg[n]} />
      {longHair && <rect x="26" y="30" width="48" height="52" rx="22" fill={hair} />}
      <path d="M18 100 Q18 74 50 72 Q82 74 82 100Z" fill={n % 2 ? '#fff' : '#1E293B'} opacity=".92" />
      <rect x="43" y="62" width="14" height="14" rx="5" fill={skin} />
      <circle cx="50" cy="48" r="20" fill={skin} />
      {!covers && <path d="M30 46 Q30 26 50 26 Q70 26 70 46 Q62 36 50 36 Q38 36 30 46Z" fill={hair} />}
      <circle cx="43" cy="50" r="2.3" fill="#1E293B" /><circle cx="57" cy="50" r="2.3" fill="#1E293B" />
      <path d="M43 59 Q50 65 57 59" fill="none" stroke="#7F1D1D" strokeWidth="2" strokeLinecap="round" />
      <Accessory kind={cfg.acc} hair={hair} />
    </svg>
  );
}

/** Muestra el avatar del usuario: código SVG o, si es una URL antigua, la imagen */
export default function Avatar({ user, size = 40, className }) {
  const v = user?.avatar;
  if (isAvatarCode(v)) return <span className={className} style={{ display: 'inline-flex', lineHeight: 0 }}><AvatarSvg code={v} size={size} /></span>;
  if (v && /^(https?:|data:image)/.test(v) && !/unsplash/.test(v)) {
    return <img src={v} alt={user?.nombre || ''} className={className} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
  }
  return <span className={className} style={{ display: 'inline-flex', lineHeight: 0 }}><AvatarSvg code={defaultAvatar(user?.rol)} size={size} /></span>;
}

/** Selector de avatar para el formulario de usuario */
export function AvatarPicker({ value, rol, onChange }) {
  const current = isAvatarCode(value) ? value : defaultAvatar(rol);
  const roles = [rol, ...Object.keys(ROLES).filter((r) => r !== rol)].filter((r) => ROLES[r]);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <AvatarSvg code={current} size={56} />
        <span style={{ fontSize: 12.5, color: '#788A9B' }}>Elige un avatar (no se suben fotos, así el sistema se mantiene liviano).</span>
      </div>
      {roles.map((r) => (
        <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ width: 90, fontSize: 11.5, fontWeight: 700, color: r === rol ? 'var(--primary)' : '#788A9B' }}>{ROLES[r].label}</span>
          {[0, 1, 2, 3].map((n) => {
            const code = avatarCode(r, n);
            return (
              <button type="button" key={code} onClick={() => onChange(code)} aria-label={`${ROLES[r].label} ${n + 1}`}
                style={{ padding: 2, borderRadius: '50%', cursor: 'pointer', background: 'none', border: current === code ? '2px solid var(--primary)' : '2px solid transparent' }}>
                <AvatarSvg code={code} size={38} />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
