<?php

declare(strict_types=1);

namespace App\Console;

use App\Config;
use App\Database;
use App\Schema\Migrator;

/**
 * updatedb: kjører migrasjonene i setup/sql som ikke er kjørt.
 */
final readonly class UpdateDb
{
    public function __construct(
        private Config $config,
        private string $root,
    ) {
    }

    public function run(): int
    {
        $migrator = new Migrator(new Database($this->config)->pdo(), "{$this->root}/setup/sql");
        $ran = $migrator->migrate();

        if ($ran === []) {
            echo "Ingen nye migrasjoner.\n";

            return 0;
        }

        foreach ($ran as $name) {
            echo "Kjørt: {$name}\n";
        }

        return 0;
    }
}
