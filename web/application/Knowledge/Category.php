<?php

declare(strict_types=1);

namespace App\Knowledge;

final readonly class Category
{
    public function __construct(
        public string $slug,
        public string $name,
        public int $documents,
    ) {
    }
}
