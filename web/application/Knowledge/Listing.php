<?php

declare(strict_types=1);

namespace App\Knowledge;

/**
 * En artikkel slik den vises i en liste: nok til en lenke og en ingress.
 */
final readonly class Listing
{
    public function __construct(
        public string $slug,
        public string $title,
        public string $summary,
    ) {
    }
}
