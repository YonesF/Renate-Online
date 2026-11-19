<?php

declare(strict_types=1);

namespace App\Chat;

use PDO;

/**
 * Tak på hvor mye én enhet eller én adresse kan sende. Hver melding koster
 * et kall til Claude, så dette er også kostnadskontroll.
 */
final readonly class RateLimit
{
    public function __construct(private PDO $pdo)
    {
    }

    /**
     * Teller forsøket og svarer om det er innenfor grensen.
     */
    public function allow(string $name, int $limit, int $windowSeconds): bool
    {
        $bucket = hash('sha256', $name);

        $count = $this->pdo->prepare(
            'SELECT COUNT(*) FROM rate_events WHERE bucket = ? AND created_at > UTC_TIMESTAMP() - INTERVAL ? SECOND',
        );
        $count->execute([$bucket, $windowSeconds]);
        if ((int) $count->fetchColumn() >= $limit) {
            return false;
        }

        $this->pdo->prepare('INSERT INTO rate_events (bucket, created_at) VALUES (?, UTC_TIMESTAMP())')->execute([$bucket]);
        if (random_int(1, 50) === 1) {
            $this->pdo->exec('DELETE FROM rate_events WHERE created_at < UTC_TIMESTAMP() - INTERVAL 1 DAY');
        }

        return true;
    }
}
