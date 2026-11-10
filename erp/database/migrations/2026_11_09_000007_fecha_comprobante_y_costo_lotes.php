<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 1) comprobantes.fecha_editada: la fecha de emisión de una nota de venta se puede cambiar una sola vez.
 * 2) Corrección del costo de los lotes "AJUSTE" (stock cargado a mano en la ficha del producto): guardaban el
 *    precio de compra que tenía el producto en ese momento (a veces 0 o uno antiguo) y no seguían los cambios
 *    posteriores de la ficha. Se igualan al precio de compra actual, también en las ventas que salieron de ellos,
 *    para que Utilidades muestre el costo correcto. Los lotes de compras reales no se tocan.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('comprobantes', 'fecha_editada')) {
            DB::statement('ALTER TABLE comprobantes ADD COLUMN fecha_editada TINYINT(1) NOT NULL DEFAULT 0');
        }
        DB::statement("UPDATE venta_asignaciones va
            JOIN producto_lotes l ON l.id = va.lote_id AND l.codigo = 'AJUSTE'
            JOIN productos p ON p.id = l.producto_id
            SET va.costo_unit = p.precio_costo
            WHERE p.precio_costo > 0 AND ABS(va.costo_unit - p.precio_costo) > 0.0001");
        DB::statement("UPDATE producto_lotes l JOIN productos p ON p.id = l.producto_id
            SET l.costo_unit = p.precio_costo
            WHERE l.codigo = 'AJUSTE' AND p.precio_costo > 0 AND ABS(l.costo_unit - p.precio_costo) > 0.0001");
    }

    public function down(): void
    {
        if (Schema::hasColumn('comprobantes', 'fecha_editada')) DB::statement('ALTER TABLE comprobantes DROP COLUMN fecha_editada');
    }
};
