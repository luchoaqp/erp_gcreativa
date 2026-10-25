# Informe de migración · ERP Node.js → Laravel

**Fecha:** 25 de octubre de 2026
**Alcance:** backend completo del ERP (`backend/`, Node/Express + MySQL) reescrito en Laravel 12 (PHP ≥ 8.2) para cPanel.
**Frontend React:** sin cambios en el código. Se compiló tal cual y Laravel lo sirve desde `public/`.

## 1. Cómo se verificó

No se tocó tu cPanel ni tu base real. Todo se probó sobre copias:

1. Restauré tu última copia de seguridad en un MySQL de pruebas.
   - Les puse contraseñas de prueba a los usuarios.
   - Agregué un vendedor y un repartidor de prueba.
2. Levanté **tu backend Node original** y el **nuevo Laravel** contra la misma base, uno a la vez y partiendo siempre de la misma foto de datos.
3. Ejecuté los mismos escenarios en ambos y comparé dos cosas:
   - **Cada respuesta de la API**: código HTTP y JSON completo, campo por campo.
   - **La base de datos completa al final de cada escenario**: todas las tablas, fila por fila.
4. Hice una prueba en navegador real: login y las 20 pantallas del menú sobre Laravel, sin errores de API.

## 2. Módulos migrados y resultado

| Módulo | Pasos probados | Resultado |
|---|---:|---|
| Login, sesión, perfil | 10 | ✅ idéntico |
| Usuarios y roles (permisos, avatares, contraseñas) | 19 | ✅ idéntico |
| Categorías | 14 | ✅ idéntico* |
| Productos, packs/boxes, precios por cantidad, lotes, fotos | 53 | ✅ idéntico |
| Configuración de empresa y de cotización | incl. | ✅ idéntico |
| Catálogos (ocasiones, marcas, etc.) | incl. | ✅ idéntico |
| Clientes, proveedores, tipos de cliente | 5 escenarios | ✅ idéntico |
| Pedidos (crear, diseño, links, estados, entrega) | 25 | ✅ idéntico |
| Ventas / POS (pagos, comprobantes, stock, editar, duplicar, anular) | 52 | ✅ idéntico |
| Cotizaciones (correlativo, conversión a venta) | 28 | ✅ idéntico |
| Kardex y kardex valorizado | 8 | ✅ idéntico |
| Compras (soles y dólares, lotes, anulación) | 32 | ✅ idéntico |
| Gastos | 18 | ✅ idéntico |
| Envíos, couriers y agencias | 29 | ✅ idéntico |
| Taller | 20 | ✅ idéntico |
| Dashboard y los 11 reportes del Centro de reportes | 34 | ✅ idéntico |
| Excel de productos (plantilla, exportar, importar) | 13 | ✅ idéntico* |
| Copias de seguridad (crear, restaurar, descargar, reinicios) | 21 | ✅ idéntico* |
| Consulta DNI/RUC | 1 | ✅ idéntico (sin token configurado) |

**Total:** 123 rutas de la API migradas en el mismo orden que el `server.js`. Se corrieron **21 escenarios con 430 pasos**: 18 escenarios salieron idénticos, y los otros 3 solo muestran las diferencias cosméticas de abajo.

\* Diferencias encontradas. Ninguna afecta datos ni funcionamiento:

- **Categorías:** cuando el slug se repite, se le agrega un sufijo basado en la hora exacta. Por eso cambia de una ejecución a otra en ambos sistemas.
- **Excel:** el contenido de las hojas es idéntico byte a byte. Solo cambia el tamaño del .xlsx comprimido, por la versión de la librería de compresión.
- **Copias de seguridad:** la fecha que muestra el historial puede variar unas décimas de segundo, porque PHP no lee milisegundos de los archivos. El contenido de las copias es idéntico.

## 3. Mejoras incluidas

- **Correlativos de pedidos sin duplicados.** El número se reserva con un bloqueo de base de datos (`SELECT … FOR UPDATE`). Así, dos ventas al mismo segundo desde dos PCs ya no pueden obtener el mismo número.
- **"Hoy" en el dashboard.** Node usaba la fecha UTC, así que entre las 7 pm y la medianoche mostraba el día siguiente. Laravel usa la hora de Lima.
- **Instalación y actualizaciones sin SSH:**
  - `/instalar?token=…` para la primera vez.
  - `/api/sistema/actualizar` (solo administrador) para las siguientes.
- **Catálogo web:**
  - Pantalla nueva `/catalogo-web` para elegir productos y publicarlos en gcreativa.com.
  - 2 columnas nuevas en `productos`: `web_visible` y `web_descripcion`. Son opcionales y Node las ignora sin problema.

## 4. Lo que cambia para ti

- **Igual que antes:** las pantallas, los usuarios, las contraseñas y los datos.
- **Distinto:** el ERP ya no se arranca con `node server.js` en tu PC. Vive en `https://erp.gcreativa.com`.
- **Consulta DNI/RUC:** copia tu `CONSULTA_DOC_TOKEN` al `.env` nuevo.

## 5. Pendientes y recomendaciones

1. **Probar en tu cPanel real.** Aquí se probó con PHP 8.3. Las dependencias están fijadas para PHP 8.2 y no uso funciones exclusivas de 8.3, pero conviene hacer el primer ingreso y una venta de prueba antes de usarlo en serio.
2. **Exportar tu base actual (XAMPP) e importarla en cPanel.** Luego entra a `/instalar` una vez para agregar las columnas del catálogo web.
3. **Subir tus fotos** de `backend/uploads/productos` a `erp/public/uploads/productos/`. Ya van incluidas las que venían en el .rar.
4. **Botón dentro del ERP para "Catálogo web".** Hoy se entra por la dirección `/catalogo-web`. Si quieres, agrego un enlace en el menú de React; es un cambio pequeño en el frontend.
5. **Avisos de nuevos pedidos (cada 15–30 s).** Funcionan igual que en Node. En hosting compartido, con menos de 10 usuarios a la vez no hay problema.
