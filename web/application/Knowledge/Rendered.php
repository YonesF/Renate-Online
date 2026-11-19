<?php

declare(strict_types=1);

namespace App\Knowledge;

/**
 * Et ferdig rendret dokument: trygg HTML og innholdsfortegnelsen.
 */
final readonly class Rendered
{
    /**
     * @param list<array{id: string, text: string, level: int}> $toc
     */
    public function __construct(
        public string $html,
        public array $toc,
    ) {
    }
}
