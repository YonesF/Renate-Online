<?php

declare(strict_types=1);

namespace App\Knowledge;

/**
 * Bildene i kunnskapsbasen, speilet til egen server.
 *
 * Filene ligger i knowledge/assets med innholdets hash som navn, og
 * index.json husker hvilken adresse hvert bilde kom fra. Da er mappen
 * selvforsynt: en ny import trenger ikke nettet, og bildene overlever
 * at kilden forsvinner.
 */
final class ImageStore
{
    private const array TYPES = [
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
    ];

    /** @var array<string, string> adresse → filnavn */
    private array $index = [];

    private bool $changed = false;

    public int $fetched = 0;

    /**
     * @param list<string> $allowedHosts
     */
    public function __construct(
        private readonly string $directory,
        private readonly Fetcher $fetcher,
        private readonly array $allowedHosts,
    ) {
        $path = "{$this->directory}/index.json";
        $stored = is_file($path) ? json_decode((string) file_get_contents($path), true) : null;
        foreach (is_array($stored) ? $stored : [] as $url => $file) {
            if (is_string($url) && is_string($file)) {
                $this->index[$url] = $file;
            }
        }
    }

    /**
     * @return string id-en bildet serveres under: /media/<id>
     * @throws FetchFailed
     */
    public function mirror(string $url): string
    {
        $known = $this->index[$url] ?? null;
        if ($known !== null && is_file("{$this->directory}/{$known}")) {
            return pathinfo($known, PATHINFO_FILENAME);
        }

        $host = parse_url($url, PHP_URL_HOST);
        if (!is_string($host) || !in_array(strtolower($host), $this->allowedHosts, true)) {
            throw new FetchFailed('verten står ikke i image_hosts i knowledge.json');
        }

        $bytes = $this->fetcher->fetch($url);
        $info = @getimagesizefromstring($bytes);
        $extension = is_array($info) ? (self::TYPES[$info['mime']] ?? null) : null;
        if ($extension === null) {
            throw new FetchFailed('ikke et bilde av en tillatt type');
        }

        $id = substr(hash('sha256', $bytes), 0, 32);
        $file = "{$id}.{$extension}";
        if (!is_dir($this->directory)) {
            mkdir($this->directory, recursive: true);
        }
        if (!is_file("{$this->directory}/{$file}")) {
            file_put_contents("{$this->directory}/{$file}", $bytes);
        }

        $this->index[$url] = $file;
        $this->changed = true;
        $this->fetched++;

        return $id;
    }

    public function save(): void
    {
        if (!$this->changed) {
            return;
        }

        ksort($this->index);
        $json = json_encode($this->index, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        file_put_contents("{$this->directory}/index.json", $json . "\n");
        $this->changed = false;
    }

    /**
     * @return array{path: string, mime: string}|null
     */
    public static function locate(string $directory, string $id): ?array
    {
        if (preg_match('/^[0-9a-f]{32}$/', $id) !== 1) {
            return null;
        }

        foreach (self::TYPES as $mime => $extension) {
            $path = "{$directory}/{$id}.{$extension}";
            if (is_file($path)) {
                return ['path' => $path, 'mime' => $mime];
            }
        }

        return null;
    }
}
