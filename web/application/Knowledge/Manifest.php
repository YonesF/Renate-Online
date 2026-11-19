<?php

declare(strict_types=1);

namespace App\Knowledge;

/**
 * knowledge/knowledge.json: hvilke kategorier som finnes, hvilke mapper
 * som er guider, og hvem som får se dem.
 *
 * Metadataene ligger her og ikke i Markdown-filene. Filene er eksporter
 * som byttes ut når guiden oppdateres, og da ville de ha forsvunnet.
 */
final readonly class Manifest
{
    public const array AUDIENCES = ['public', 'customer', 'internal'];
    public const array STATUSES = ['draft', 'published'];

    private const string SLUG = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

    /**
     * @param list<string> $imageHosts
     * @param list<array{slug: string, name: string}> $categories
     * @param list<array{folder: string, category: string, slug: string, title: string, audience: string, status: string}> $guides
     */
    private function __construct(
        public array $imageHosts,
        public array $categories,
        public array $guides,
    ) {
    }

    public static function load(string $path): self
    {
        if (!is_file($path)) {
            throw new ImportFailed("Fant ikke {$path}.");
        }

        $data = json_decode((string) file_get_contents($path), true);
        if (!is_array($data)) {
            throw new ImportFailed('knowledge.json er ikke gyldig JSON.');
        }

        $hosts = [];
        foreach (self::items($data, 'image_hosts') as $host) {
            if (!is_string($host) || $host === '') {
                throw new ImportFailed('image_hosts må være en liste med vertsnavn.');
            }
            $hosts[] = strtolower($host);
        }

        $categories = [];
        $known = [];
        foreach (self::items($data, 'categories') as $entry) {
            $slug = self::text($entry, 'slug', 'categories');
            if (preg_match(self::SLUG, $slug) !== 1 || isset($known[$slug])) {
                throw new ImportFailed("Kategorien «{$slug}» har ugyldig eller gjentatt slug.");
            }
            $known[$slug] = true;
            $categories[] = ['slug' => $slug, 'name' => self::text($entry, 'name', 'categories')];
        }
        if ($categories === []) {
            throw new ImportFailed('knowledge.json må ha minst én kategori.');
        }

        $guides = [];
        $seen = [];
        foreach (self::items($data, 'guides') as $entry) {
            $folder = trim(self::text($entry, 'folder', 'guides'), '/');
            $parts = explode('/', $folder);
            if (count($parts) !== 2 || preg_match(self::SLUG, $parts[0]) !== 1 || preg_match(self::SLUG, $parts[1]) !== 1) {
                throw new ImportFailed("Guidemappen «{$folder}» må være kategori/guide.");
            }
            if (!isset($known[$parts[0]])) {
                throw new ImportFailed("Guiden «{$folder}» ligger i en kategori som ikke står i categories.");
            }
            if (isset($seen[$parts[1]])) {
                throw new ImportFailed("Guiden «{$parts[1]}» står to ganger.");
            }
            $seen[$parts[1]] = true;

            // Uten oppgitt målgruppe og status er en guide intern og utkast.
            $audience = is_array($entry) && is_string($entry['audience'] ?? null) ? $entry['audience'] : 'internal';
            $status = is_array($entry) && is_string($entry['status'] ?? null) ? $entry['status'] : 'draft';
            if (!in_array($audience, self::AUDIENCES, true) || !in_array($status, self::STATUSES, true)) {
                throw new ImportFailed("Guiden «{$folder}» har ugyldig audience eller status.");
            }

            $guides[] = [
                'folder' => $folder,
                'category' => $parts[0],
                'slug' => $parts[1],
                'title' => self::text($entry, 'title', 'guides'),
                'audience' => $audience,
                'status' => $status,
            ];
        }

        return new self($hosts, $categories, $guides);
    }

    /**
     * @param array<array-key, mixed> $data
     * @return list<mixed>
     */
    private static function items(array $data, string $key): array
    {
        $items = $data[$key] ?? [];
        if (!is_array($items) || !array_is_list($items)) {
            throw new ImportFailed("{$key} i knowledge.json må være en liste.");
        }

        return $items;
    }

    private static function text(mixed $entry, string $key, string $section): string
    {
        $value = is_array($entry) ? ($entry[$key] ?? null) : null;
        if (!is_string($value) || trim($value) === '') {
            throw new ImportFailed("Hver oppføring i {$section} må ha {$key}.");
        }

        return trim($value);
    }
}
