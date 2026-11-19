<?php

declare(strict_types=1);

namespace App\Tests;

use App\Knowledge\Importer;
use App\Knowledge\ImportReport;
use App\Tests\Fake\FakeFetcher;

/**
 * En liten kunnskapsmappe som ligner den ekte: én guide med to kapitler
 * eksportert fra ClickUp, og én frittstående artikkel.
 */
abstract class KnowledgeTestCase extends DatabaseTestCase
{
    protected const string IMAGE_URL = 'https://img.test/t1/a.png?view=open';
    protected const string CLICKUP = 'https://doc.clickup.com/d/h/4g1wp-8255/064fdc4/4g1wp-2';

    protected FakeFetcher $fetcher;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fetcher = new FakeFetcher();
        $this->fetcher->responses[self::IMAGE_URL] = FakeFetcher::png();
    }

    protected function seed(): void
    {
        $this->write('knowledge.json', (string) json_encode([
            'image_hosts' => ['img.test'],
            'categories' => [
                ['slug' => 'sublimering', 'name' => 'Sublimering'],
                ['slug' => 'vinyl-og-tekstil', 'name' => 'Vinyl og tekstil'],
            ],
            'guides' => [
                [
                    'folder' => 'sublimering/epson',
                    'title' => 'Epson-guiden',
                    'audience' => 'public',
                    'status' => 'published',
                ],
            ],
        ]));

        $link = '([' . self::CLICKUP . '](' . self::CLICKUP . '))';
        $this->write('sublimering/epson/1. Slik fungerer skriveren-20260101.md', <<<MD
            # 1. Slik fungerer skriveren

            ## 📌 Introduksjon
            Blekket går fra tank til dyse gjennom tynne slanger.

            Les mer her; 2. Hoderens – steg for steg {$link}

            ## 🩸 Blekkflyten
            ![](https://img.test/t1/a.png?view=open)

            Skriv ut **C****M****Y****K**\\-CHART hver uke.
            MD);

        $this->write('sublimering/epson/2. Hoderens-20260101.md', <<<'MD'
            # 2. Hoderens – steg for steg

            # 2\. Hoderens – steg for steg
            Kjør aldri rens for sikkerhets skyld, bare når dysesjekken viser feil.

            ## Slik gjør du det
            ### På Windows:
            1. Åpne vedlikeholdsmenyen
            2. Velg Head Cleaning

            ### På Mac:
            *

            * * *

            ## Video
            Se denne videoen: INSERT VIDEO
            MD);

        $this->write('sublimering/Løs artikkel.md', <<<'MD'
            # Løs artikkel

            Denne teksten er et internt utkast til noen publiserer den.
            MD);
    }

    protected function import(): ImportReport
    {
        return new Importer($this->pdo, $this->fetcher)->import($this->knowledge);
    }

    /**
     * @return array<string, mixed>
     */
    protected function document(string $slug): array
    {
        $statement = $this->pdo->prepare(
            'SELECT d.*, c.slug AS category, g.slug AS guide
             FROM kb_documents d
             JOIN kb_categories c ON c.id = d.category_id
             LEFT JOIN kb_guides g ON g.id = d.guide_id
             WHERE d.slug = ?',
        );
        $statement->execute([$slug]);
        $row = $statement->fetch();
        self::assertIsArray($row, "Fant ikke dokumentet {$slug}.");

        return $row;
    }

    /**
     * @return list<string>
     */
    protected function warnings(ImportReport $report): array
    {
        return array_map(
            static fn (array $warning): string => "{$warning['file']}: {$warning['message']}",
            $report->warnings,
        );
    }
}
