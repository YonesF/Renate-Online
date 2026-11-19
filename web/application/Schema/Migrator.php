<?php

declare(strict_types=1);

namespace App\Schema;

use PDO;
use RuntimeException;

/**
 * updatedb: kjører setup/sql/diff_NNNN.sql i rekkefølge, hver fil én gang.
 *
 * En fil som er kjørt, skal aldri endres. Sjekksummen lagres, og en endret
 * fil stopper kjøringen i stedet for å gi to databaser med ulikt skjema.
 */
final readonly class Migrator
{
    private const string FILE = '/^diff_\d{4}\.sql$/';
    private const string LOCK = 'creativeart.updatedb';

    public function __construct(
        private PDO $pdo,
        private string $directory,
        private string $table = 'schema_migrations',
    ) {
        if (preg_match('/^[a-z_]+$/', $table) !== 1) {
            throw new RuntimeException('Ugyldig tabellnavn for migrasjoner.');
        }
    }

    /**
     * @return list<string> filnavn, sortert
     */
    public function all(): array
    {
        $names = [];
        foreach (scandir($this->directory) ?: [] as $name) {
            if (preg_match(self::FILE, $name) === 1) {
                $names[] = $name;
            }
        }
        sort($names);

        return $names;
    }

    /**
     * @return list<string>
     */
    public function pending(): array
    {
        return array_values(array_diff($this->all(), array_keys($this->applied())));
    }

    /**
     * @return list<string> filene som ble kjørt nå
     */
    public function migrate(): array
    {
        $locked = $this->pdo->prepare('SELECT GET_LOCK(?, 10)');
        $locked->execute([self::LOCK]);
        if ((int) $locked->fetchColumn() !== 1) {
            throw new RuntimeException('En annen updatedb kjører allerede.');
        }

        try {
            $this->pdo->exec(
                "CREATE TABLE IF NOT EXISTS {$this->table} (
                    name VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
                    checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
                    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (name)
                ) ENGINE=InnoDB",
            );

            $applied = $this->applied();
            $ran = [];
            foreach ($this->all() as $name) {
                $sql = (string) file_get_contents("{$this->directory}/{$name}");
                $checksum = hash('sha256', $sql);

                if (isset($applied[$name])) {
                    if ($applied[$name] !== $checksum) {
                        throw new RuntimeException("{$name} er endret etter at den ble kjørt. Lag en ny fil i stedet.");
                    }
                    continue;
                }

                foreach (self::statements($sql) as $statement) {
                    $this->pdo->exec($statement);
                }
                $insert = $this->pdo->prepare("INSERT INTO {$this->table} (name, checksum) VALUES (?, ?)");
                $insert->execute([$name, $checksum]);
                $ran[] = $name;
            }

            return $ran;
        } finally {
            $release = $this->pdo->prepare('SELECT RELEASE_LOCK(?)');
            $release->execute([self::LOCK]);
        }
    }

    /**
     * @return array<string, string> filnavn → sjekksum
     */
    private function applied(): array
    {
        $exists = $this->pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
        );
        $exists->execute([$this->table]);
        if ((int) $exists->fetchColumn() === 0) {
            return [];
        }

        $applied = [];
        foreach ($this->pdo->query("SELECT name, checksum FROM {$this->table}") ?: [] as $row) {
            $applied[(string) $row['name']] = (string) $row['checksum'];
        }

        return $applied;
    }

    /**
     * Deler på semikolon ved linjeslutt. Holder for DDL-filene våre.
     *
     * @return list<string>
     */
    private static function statements(string $sql): array
    {
        $withoutComments = preg_replace('/^\s*--.*$/m', '', $sql) ?? '';
        $statements = [];
        foreach (preg_split('/;\s*(?:\R|$)/', $withoutComments) ?: [] as $statement) {
            if (trim($statement) !== '') {
                $statements[] = trim($statement);
            }
        }

        return $statements;
    }
}
