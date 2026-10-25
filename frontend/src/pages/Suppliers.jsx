import React from 'react';
import { Users } from 'lucide-react';
import { suppliersAPI } from '../api';
import PartyManager from '../components/PartyManager';

const cfg = {
  api: suppliersAPI,
  listKey: 'suppliers',
  singular: 'proveedor', Singular: 'Proveedor', plural: 'proveedores', Plural: 'Proveedores',
  Icon: Users,
  defaultDoc: 'RUC',
  emptyHint: 'El crecimiento empieza con un gran equipo. ¡Agrega a tu primer proveedor!',
  extraFields: [
    { col: 'contacto', label: 'Persona de contacto', placeholder: 'Ej. María Pérez', optional: true },
    { col: 'notas', label: 'Notas', type: 'textarea', placeholder: 'Condiciones de pago, productos que provee…', optional: true }
  ],
  extraCols: [{ id: 'contacto', label: 'Contacto' }]
};

export default function Suppliers({ user }) {
  return (
    <div className="content-body animate-fade-in">
      <PartyManager cfg={cfg} isAdmin={user?.rol === 'admin'} />
    </div>
  );
}
