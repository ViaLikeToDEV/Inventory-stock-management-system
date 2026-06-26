<?php

namespace App\DTOs;

class OrderFetchResult
{
    public function __construct(
        public readonly object $data,
        public readonly bool $versionMismatchDetected,
    ) {}
}
