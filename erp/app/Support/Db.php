<?php

namespace App\Support;

use Illuminate\Support\Facades\DB as LaravelDB;
use PDO;
use PDOException;

/**
 * Acceso a MySQL con el mismo comportamiento que `pool.query(sql, params)` de mysql2 en el backend Node:
 *  - Sustitución de `?` en el cliente con el mismo escape (arrays → listas, objetos → `col` = valor, `??` → identificador).
 *  - SELECT devuelve filas como arrays asociativos; INSERT/UPDATE/DELETE devuelven ['insertId', 'affectedRows'].
 * De esta forma las consultas SQL del sistema original se reutilizan sin cambios.
 */
final class Db
{
    public static function pdo(): PDO
    {
        return LaravelDB::connection()->getPdo();
    }

    /**
     * Ejecuta una consulta. Devuelve filas (SELECT/SHOW) o un resultado tipo ResultSetHeader.
     * @return array<int, array<string, mixed>>|array{insertId:int, affectedRows:int, changedRows:int}
     */
    public static function query(string $sql, $values = []): array
    {
        $final = self::format($sql, $values);
        try {
            $stmt = self::pdo()->query($final);
        } catch (PDOException $e) {
            throw DbError::from($e, $final);
        }
        if ($stmt->columnCount() > 0) {
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        $pdo = self::pdo();
        return [
            'insertId' => (int) $pdo->lastInsertId(),
            'affectedRows' => $stmt->rowCount(),
            'changedRows' => $stmt->rowCount(),
        ];
    }

    /** Primera fila o null */
    public static function first(string $sql, $values = []): ?array
    {
        $rows = self::query($sql, $values);
        return $rows[0] ?? null;
    }

    public static function begin(): void
    {
        self::pdo()->beginTransaction();
    }

    public static function commit(): void
    {
        if (self::pdo()->inTransaction()) self::pdo()->commit();
    }

    public static function rollback(): void
    {
        try {
            if (self::pdo()->inTransaction()) self::pdo()->rollBack();
        } catch (\Throwable $e) {
            // igual que `.catch(() => {})`
        }
    }

    /** Ejecuta y descarta errores (equivalente a `.catch(() => {})`) */
    public static function try(string $sql, $values = []): ?array
    {
        try {
            return self::query($sql, $values);
        } catch (\Throwable $e) {
            return null;
        }
    }

    // ---------------------------------------------------------------------
    // Formato idéntico a sqlstring (usado por mysql2)
    // ---------------------------------------------------------------------

    public static function format(string $sql, $values = []): string
    {
        if ($values === null || $values instanceof Undef) return $sql;
        if (!is_array($values) || !array_is_list($values)) $values = [$values];
        $index = 0;
        $count = count($values);
        return preg_replace_callback('/\?+/', function ($m) use (&$index, $count, $values) {
            $len = strlen($m[0]);
            if ($len > 2 || $index >= $count) return $m[0];
            $v = $values[$index++];
            return $len === 2 ? self::escapeId($v) : self::escape($v);
        }, $sql);
    }

    public static function escapeId($val, bool $forbidQualified = false): string
    {
        if (is_array($val) && array_is_list($val)) {
            return implode(', ', array_map(fn ($v) => self::escapeId($v, $forbidQualified), $val));
        }
        $s = Js::str($val);
        if ($forbidQualified) return '`' . str_replace('`', '``', $s) . '`';
        return '`' . str_replace(['`', '.'], ['``', '`.`'], $s) . '`';
    }

    public static function escape($val, bool $nested = false): string
    {
        if ($val === null || $val instanceof Undef) return 'NULL';
        if (is_bool($val)) return $val ? 'true' : 'false';
        if (is_int($val) || is_float($val)) return Js::numToString($val);
        if (is_array($val)) {
            if (array_is_list($val)) return self::arrayToList($val);
            return self::objectToValues($val);
        }
        if ($val instanceof \DateTimeInterface) return self::escapeString($val->format('Y-m-d H:i:s.v'));
        return self::escapeString((string) $val);
    }

    private static function arrayToList(array $arr): string
    {
        $out = [];
        foreach ($arr as $v) {
            $out[] = (is_array($v) && array_is_list($v)) ? '(' . self::arrayToList($v) . ')' : self::escape($v, true);
        }
        return implode(', ', $out);
    }

    private static function objectToValues(array $obj): string
    {
        $out = [];
        foreach ($obj as $k => $v) {
            if ($v instanceof \Closure) continue;
            $out[] = self::escapeId((string) $k) . ' = ' . self::escape($v, true);
        }
        return implode(', ', $out);
    }

    public static function escapeString(string $s): string
    {
        static $map = [
            "\0" => '\\0', "\x08" => '\\b', "\t" => '\\t', "\n" => '\\n', "\r" => '\\r',
            "\x1a" => '\\Z', '"' => '\\"', "'" => "\\'", '\\' => '\\\\',
        ];
        return "'" . strtr($s, $map) . "'";
    }
}
