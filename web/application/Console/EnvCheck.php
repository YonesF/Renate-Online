<?php

declare(strict_types=1);

namespace App\Console;

use App\Config;
use App\Database;
use App\Schema\Migrator;
use PDOException;
use RuntimeException;

/**
 * env:check: det første å se på når noe virker rart.
 *
 * Sjekker det interne tokenet, MySQL, og at search og agent både svarer
 * og godtar tokenet. API-nøkler som mangler, er en advarsel, ikke en feil:
 * tjenestene starter uten dem, men kan ikke gjøre jobben sin.
 */
final readonly class EnvCheck
{
    private const string OK = 'OK';
    private const string WARNING = 'OBS';
    private const string FAILED = 'FEIL';

    private const int MIN_TOKEN_LENGTH = 32;

    public function __construct(
        private Config $config,
        private string $root,
    ) {
    }

    public function run(): int
    {
        $rows = [
            $this->token(),
            ...$this->mysql(),
            ...$this->service('search', 'SEARCH_URL', '/v1/search'),
            ...$this->service('agent', 'AGENT_URL', '/v1/runs'),
        ];

        $failed = false;
        foreach ($rows as [$level, $name, $detail]) {
            printf("%-5s %-28s %s\n", $level, $name, $detail);
            $failed = $failed || $level === self::FAILED;
        }

        return $failed ? 1 : 0;
    }

    /**
     * @return array{string, string, string}
     */
    private function token(): array
    {
        $length = strlen($this->config->get('INTERNAL_TOKEN') ?? '');
        if ($length < self::MIN_TOKEN_LENGTH) {
            return [self::FAILED, 'INTERNAL_TOKEN', 'mangler eller er kortere enn ' . self::MIN_TOKEN_LENGTH . ' tegn'];
        }

        return [self::OK, 'INTERNAL_TOKEN', "satt ({$length} tegn)"];
    }

    /**
     * @return list<array{string, string, string}>
     */
    private function mysql(): array
    {
        try {
            $pdo = new Database($this->config)->pdo();
            $statement = $pdo->query('SELECT VERSION()');
            $version = $statement === false ? false : $statement->fetchColumn();
            $migrator = new Migrator($pdo, "{$this->root}/setup/sql");
            $all = count($migrator->all());
            $pending = count($migrator->pending());
        } catch (PDOException | RuntimeException $error) {
            return [[self::FAILED, 'mysql', $error->getMessage()]];
        }

        return [
            [self::OK, 'mysql', 'versjon ' . (is_string($version) ? $version : 'ukjent')],
            $pending === 0
                ? [self::OK, 'mysql.schema', "{$all} av {$all} migrasjoner kjørt"]
                : [self::WARNING, 'mysql.schema', "{$pending} migrasjon(er) venter. Kjør: bin/console updatedb"],
        ];
    }

    /**
     * @return list<array{string, string, string}>
     */
    private function service(string $name, string $urlVariable, string $guardedPath): array
    {
        $url = $this->config->get($urlVariable);
        if ($url === null) {
            return [[self::FAILED, $name, "{$urlVariable} mangler"]];
        }
        $url = rtrim($url, '/');

        [$status, $body] = $this->http('GET', "{$url}/healthz");
        $health = $status === 200 ? json_decode($body, true) : null;
        if (!is_array($health)) {
            return [[self::FAILED, $name, "svarer ikke på {$url}/healthz"]];
        }

        $version = is_string($health['version'] ?? null) ? $health['version'] : 'ukjent';
        $rows = [[self::OK, $name, "versjon {$version}"]];

        foreach (is_array($health['checks'] ?? null) ? $health['checks'] : [] as $check => $value) {
            $value = is_string($value) ? $value : 'ukjent';
            $level = match ($value) {
                'unreachable' => self::FAILED,
                'missing' => self::WARNING,
                default => self::OK,
            };
            $rows[] = [$level, "{$name}.{$check}", $value];
        }

        // Et kall til et vernet endepunkt viser om begge sider har samme token.
        $token = $this->config->get('INTERNAL_TOKEN') ?? '';
        [$status] = $this->http('POST', $url . $guardedPath, ["Authorization: Bearer {$token}"], '{}');
        $rows[] = in_array($status, [0, 401, 403], true)
            ? [self::FAILED, "{$name}.token", "godtar ikke INTERNAL_TOKEN (status {$status})"]
            : [self::OK, "{$name}.token", "godtar INTERNAL_TOKEN (status {$status})"];

        return $rows;
    }

    /**
     * @param list<string> $headers
     * @return array{int, string} status 0 betyr at tjenesten ikke svarte
     */
    private function http(string $method, string $url, array $headers = [], ?string $body = null): array
    {
        $handle = curl_init($url);
        if ($handle === false) {
            return [0, ''];
        }

        $options = [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 2,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_HTTPHEADER => [...$headers, 'Content-Type: application/json'],
        ];
        if ($body !== null) {
            $options[CURLOPT_POSTFIELDS] = $body;
        }
        curl_setopt_array($handle, $options);

        $response = curl_exec($handle);
        if (!is_string($response)) {
            return [0, ''];
        }

        return [(int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE), $response];
    }
}
