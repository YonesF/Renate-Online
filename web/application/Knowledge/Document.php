<?php

declare(strict_types=1);

namespace App\Knowledge;

final readonly class Document
{
    public function __construct(
        public string $uid,
        public string $slug,
        public string $title,
        public string $markdown,
        public string $categorySlug,
        public string $categoryName,
        public ?string $guideSlug,
        public ?string $guideTitle,
        public ?Listing $previous,
        public ?Listing $next,
    ) {
    }
}
