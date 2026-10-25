import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';

// Botón "Descargar" con las opciones PDF y Excel
export default function ExportMenu({ onPdf, onExcel, disabled }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button className="pm-btn-outline" disabled={disabled} onClick={() => setOpen((v) => !v)}><Download size={16} /> Descargar</button>
      {open && (
        <div className="pm-menu" onMouseLeave={() => setOpen(false)}>
          <button onClick={() => { setOpen(false); onPdf(); }}><FileText size={15} /> PDF</button>
          <button onClick={() => { setOpen(false); onExcel(); }}><FileSpreadsheet size={15} /> Excel (.xlsx)</button>
        </div>
      )}
    </div>
  );
}
