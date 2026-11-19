<?php

declare(strict_types=1);

namespace App\Knowledge;

/**
 * Henter bytes fra en adresse. Importen bruker HttpFetcher; testene en falsk.
 */
interface Fetcher
{
    /**
     * @throws FetchFailed
     */
    public function fetch(string $url): string;
}
