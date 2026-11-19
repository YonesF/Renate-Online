<?php

declare(strict_types=1);

namespace App\Tests\Fake;

use App\Knowledge\Fetcher;
use App\Knowledge\FetchFailed;

/**
 * Står for nettet i testene. Svarer med det testen har lagt inn, feiler
 * for alt annet, og husker hva som ble spurt om.
 */
final class FakeFetcher implements Fetcher
{
    private const string PNG_BASE64
        = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    /** @var array<string, string> adresse → bytes */
    public array $responses = [];

    /** @var list<string> */
    public array $requested = [];

    /**
     * Et gyldig PNG-bilde på 1×1 piksel.
     */
    public static function png(): string
    {
        return (string) base64_decode(self::PNG_BASE64, true);
    }

    public function fetch(string $url): string
    {
        $this->requested[] = $url;

        return $this->responses[$url] ?? throw new FetchFailed('status 404');
    }
}
