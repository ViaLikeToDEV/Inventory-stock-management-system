<?php

namespace App\Exceptions;

use RuntimeException;

class OrderFetchException extends RuntimeException
{
    public function __construct(string $message, int $statusCode = 500)
    {
        parent::__construct($message, $statusCode);
    }

    public function getStatusCode(): int
    {
        return $this->getCode();
    }
}
