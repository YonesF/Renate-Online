<?php

declare(strict_types=1);

namespace App\Knowledge;

/**
 * Artiklene i én guide, eller de frittstående artiklene i en kategori
 * (da er slug og title null).
 */
final readonly class Group
{
    /**
     * @param list<Listing> $documents
     */
    public function __construct(
        public ?string $slug,
        public ?string $title,
        public string $categorySlug,
        public string $categoryName,
        public array $documents,
    ) {
    }
}
