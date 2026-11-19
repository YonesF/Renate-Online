<?php

declare(strict_types=1);

namespace App\Knowledge;

/**
 * Én Markdown-fil på vei inn i kunnskapsbasen.
 */
final class SourceDocument
{
    /** Teksten slik den lagres: renset, med interne lenker og speilede bilder. */
    public string $markdown = '';

    public string $summary = '';

    public function __construct(
        public readonly string $file,
        public readonly string $title,
        public readonly string $slug,
        public readonly int $order,
        public readonly string $body,
        public readonly string $category,
        public readonly ?string $guide,
        public readonly string $audience,
        public readonly string $status,
    ) {
    }
}
