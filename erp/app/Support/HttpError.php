<?php

namespace App\Support;

use RuntimeException;

/** Error con código HTTP (equivale a httpError(status, message) del backend Node). */
final class HttpError extends RuntimeException
{
    public int $status;

    public function __construct(int $status, string $message)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}
