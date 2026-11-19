<?php

declare(strict_types=1);

namespace App\Http;

/**
 * Ett nettsted fra configuration/hostmap.php.
 */
final readonly class Site
{
    /**
     * @param list<string> $frameAncestors opprinnelser som får vise nettstedet i en ramme
     * @param ?string $panel opprinnelsen til Lenas panel, for nettsteder som viser det i en ramme
     */
    public function __construct(
        public string $name,
        public bool $framed = false,
        public array $frameAncestors = [],
        public ?string $panel = null,
    ) {
    }
}
