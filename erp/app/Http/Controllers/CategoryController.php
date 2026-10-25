<?php

namespace App\Http\Controllers;

use App\Support\Db;
use App\Support\Js;

class CategoryController extends Controller
{
    private const COUNT_SQL = '(SELECT COUNT(DISTINCT x.producto_id) FROM (SELECT id AS producto_id, categoria_id FROM productos WHERE activo = 1 AND categoria_id IS NOT NULL UNION SELECT pc.producto_id, pc.categoria_id FROM producto_categorias pc JOIN productos pp ON pp.id = pc.producto_id AND pp.activo = 1) x WHERE x.categoria_id = c.id) as total_productos';

    private static function slugify(string $s): string
    {
        return preg_replace('/[^a-z0-9]+/', '-', mb_strtolower(Js::trim($s)));
    }

    public function getCategories()
    {
        try {
            $categories = Db::query('SELECT c.*, ' . self::COUNT_SQL . ' FROM categorias c ORDER BY c.id ASC');
            $occasions = Db::query('SELECT o.*, (SELECT COUNT(*) FROM productos WHERE ocasion_id = o.id AND activo = 1) as total_productos FROM ocasiones o ORDER BY o.id ASC');
            return $this->json(['success' => true, 'categories' => $categories, 'occasions' => $occasions]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al obtener categorías'], 500);
        }
    }

    private function finalSlug(array $b): string
    {
        $slug = $b['slug'] ?? null;
        return (Js::t($slug) && Js::t(Js::trim($slug))) ? self::slugify((string) $slug) : self::slugify((string) $b['nombre']);
    }

    public function createCategory()
    {
        try {
            $b = $this->body();
            $nombre = $b['nombre'] ?? null;
            if (!Js::t($nombre) || !Js::t(Js::trim($nombre))) {
                return $this->json(['success' => false, 'message' => 'El nombre de la categoría es obligatorio'], 400);
            }
            $slug = $this->finalSlug($b);
            if (count(Db::query('SELECT id FROM categorias WHERE slug = ?', [$slug])) > 0) {
                $slug = $slug . '-' . substr((string) Js::now(), -4);
            }
            $res = Db::query('INSERT INTO categorias (nombre, slug, descripcion, icono, color_badge, estado) VALUES (?, ?, ?, ?, ?, ?)', [
                Js::trim($nombre), $slug, Js::or($b['descripcion'] ?? null, ''), Js::or($b['icono'] ?? null, 'Gift'),
                Js::or($b['color_badge'] ?? null, '#FF5E36'), array_key_exists('estado', $b) ? (Js::t($b['estado']) ? 1 : 0) : 1,
            ]);
            $new = Db::query('SELECT c.*, 0 as total_productos FROM categorias c WHERE c.id = ?', [$res['insertId']]);
            return $this->json(['success' => true, 'message' => 'Categoría creada con éxito', 'category' => $new[0] ?? Js::undef()], 201);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error en el servidor al crear la categoría'], 500);
        }
    }

    public function updateCategory($id)
    {
        try {
            $b = $this->body();
            $nombre = $b['nombre'] ?? null;
            if (!Js::t($nombre) || !Js::t(Js::trim($nombre))) {
                return $this->json(['success' => false, 'message' => 'El nombre de la categoría es obligatorio'], 400);
            }
            if (count(Db::query('SELECT id FROM categorias WHERE id = ?', [$id])) === 0) {
                return $this->json(['success' => false, 'message' => 'Categoría no encontrada'], 404);
            }
            $slug = $this->finalSlug($b);
            if (count(Db::query('SELECT id FROM categorias WHERE slug = ? AND id != ?', [$slug, $id])) > 0) {
                $slug = $slug . '-' . substr((string) Js::now(), -4);
            }
            Db::query('UPDATE categorias SET nombre = ?, slug = ?, descripcion = ?, icono = ?, color_badge = ?, estado = ? WHERE id = ?', [
                Js::trim($nombre), $slug, Js::or($b['descripcion'] ?? null, ''), Js::or($b['icono'] ?? null, 'Gift'),
                Js::or($b['color_badge'] ?? null, '#FF5E36'), array_key_exists('estado', $b) ? (Js::t($b['estado']) ? 1 : 0) : 1, $id,
            ]);
            $upd = Db::query('SELECT c.*, ' . self::COUNT_SQL . ' FROM categorias c WHERE c.id = ?', [$id]);
            return $this->json(['success' => true, 'message' => 'Categoría actualizada correctamente', 'category' => $upd[0] ?? Js::undef()]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error en el servidor al actualizar la categoría'], 500);
        }
    }

    public function deleteCategory($id)
    {
        try {
            $p = Db::query('SELECT COUNT(*) as count FROM productos WHERE categoria_id = ?', [$id]);
            if ($p[0]['count'] > 0) {
                return $this->json(['success' => false, 'message' => "No se puede eliminar la categoría porque tiene {$p[0]['count']} producto(s) asociado(s). Reasigna o elimina los productos primero."], 400);
            }
            $res = Db::query('DELETE FROM categorias WHERE id = ?', [$id]);
            if ($res['affectedRows'] === 0) {
                return $this->json(['success' => false, 'message' => 'Categoría no encontrada'], 404);
            }
            return $this->json(['success' => true, 'message' => 'Categoría eliminada con éxito']);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error en el servidor al eliminar categoría'], 500);
        }
    }

    public function createOccasion()
    {
        try {
            $b = $this->body();
            $nombre = $b['nombre'] ?? null;
            if (!Js::t($nombre) || !Js::t(Js::trim($nombre))) {
                return $this->json(['success' => false, 'message' => 'El nombre de la ocasión es obligatorio'], 400);
            }
            $icono = Js::or($b['icono'] ?? null, '🎉');
            $res = Db::query('INSERT INTO ocasiones (nombre, icono) VALUES (?, ?)', [Js::trim($nombre), $icono]);
            return $this->json(['success' => true, 'message' => 'Ocasión creada con éxito', 'occasion' => ['id' => $res['insertId'], 'nombre' => Js::trim($nombre), 'icono' => $icono, 'total_productos' => 0]], 201);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al crear la ocasión'], 500);
        }
    }

    public function updateOccasion($id)
    {
        try {
            $b = $this->body();
            $nombre = $b['nombre'] ?? null;
            if (!Js::t($nombre) || !Js::t(Js::trim($nombre))) {
                return $this->json(['success' => false, 'message' => 'El nombre de la ocasión es obligatorio'], 400);
            }
            Db::query('UPDATE ocasiones SET nombre = ?, icono = ? WHERE id = ?', [Js::trim($nombre), Js::or($b['icono'] ?? null, '🎉'), $id]);
            $upd = Db::query('SELECT o.*, (SELECT COUNT(*) FROM productos WHERE ocasion_id = o.id AND activo = 1) as total_productos FROM ocasiones o WHERE o.id = ?', [$id]);
            return $this->json(['success' => true, 'message' => 'Ocasión actualizada con éxito', 'occasion' => $upd[0] ?? Js::undef()]);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al actualizar ocasión'], 500);
        }
    }

    public function deleteOccasion($id)
    {
        try {
            $p = Db::query('SELECT COUNT(*) as count FROM productos WHERE ocasion_id = ?', [$id]);
            if ($p[0]['count'] > 0) {
                return $this->json(['success' => false, 'message' => "No se puede eliminar la ocasión porque tiene {$p[0]['count']} producto(s) vinculado(s)."], 400);
            }
            Db::query('DELETE FROM ocasiones WHERE id = ?', [$id]);
            return $this->json(['success' => true, 'message' => 'Ocasión eliminada correctamente']);
        } catch (\Throwable $e) {
            report($e);
            return $this->json(['success' => false, 'message' => 'Error al eliminar la ocasión'], 500);
        }
    }
}
