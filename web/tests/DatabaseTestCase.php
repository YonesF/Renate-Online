<?php

declare(strict_types=1);

namespace App\Tests;

use App\Config;
use App\Database;
use App\Schema\Migrator;
use PDO;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * Tester mot en ekte MySQL: testdatabasen mysql-test i docker-compose.yml.
 *
 * Skjemaet bygges én gang per kjøring med de ekte migrasjonene, og
 * tabellene tømmes før hver test. Kjør via bin/check, som starter databasen.
 */
abstract class DatabaseTestCase extends TestCase
{
    private static ?PDO $shared = null;

    protected PDO $pdo;

    /** En tom mappe som står for knowledge/ i testen. */
    protected string $knowledge;

    protected function setUp(): void
    {
        $this->pdo = self::database();
        $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        foreach (['messages', 'conversations', 'rate_events', 'kb_documents', 'kb_guides', 'kb_categories'] as $table) {
            $this->pdo->exec("TRUNCATE TABLE {$table}");
        }
        $this->pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

        $this->knowledge = sys_get_temp_dir() . '/ca-knowledge-' . bin2hex(random_bytes(6));
        mkdir($this->knowledge);
    }

    protected function tearDown(): void
    {
        self::remove($this->knowledge);
    }

    /**
     * Innstillingene en Kernel trenger for å bruke testdatabasen og testmappen.
     */
    protected function config(): Config
    {
        return new Config([
            'MYSQL_HOST' => self::env('TEST_MYSQL_HOST'),
            'MYSQL_DATABASE' => self::env('TEST_MYSQL_DATABASE'),
            'MYSQL_USER' => self::env('TEST_MYSQL_USER'),
            'MYSQL_PASSWORD' => self::env('TEST_MYSQL_PASSWORD'),
            'KNOWLEDGE_DIR' => $this->knowledge,
            'APP_SECRET' => self::env('TEST_APP_SECRET'),
        ]);
    }

    protected function write(string $relative, string $content): void
    {
        $path = "{$this->knowledge}/{$relative}";
        if (!is_dir(dirname($path))) {
            mkdir(dirname($path), recursive: true);
        }
        file_put_contents($path, $content);
    }

    private static function database(): PDO
    {
        if (self::$shared !== null) {
            return self::$shared;
        }

        $pdo = Database::connect(
            self::env('TEST_MYSQL_HOST'),
            self::env('TEST_MYSQL_DATABASE'),
            self::env('TEST_MYSQL_USER'),
            self::env('TEST_MYSQL_PASSWORD'),
        );

        // Start fra tomt, så en endret migrasjon aldri møter et gammelt skjema.
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        $tables = $pdo->query('SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()');
        foreach ($tables === false ? [] : $tables->fetchAll(PDO::FETCH_COLUMN) as $table) {
            $pdo->exec('DROP TABLE `' . str_replace('`', '', (string) $table) . '`');
        }
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

        new Migrator($pdo, dirname(__DIR__) . '/setup/sql')->migrate();

        return self::$shared = $pdo;
    }

    private static function env(string $name): string
    {
        $value = getenv($name);
        if (!is_string($value) || $value === '') {
            throw new RuntimeException("{$name} mangler. Databasetestene kjøres via bin/check.");
        }

        return $value;
    }

    private static function remove(string $path): void
    {
        if (is_dir($path)) {
            foreach (scandir($path) ?: [] as $name) {
                if ($name !== '.' && $name !== '..') {
                    self::remove("{$path}/{$name}");
                }
            }
            rmdir($path);
        } elseif (is_file($path)) {
            unlink($path);
        }
    }
}
