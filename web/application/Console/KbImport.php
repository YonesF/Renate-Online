<?php

declare(strict_types=1);

namespace App\Console;

use App\Config;
use App\Database;
use App\Knowledge\HttpFetcher;
use App\Knowledge\Importer;
use App\Knowledge\ImportFailed;

/**
 * kb:import [mappe]: gjør kunnskapsbasen i MySQL lik knowledge-mappen.
 */
final readonly class KbImport
{
    public function __construct(
        private Config $config,
        private string $root,
    ) {
    }

    public function run(?string $directory): int
    {
        $directory ??= $this->config->get('KNOWLEDGE_DIR') ?? dirname($this->root) . '/knowledge';
        if (!is_dir($directory)) {
            fwrite(STDERR, "Fant ikke mappen {$directory}.\n");

            return 1;
        }

        try {
            $report = new Importer(new Database($this->config)->pdo(), new HttpFetcher())->import($directory);
        } catch (ImportFailed $error) {
            fwrite(STDERR, $error->getMessage() . "\n");

            return 1;
        }

        printf(
            "%d nye, %d oppdatert, %d uendret, %d fjernet. %d bilder hentet.\n",
            $report->created,
            $report->updated,
            $report->unchanged,
            $report->removed,
            $report->imagesFetched,
        );

        if ($report->warnings !== []) {
            echo "\nBør rettes i kildene (" . count($report->warnings) . "):\n";
            foreach ($report->warnings as $warning) {
                echo "  {$warning['file']}\n    {$warning['message']}\n";
            }
        }

        return 0;
    }
}
