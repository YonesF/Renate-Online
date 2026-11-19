<?php

declare(strict_types=1);

namespace App\Http;

final readonly class Route
{
    /**
     * @param list<string> $args
     */
    public function __construct(
        public string $file,
        public ?string $action,
        public array $args,
    ) {
    }
}
