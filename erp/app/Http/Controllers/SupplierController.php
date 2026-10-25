<?php

namespace App\Http\Controllers;

class SupplierController extends PartyController
{
    protected string $table = 'proveedores';
    protected string $prefix = 'PRV';
    protected string $plural = 'suppliers';
    protected string $label = 'proveedores';
    protected string $addressCol = 'direccion';
    protected array $extraFields = [['col' => 'contacto', 'max' => 120], ['col' => 'notas', 'max' => 2000]];

    public function getSuppliers() { return $this->partyList(); }
    public function createSupplier() { return $this->partyCreate(); }
    public function updateSupplier($id) { return $this->partyUpdate($id); }
    public function deleteSupplier($id) { return $this->partyRemove($id); }
}
