<?php

namespace App\Http\Controllers;

use App\Support\Db;

class CustomerController extends PartyController
{
    protected string $table = 'clientes';
    protected string $prefix = 'CLI';
    protected string $plural = 'customers';
    protected string $label = 'clientes';
    protected string $addressCol = 'direccion_frecuente';
    protected array $extraFields = [
        ['col' => 'tipo_cliente_id', 'type' => 'int'],
        ['col' => 'fecha_especial', 'type' => 'date'],
        ['col' => 'tipo_fecha_especial', 'max' => 60],
        ['col' => 'notas', 'max' => 2000],
    ];
    protected string $joinExtra = 'LEFT JOIN tipos_cliente tc ON tc.id = x.tipo_cliente_id';
    // total_gastado: solo cuenta pedidos con comprobante emitido (regla de ventas)
    protected string $selectExtra = ", tc.nombre AS tipo_cliente_nombre,\n      (SELECT COUNT(*) FROM pedidos WHERE cliente_id = x.id) AS total_pedidos,\n      (SELECT COALESCE(SUM(p.total),0) FROM pedidos p WHERE p.cliente_id = x.id\n         AND EXISTS (SELECT 1 FROM comprobantes cp WHERE cp.pedido_id = p.id AND cp.estado = 'emitido')) AS total_gastado";

    protected function deleteGuard(int|float $id): ?string
    {
        $p = Db::query('SELECT COUNT(*) n FROM pedidos WHERE cliente_id = ?', [$id])[0];
        $q = Db::query('SELECT COUNT(*) n FROM cotizaciones WHERE cliente_id = ?', [$id])[0];
        if ($p['n'] || $q['n']) return 'No se puede eliminar: el cliente tiene pedidos o cotizaciones. Puedes marcarlo como Inactivo.';
        return null;
    }

    public function getCustomers() { return $this->partyList(); }
    public function createCustomer() { return $this->partyCreate(); }
    public function updateCustomer($id) { return $this->partyUpdate($id); }
    public function deleteCustomer($id) { return $this->partyRemove($id); }
}
