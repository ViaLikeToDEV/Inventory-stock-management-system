<?php

namespace App\Repositories;

use App\DTOs\OrderFetchResult;

interface OrderRepositoryInterface
{
    public function fetchOrder(string $searchId, array $searchParameter): OrderFetchResult;
}
