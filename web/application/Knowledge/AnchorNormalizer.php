<?php

declare(strict_types=1);

namespace App\Knowledge;

use League\CommonMark\Normalizer\TextNormalizerInterface;

/**
 * Lar Markdown-biblioteket lage overskriftsankre med Slug, slik at
 * «Steg 1: Hoderengjøring (Head Cleaning)» blir steg-1-hoderengjoring-head-cleaning.
 */
final class AnchorNormalizer implements TextNormalizerInterface
{
    /**
     * @param array<string, mixed> $context
     */
    public function normalize(string $text, array $context = []): string
    {
        $length = is_int($context['length'] ?? null) && $context['length'] > 0 ? $context['length'] : 96;
        $slug = Slug::of($text, $length);

        return $slug === '' ? 'avsnitt' : $slug;
    }
}
