<?php

namespace App\Support;

use PDOException;
use RuntimeException;

/**
 * Error de MySQL con el mismo `message` y `code` (ER_DUP_ENTRY, ER_NO_SUCH_TABLE...) que entrega mysql2.
 */
final class DbError extends RuntimeException
{
    public string $errCode = '';
    public int $errno = 0;
    public string $sqlState = '';
    public string $sql = '';

    private const NAMES = [
        1048 => 'ER_BAD_NULL_ERROR', 1050 => 'ER_TABLE_EXISTS_ERROR', 1054 => 'ER_BAD_FIELD_ERROR',
        1060 => 'ER_DUP_FIELDNAME', 1061 => 'ER_DUP_KEYNAME', 1062 => 'ER_DUP_ENTRY', 1064 => 'ER_PARSE_ERROR',
        1091 => 'ER_CANT_DROP_FIELD_OR_KEY', 1136 => 'ER_WRONG_VALUE_COUNT_ON_ROW', 1146 => 'ER_NO_SUCH_TABLE',
        1264 => 'ER_WARN_DATA_OUT_OF_RANGE', 1265 => 'WARN_DATA_TRUNCATED', 1292 => 'ER_TRUNCATED_WRONG_VALUE',
        1364 => 'ER_NO_DEFAULT_FOR_FIELD', 1366 => 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', 1406 => 'ER_DATA_TOO_LONG',
        1451 => 'ER_ROW_IS_REFERENCED_2', 1452 => 'ER_NO_REFERENCED_ROW_2', 1213 => 'ER_LOCK_DEADLOCK',
        1205 => 'ER_LOCK_WAIT_TIMEOUT', 1040 => 'ER_CON_COUNT_ERROR', 2006 => 'ER_SERVER_GONE_ERROR',
    ];

    public static function from(PDOException $e, string $sql = ''): self
    {
        $info = $e->errorInfo ?? [];
        $errno = (int) ($info[1] ?? 0);
        $msg = $info[2] ?? $e->getMessage();
        $err = new self($msg, 0, $e);
        $err->errno = $errno;
        $err->sqlState = (string) ($info[0] ?? '');
        $err->errCode = self::NAMES[$errno] ?? ('ER_' . $errno);
        $err->sql = $sql;
        return $err;
    }

    /** Código estilo mysql2 de cualquier excepción ('' si no es de MySQL) */
    public static function codeOf(\Throwable $e): string
    {
        return $e instanceof self ? $e->errCode : '';
    }
}
