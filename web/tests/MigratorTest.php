<?php

declare(strict_types=1);

namespace App\Tests;

use App\Schema\Migrator;
use RuntimeException;

final class MigratorTest extends DatabaseTestCase
{
    private const string TABLE = 'zz_test_migrations';

    private string $directory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->directory = "{$this->knowledge}/sql";
        mkdir($this->directory);
        $this->dropProbes();
    }

    protected function tearDown(): void
    {
        $this->dropProbes();

        parent::tearDown();
    }

    private function dropProbes(): void
    {
        foreach ([self::TABLE, 'zz_probe_a', 'zz_probe_b'] as $table) {
            $this->pdo->exec("DROP TABLE IF EXISTS {$table}");
        }
    }

    private function migrator(): Migrator
    {
        return new Migrator($this->pdo, $this->directory, self::TABLE);
    }

    private function exists(string $table): bool
    {
        $statement = $this->pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
        );
        $statement->execute([$table]);

        return (int) $statement->fetchColumn() === 1;
    }

    public function testFilesRunInOrderAndOnlyOnce(): void
    {
        file_put_contents("{$this->directory}/diff_0002.sql", "CREATE TABLE zz_probe_b (id INT PRIMARY KEY);\n");
        file_put_contents(
            "{$this->directory}/diff_0001.sql",
            "-- En kommentar med ; i.\nCREATE TABLE zz_probe_a (id INT PRIMARY KEY);\nINSERT INTO zz_probe_a VALUES (1);\n",
        );
        file_put_contents("{$this->directory}/notater.sql", "DROP TABLE zz_probe_a;\n");

        self::assertSame(['diff_0001.sql', 'diff_0002.sql'], $this->migrator()->pending());
        self::assertSame(['diff_0001.sql', 'diff_0002.sql'], $this->migrator()->migrate());
        self::assertTrue($this->exists('zz_probe_a'));
        self::assertTrue($this->exists('zz_probe_b'));

        self::assertSame([], $this->migrator()->pending());
        self::assertSame([], $this->migrator()->migrate());
    }

    public function testANewFileIsTheOnlyOneThatRunsNextTime(): void
    {
        file_put_contents("{$this->directory}/diff_0001.sql", "CREATE TABLE zz_probe_a (id INT PRIMARY KEY);\n");
        $this->migrator()->migrate();

        file_put_contents("{$this->directory}/diff_0002.sql", "CREATE TABLE zz_probe_b (id INT PRIMARY KEY);\n");

        self::assertSame(['diff_0002.sql'], $this->migrator()->migrate());
    }

    public function testAFileChangedAfterItRanStopsTheMigration(): void
    {
        file_put_contents("{$this->directory}/diff_0001.sql", "CREATE TABLE zz_probe_a (id INT PRIMARY KEY);\n");
        $this->migrator()->migrate();

        file_put_contents("{$this->directory}/diff_0001.sql", "CREATE TABLE zz_probe_a (id BIGINT PRIMARY KEY);\n");
        file_put_contents("{$this->directory}/diff_0002.sql", "CREATE TABLE zz_probe_b (id INT PRIMARY KEY);\n");

        try {
            $this->migrator()->migrate();
            self::fail('Migrasjonen skulle ha stoppet.');
        } catch (RuntimeException $error) {
            self::assertStringContainsString('diff_0001.sql er endret', $error->getMessage());
        }
        self::assertFalse($this->exists('zz_probe_b'));
    }

    public function testTheRealMigrationsAreAllApplied(): void
    {
        $real = new Migrator($this->pdo, dirname(__DIR__) . '/setup/sql');

        self::assertNotEmpty($real->all());
        self::assertSame([], $real->pending());
        self::assertTrue($this->exists('kb_documents'));
    }
}
