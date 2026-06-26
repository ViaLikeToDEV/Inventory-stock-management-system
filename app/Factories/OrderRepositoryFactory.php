<?php

namespace App\Factories;

use App\Repositories\OrderRepositoryInterface;
use App\Repositories\SqliteOrderRepository;
use App\Repositories\ApiOrderRepository;

class OrderRepositoryFactory
{
    public static function make(string $mode, $controllerInstance): OrderRepositoryInterface
    {
        return match ($mode) {
            'sqlite' => new SqliteOrderRepository($controllerInstance),
            default  => new ApiOrderRepository($controllerInstance),
        };
    }
}
