<?php

declare(strict_types=1);

namespace App\Knowledge;

/**
 * Fra tittel eller overskrift til en adressevennlig tekst: små bokstaver,
 * tall og bindestrek. Brukes for artikkeladresser og for ankre, og senere
 * av oppdelingen i passasjer, slik at et søketreff lenker til riktig avsnitt.
 */
final class Slug
{
    private const array LETTERS = [
        'æ' => 'ae', 'ø' => 'o', 'å' => 'a',
        'ä' => 'a', 'ö' => 'o', 'ü' => 'u', 'ß' => 'ss',
        'é' => 'e', 'è' => 'e', 'ê' => 'e', 'á' => 'a', 'à' => 'a',
        'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'í' => 'i', 'ú' => 'u',
        'ñ' => 'n', 'ç' => 'c',
    ];

    public static function of(string $text, int $maxLength = 96): string
    {
        $lower = strtr(mb_strtolower($text, 'UTF-8'), self::LETTERS);
        $slug = trim(preg_replace('/[^a-z0-9]+/', '-', $lower) ?? '', '-');

        if (strlen($slug) > $maxLength) {
            $slug = rtrim(substr($slug, 0, $maxLength), '-');
        }

        return $slug;
    }
}
