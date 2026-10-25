<?php

/*
|--------------------------------------------------------------------------
| API del ERP (mismas rutas que el backend Node: /api/...)
|--------------------------------------------------------------------------
| El orden importa: las rutas fijas van antes de las rutas con {id},
| igual que en Express.
*/

use App\Http\Controllers as C;
use Illuminate\Support\Facades\Route;

// ---------- Autenticación ----------
Route::post('auth/login', [C\AuthController::class, 'login']);
Route::get('auth/me', [C\AuthController::class, 'me'])->middleware('jwt');
Route::get('auth/users', [C\AuthController::class, 'getUsers'])->middleware('jwt');

// ---------- Dashboard ----------
Route::get('dashboard/stats', [C\DashboardController::class, 'getStats'])->middleware('jwt');

// ---------- Productos ----------
Route::middleware('jwt')->prefix('products')->group(function () {
    Route::get('/', [C\ProductController::class, 'getProducts']);
    Route::get('lotes', [C\ProductController::class, 'getLotes']);
    Route::put('lotes/{id}', [C\ProductController::class, 'updateLote']);
    Route::get('packs/list', [C\ProductController::class, 'getPacks']);
    Route::post('packs/{id}/revisar', [C\ProductController::class, 'refreshPack']);
    Route::get('brands', [C\ProductController::class, 'getBrands']);
    Route::post('brands', [C\ProductController::class, 'createBrand']);
    Route::get('suppliers-lite', [C\ProductController::class, 'getSuppliersLite']);
    Route::get('next-code', [C\ProductController::class, 'nextCode']);
    Route::get('excel/plantilla', [C\ProductExcelController::class, 'downloadTemplate']);
    Route::get('excel/exportar', [C\ProductExcelController::class, 'exportProducts']);
    Route::post('excel/importar', [C\ProductExcelController::class, 'importProducts']);
    Route::get('imagenes/pendientes', [C\ProductController::class, 'pendingThumbs']);
    Route::post('{id}/miniatura', [C\ProductController::class, 'saveThumb']);
    Route::get('{id}', [C\ProductController::class, 'getProductById']);
    Route::post('/', [C\ProductController::class, 'createProduct']);
    Route::put('{id}', [C\ProductController::class, 'updateProduct']);
    Route::patch('{id}/activo', [C\ProductController::class, 'setActive']);
    Route::delete('{id}', [C\ProductController::class, 'deleteProduct']);
});

// ---------- Pedidos ----------
Route::middleware('jwt')->prefix('orders')->group(function () {
    Route::get('/', [C\OrderController::class, 'getOrders']);
    Route::get('{id}', [C\OrderController::class, 'getOrderById']);
    Route::post('/', [C\OrderController::class, 'createOrder']);
    Route::get('{id}/diseno', [C\OrderController::class, 'getDiseno']);
    Route::put('{id}/diseno', [C\OrderController::class, 'saveDiseno']);
    Route::put('{id}/status', [C\OrderController::class, 'updateOrderStatus']);
});

// ---------- Clientes ----------
Route::middleware('jwt')->prefix('customers')->group(function () {
    Route::get('/', [C\CustomerController::class, 'getCustomers']);
    Route::post('/', [C\CustomerController::class, 'createCustomer']);
    Route::post('bulk-estado', [C\CustomerController::class, 'bulkEstado']);
    Route::put('{id}', [C\CustomerController::class, 'updateCustomer']);
    Route::delete('{id}', [C\CustomerController::class, 'deleteCustomer'])->middleware('roles:admin');
});

// ---------- Categorías y ocasiones ----------
Route::middleware('jwt')->prefix('categories')->group(function () {
    Route::get('/', [C\CategoryController::class, 'getCategories']);
    Route::post('/', [C\CategoryController::class, 'createCategory']);
    Route::put('{id}', [C\CategoryController::class, 'updateCategory']);
    Route::delete('{id}', [C\CategoryController::class, 'deleteCategory']);
    Route::post('occasions', [C\CategoryController::class, 'createOccasion']);
    Route::put('occasions/{id}', [C\CategoryController::class, 'updateOccasion']);
    Route::delete('occasions/{id}', [C\CategoryController::class, 'deleteOccasion']);
});

// ---------- Configuración ----------
Route::get('settings', [C\SettingController::class, 'getSettings'])->middleware('jwt');
Route::put('settings', [C\SettingController::class, 'updateSettings'])->middleware(['jwt', 'roles:admin']);

// ---------- Copias de seguridad (solo administrador) ----------
Route::middleware(['jwt', 'roles:admin'])->prefix('backup')->group(function () {
    Route::get('download', [C\BackupController::class, 'createBackup']);
    Route::get('summary', [C\BackupController::class, 'getSummary']);
    Route::get('history', [C\BackupController::class, 'listBackups']);
    Route::post('restore', [C\BackupController::class, 'restoreBackup']);
    Route::post('reset', [C\BackupController::class, 'resetSystem']);
});

// ---------- Usuarios ----------
Route::middleware('jwt')->prefix('users')->group(function () {
    Route::get('/', [C\UserController::class, 'getUsers']);
    Route::get('roles', [C\UserController::class, 'getRoles']);
    Route::post('/', [C\UserController::class, 'createUser']);
    Route::put('{id}', [C\UserController::class, 'updateUser']);
    Route::patch('{id}/status', [C\UserController::class, 'toggleStatus']);
    Route::delete('{id}', [C\UserController::class, 'deleteUser']);
});

// ---------- Cotizaciones ----------
Route::middleware('jwt')->prefix('quotes')->group(function () {
    Route::get('config', [C\QuoteController::class, 'getConfig'])->middleware('acceso:quotes');
    Route::put('config', [C\QuoteController::class, 'updateConfig'])->middleware('roles:admin');
    Route::middleware('acceso:quotes')->group(function () {
        Route::get('/', [C\QuoteController::class, 'getQuotes']);
        Route::get('{id}', [C\QuoteController::class, 'getQuoteById']);
        Route::post('/', [C\QuoteController::class, 'createQuote']);
        Route::put('{id}', [C\QuoteController::class, 'updateQuote']);
        Route::post('{id}/anular', [C\QuoteController::class, 'annulQuote']);
        Route::post('{id}/convertir', [C\QuoteController::class, 'convertQuote']);
    });
});

// ---------- Ventas ----------
Route::middleware('jwt')->prefix('sales')->group(function () {
    Route::get('doc-config', [C\SalesController::class, 'getDocConfig']);
    Route::get('{id}', [C\SalesController::class, 'getSale']);
    Route::get('/', [C\SalesController::class, 'listSales'])->middleware('acceso:sales');
    Route::put('{id}', [C\SalesController::class, 'updateSale'])->middleware('roles:admin');
    Route::post('{id}/duplicar', [C\SalesController::class, 'duplicateSale'])->middleware('acceso:sales');
    Route::post('{id}/pagos', [C\SalesController::class, 'addPayment'])->middleware('acceso:sales');
    Route::delete('{id}/pagos/{pagoId}', [C\SalesController::class, 'deletePayment'])->middleware('roles:admin');
    Route::put('{id}/comprobante-borrador', [C\SalesController::class, 'saveComprobanteBorrador'])->middleware('acceso:sales');
    Route::post('{id}/comprobantes', [C\SalesController::class, 'createComprobante'])->middleware('acceso:sales');
    Route::post('{id}/comprobantes/{cid}/anular', [C\SalesController::class, 'annulComprobante'])->middleware('roles:admin');
    Route::post('{id}/anular', [C\SalesController::class, 'annulSale'])->middleware('roles:admin');
});

// ---------- Proveedores ----------
Route::middleware(['jwt', 'acceso:suppliers'])->prefix('suppliers')->group(function () {
    Route::get('/', [C\SupplierController::class, 'getSuppliers']);
    Route::post('/', [C\SupplierController::class, 'createSupplier']);
    Route::post('bulk-estado', [C\SupplierController::class, 'bulkEstado']);
    Route::put('{id}', [C\SupplierController::class, 'updateSupplier']);
    Route::delete('{id}', [C\SupplierController::class, 'deleteSupplier'])->middleware('roles:admin');
});

// ---------- Tipos de cliente ----------
Route::middleware('jwt')->prefix('customer-types')->group(function () {
    Route::get('/', [C\CustomerTypeController::class, 'list']);
    Route::post('/', [C\CustomerTypeController::class, 'create'])->middleware('roles:admin');
    Route::put('{id}', [C\CustomerTypeController::class, 'update'])->middleware('roles:admin');
    Route::delete('{id}', [C\CustomerTypeController::class, 'remove'])->middleware('roles:admin');
});

// ---------- Consulta DNI / RUC ----------
Route::get('lookup/{tipo}/{numero}', [C\LookupController::class, 'lookup'])->middleware('jwt');

// ---------- Compras ----------
Route::middleware(['jwt', 'acceso:purchases'])->prefix('purchases')->group(function () {
    Route::get('suppliers', [C\PurchaseController::class, 'searchSuppliers']);
    Route::post('suppliers', [C\PurchaseController::class, 'quickSupplier']);
    Route::get('/', [C\PurchaseController::class, 'list']);
    Route::post('/', [C\PurchaseController::class, 'create']);
    Route::get('{id}', [C\PurchaseController::class, 'getOne']);
    Route::post('{id}/pagos', [C\PurchaseController::class, 'addPayment']);
    Route::post('{id}/anular', [C\PurchaseController::class, 'annul'])->middleware('roles:admin');
});

// ---------- Gastos (mismos permisos que Compras) ----------
Route::middleware(['jwt', 'acceso:purchases'])->prefix('expenses')->group(function () {
    Route::get('next-code', [C\ExpenseController::class, 'nextCode']);
    Route::get('/', [C\ExpenseController::class, 'list']);
    Route::post('/', [C\ExpenseController::class, 'create']);
    Route::get('{id}', [C\ExpenseController::class, 'getOne']);
    Route::put('{id}', [C\ExpenseController::class, 'update']);
    Route::post('{id}/anular', [C\ExpenseController::class, 'annul'])->middleware('roles:admin');
});

// ---------- Catálogos (enlaces para clientes) ----------
Route::middleware('jwt')->prefix('catalogs')->group(function () {
    Route::get('/', [C\CatalogController::class, 'list']);
    Route::post('/', [C\CatalogController::class, 'create'])->middleware('roles:admin,vendedor');
    Route::put('{id}', [C\CatalogController::class, 'update'])->middleware('roles:admin,vendedor');
    Route::delete('{id}', [C\CatalogController::class, 'remove'])->middleware('roles:admin,vendedor');
});

// ---------- Taller ----------
Route::middleware('jwt')->prefix('workshop')->group(function () {
    Route::get('/', [C\WorkshopController::class, 'list']);
    Route::get('{id}', [C\WorkshopController::class, 'getOne']);
    Route::post('/', [C\WorkshopController::class, 'create'])->middleware('roles:admin,vendedor');
    Route::put('{id}', [C\WorkshopController::class, 'update'])->middleware('roles:admin,vendedor');
    Route::delete('{id}', [C\WorkshopController::class, 'remove'])->middleware('roles:admin');
    Route::post('{id}/registros', [C\WorkshopController::class, 'addRecord'])->middleware('roles:admin,vendedor');
    Route::delete('{id}/registros/{rid}', [C\WorkshopController::class, 'removeRecord'])->middleware('roles:admin,vendedor');
});

// ---------- Kardex ----------
Route::get('kardex/movimientos', [C\KardexController::class, 'getMovements'])->middleware('jwt');
Route::get('kardex/valorizado', [C\KardexController::class, 'getValued'])->middleware('jwt');

// ---------- Envíos ----------
Route::middleware('jwt')->prefix('shipping')->group(function () {
    Route::get('/', [C\ShippingController::class, 'list']);
    Route::get('couriers', [C\ShippingController::class, 'listCouriers']);
    Route::post('couriers', [C\ShippingController::class, 'saveCourier']);
    Route::put('couriers/{id}', [C\ShippingController::class, 'saveCourier']);
    Route::get('agencias', [C\ShippingController::class, 'listAgencies']);
    Route::post('agencias', [C\ShippingController::class, 'saveAgency']);
    Route::post('agencias/importar', [C\ShippingController::class, 'importAgencies']);
    Route::put('agencias/{id}', [C\ShippingController::class, 'saveAgency']);
    Route::delete('agencias/{id}', [C\ShippingController::class, 'deleteAgency']);
    Route::put('{id}/datos', [C\ShippingController::class, 'saveData']);
    Route::get('{id}/guia', [C\ShippingController::class, 'getGuide']);
    Route::put('{id}/guia', [C\ShippingController::class, 'saveGuide']);
});

// ---------- Centro de reportes ----------
Route::get('report-hub', [C\ReportHubController::class, 'list'])->middleware('jwt');
Route::get('report-hub/{key}', [C\ReportHubController::class, 'run'])->middleware('jwt');

// ---------- Web pública gcreativa.com (NUEVO) ----------
Route::middleware('jwt')->prefix('web-catalog')->group(function () {
    Route::get('/', [C\WebCatalogController::class, 'preview']);
    Route::get('productos', [C\WebCatalogController::class, 'products']);
    Route::put('productos/{id}', [C\WebCatalogController::class, 'setVisible'])->middleware('roles:admin,vendedor');
    Route::post('publicar', [C\WebCatalogController::class, 'publish'])->middleware('roles:admin,vendedor');
});

// ---------- Mantenimiento sin SSH (NUEVO) ----------
Route::middleware(['jwt', 'roles:admin'])->prefix('sistema')->group(function () {
    Route::get('estado', [C\MaintenanceController::class, 'status']);
    Route::post('actualizar', [C\MaintenanceController::class, 'update']);
});

// ---------- Estado ----------
Route::get('health', function () {
    return \App\Support\Http::json([
        'status' => 'online',
        'system' => 'API Tienda de Regalos & Detalles Mágicos',
        'timestamp' => \App\Support\Js::iso(),
    ]);
});

// Cualquier otra ruta /api/... → 404 en JSON (igual que Express)
Route::any('{any}', function () {
    return \App\Support\Http::json(['success' => false, 'message' => 'Ruta no encontrada: ' . request()->getRequestUri()], 404);
})->where('any', '.*');
