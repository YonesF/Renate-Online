<?php

declare(strict_types=1);

namespace App\Knowledge;

/**
 * Henter over HTTPS. Følger ikke videresendinger, og avbryter når svaret
 * blir større enn grensen. Hvilke verter som er lov, avgjør ImageStore.
 */
final readonly class HttpFetcher implements Fetcher
{
    public function __construct(private int $maxBytes = 8_000_000)
    {
    }

    public function fetch(string $url): string
    {
        if (!str_starts_with($url, 'https://')) {
            throw new FetchFailed('bare https er tillatt');
        }

        $handle = curl_init($url);
        if ($handle === false) {
            throw new FetchFailed('ugyldig adresse');
        }

        $body = '';
        $limit = $this->maxBytes;
        curl_setopt_array($handle, [
            CURLOPT_PROTOCOLS_STR => 'https',
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 30,
            // Å returnere noe annet enn lengden avbryter overføringen.
            CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body, $limit): int {
                $body .= $chunk;

                return strlen($body) > $limit ? -1 : strlen($chunk);
            },
        ]);

        $ok = curl_exec($handle);
        if (strlen($body) > $limit) {
            throw new FetchFailed("større enn {$limit} byte");
        }
        if ($ok === false) {
            throw new FetchFailed(curl_error($handle) ?: 'ingen forbindelse');
        }

        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        if ($status !== 200) {
            throw new FetchFailed("status {$status}");
        }

        return $body;
    }
}
