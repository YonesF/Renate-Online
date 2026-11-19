<?php

declare(strict_types=1);

namespace App\Tests;

use App\Knowledge\ImportFailed;

final class ImporterTest extends KnowledgeTestCase
{
    public function testTheFolderStructureDecidesCategoryGuideAndVisibility(): void
    {
        $this->seed();

        $report = $this->import();

        self::assertSame(3, $report->created);
        $chapter = $this->document('slik-fungerer-skriveren');
        self::assertSame('1. Slik fungerer skriveren', $chapter['title']);
        self::assertSame(1, (int) $chapter['sort_order']);
        self::assertSame('sublimering', $chapter['category']);
        self::assertSame('epson', $chapter['guide']);
        self::assertSame('public', $chapter['audience']);
        self::assertSame('published', $chapter['status']);
        self::assertSame('import', $chapter['source']);
        self::assertMatchesRegularExpression('/^kd[a-z0-9]{26}$/', (string) $chapter['uid']);
    }

    public function testAnArticleOutsideAGuideIsAnInternalDraft(): void
    {
        $this->seed();
        $this->import();

        $loose = $this->document('los-artikkel');

        self::assertNull($loose['guide']);
        self::assertSame('internal', $loose['audience']);
        self::assertSame('draft', $loose['status']);
    }

    public function testTheTitleIsTakenOutOfTheTextIncludingARepeatedOne(): void
    {
        $this->seed();
        $this->import();

        $markdown = (string) $this->document('hoderens-steg-for-steg')['markdown'];

        self::assertStringNotContainsString('# 2', $markdown);
        self::assertStringStartsWith('Kjør aldri rens', $markdown);
    }

    public function testAClickUpLinkBecomesALinkToTheChapterItNames(): void
    {
        $this->seed();
        $this->import();

        $markdown = (string) $this->document('slik-fungerer-skriveren')['markdown'];

        self::assertStringContainsString(
            'Les mer her; [2. Hoderens – steg for steg](/artikkel/hoderens-steg-for-steg)',
            $markdown,
        );
        self::assertStringNotContainsString('clickup', $markdown);
    }

    public function testAClickUpLinkWithoutAKnownChapterIsRemovedAndReported(): void
    {
        $this->seed();
        $link = '([' . self::CLICKUP . '](' . self::CLICKUP . '))';
        $this->write('sublimering/epson/3. Feil.md', "# 3. Feilsøking\n\nSe guiden om fargestyring {$link} for mer.\n");

        $report = $this->import();

        self::assertSame("Se guiden om fargestyring  for mer.\n", $this->document('feilsoking')['markdown']);
        self::assertContains(
            'sublimering/epson/3. Feil.md: 1 ClickUp-lenke(r) uten kjent mål er fjernet',
            $this->warnings($report),
        );
    }

    public function testImagesAreMirroredAndPointAtOurOwnServer(): void
    {
        $this->seed();

        $report = $this->import();

        $markdown = (string) $this->document('slik-fungerer-skriveren')['markdown'];
        self::assertSame(1, preg_match('~!\[\]\(/media/([0-9a-f]{32})\)~', $markdown, $match));
        self::assertFileExists("{$this->knowledge}/assets/{$match[1]}.png");
        self::assertSame(1, $report->imagesFetched);
        self::assertSame(
            [self::IMAGE_URL => "{$match[1]}.png"],
            json_decode((string) file_get_contents("{$this->knowledge}/assets/index.json"), true),
        );
    }

    public function testASecondImportChangesNothingAndFetchesNothing(): void
    {
        $this->seed();
        $this->import();
        $uid = $this->document('slik-fungerer-skriveren')['uid'];

        $report = $this->import();

        self::assertSame([0, 0, 3, 0], [$report->created, $report->updated, $report->unchanged, $report->removed]);
        self::assertSame(0, $report->imagesFetched);
        self::assertCount(1, $this->fetcher->requested);
        self::assertSame($uid, $this->document('slik-fungerer-skriveren')['uid']);
    }

    public function testANewExportWithANewFileNameUpdatesTheSameArticle(): void
    {
        $this->seed();
        $this->import();
        $uid = $this->document('hoderens-steg-for-steg')['uid'];

        unlink("{$this->knowledge}/sublimering/epson/2. Hoderens-20260101.md");
        $this->write('sublimering/epson/2. Hoderens-20260315.md', "# 2. Hoderens – steg for steg\n\nNy tekst etter at guiden ble rettet.\n");
        $report = $this->import();

        self::assertSame([0, 1, 2, 0], [$report->created, $report->updated, $report->unchanged, $report->removed]);
        $document = $this->document('hoderens-steg-for-steg');
        self::assertSame($uid, $document['uid']);
        self::assertSame("Ny tekst etter at guiden ble rettet.\n", $document['markdown']);
        self::assertSame('sublimering/epson/2. Hoderens-20260315.md', $document['source_ref']);
    }

    public function testAFileThatIsGoneRemovesItsArticle(): void
    {
        $this->seed();
        $this->import();

        unlink("{$this->knowledge}/sublimering/Løs artikkel.md");
        $report = $this->import();

        self::assertSame(1, $report->removed);
        self::assertSame(2, (int) $this->pdo->query('SELECT COUNT(*) FROM kb_documents')->fetchColumn());
    }

    public function testAnArticleMadeInTheConsoleIsNeverOverwritten(): void
    {
        $this->seed();
        $this->import();
        $this->pdo->exec("UPDATE kb_documents SET source = 'console', markdown = 'Skrevet for hånd.' WHERE slug = 'los-artikkel'");

        $report = $this->import();

        self::assertSame('Skrevet for hånd.', $this->document('los-artikkel')['markdown']);
        self::assertSame(0, $report->removed);
        self::assertContains(
            'sublimering/Løs artikkel.md: en artikkel med samme adresse er laget i konsollen, hoppet over',
            $this->warnings($report),
        );
    }

    public function testAnImageFromAHostThatIsNotListedIsNeverFetched(): void
    {
        $this->seed();
        $this->write('sublimering/epson/3. Bilde.md', "# 3. Bilde\n\n![](https://evil.example/x.png)\n");

        $report = $this->import();

        self::assertSame("*[Bilde mangler]*\n", $this->document('bilde')['markdown']);
        self::assertNotContains('https://evil.example/x.png', $this->fetcher->requested);
        self::assertContains(
            'sublimering/epson/3. Bilde.md: bildet https://evil.example/x.png ble ikke hentet: '
                . 'verten står ikke i image_hosts i knowledge.json',
            $this->warnings($report),
        );
    }

    public function testAnImageThatCannotBeFetchedIsReported(): void
    {
        $this->seed();
        $this->write('sublimering/epson/3. Bilde.md', "# 3. Bilde\n\n![](https://img.test/borte.png)\n");

        $report = $this->import();

        self::assertSame("*[Bilde mangler]*\n", $this->document('bilde')['markdown']);
        self::assertContains(
            'sublimering/epson/3. Bilde.md: bildet https://img.test/borte.png ble ikke hentet: status 404',
            $this->warnings($report),
        );
    }

    public function testSomethingThatIsNotAnImageIsNotStored(): void
    {
        $this->seed();
        $this->fetcher->responses['https://img.test/skript.png'] = '<svg onload="alert(1)"></svg>';
        $this->write('sublimering/epson/3. Bilde.md', "# 3. Bilde\n\n![](https://img.test/skript.png)\n");

        $report = $this->import();

        self::assertSame("*[Bilde mangler]*\n", $this->document('bilde')['markdown']);
        self::assertContains(
            'sublimering/epson/3. Bilde.md: bildet https://img.test/skript.png ble ikke hentet: '
                . 'ikke et bilde av en tillatt type',
            $this->warnings($report),
        );
        self::assertSame([], glob("{$this->knowledge}/assets/*.svg") ?: []);
    }

    public function testPlaceholdersAndEmptySectionsAreReportedButNotSubheadings(): void
    {
        $this->seed();

        $warnings = $this->warnings($this->import());

        $file = 'sublimering/epson/2. Hoderens-20260101.md';
        self::assertContains("{$file}: inneholder plassholder: INSERT VIDEO (1)", $warnings);
        self::assertContains("{$file}: tom seksjon: «På Mac:»", $warnings);
        // «Slik gjør du det» har bare underoverskrifter og er ikke tom.
        self::assertNotContains("{$file}: tom seksjon: «Slik gjør du det»", $warnings);
    }

    public function testTheSummaryIsTheFirstParagraphEvenRightUnderAHeading(): void
    {
        $this->seed();
        $this->import();

        self::assertSame(
            'Blekket går fra tank til dyse gjennom tynne slanger.',
            $this->document('slik-fungerer-skriveren')['summary'],
        );
    }

    public function testClickUpsColouredLettersBecomeOneBoldWord(): void
    {
        $this->seed();
        $this->import();

        self::assertStringContainsString(
            'Skriv ut **CMYK**\-CHART hver uke.',
            (string) $this->document('slik-fungerer-skriveren')['markdown'],
        );
    }

    public function testFilesAndFoldersOutsideTheStructureAreSkippedAndReported(): void
    {
        $this->seed();
        $this->write('Rot.md', "# Rot\n\nLigger feil.\n");
        $this->write('ukjent/Fil.md', "# Fil\n\nLigger feil.\n");
        $this->write('sublimering/annen-guide/Fil.md', "# Fil\n\nLigger feil.\n");
        $this->write('sublimering/epson/Uten tittel.md', "Bare tekst.\n");

        $report = $this->import();

        self::assertSame(3, $report->created);
        $warnings = $this->warnings($report);
        self::assertContains('Rot.md: ligger ikke i en kategorimappe, hoppet over', $warnings);
        self::assertContains('ukjent: mappen er ikke en kategori i knowledge.json, hoppet over', $warnings);
        self::assertContains(
            'sublimering/annen-guide: mappen står ikke som guide i knowledge.json, hoppet over',
            $warnings,
        );
        self::assertContains(
            'sublimering/epson/Uten tittel.md: mangler tittel (en linje som starter med «# »), hoppet over',
            $warnings,
        );
    }

    public function testTwoFilesWithTheSameTitleDoNotBecomeTwoArticles(): void
    {
        $this->seed();
        $this->write('sublimering/epson/1. Kopi.md', "# 1. Slik fungerer skriveren\n\nEn eldre eksport av samme kapittel.\n");

        $report = $this->import();

        self::assertSame(3, $report->created);
        self::assertContains(
            'sublimering/epson/1. Slik fungerer skriveren-20260101.md: samme adresse som '
                . 'sublimering/epson/1. Kopi.md, hoppet over',
            $this->warnings($report),
        );
    }

    public function testCategoriesFollowTheManifestInOrderAndEmptyOnesGoWhenRemoved(): void
    {
        $this->seed();
        $this->import();
        self::assertSame(
            ['sublimering', 'vinyl-og-tekstil'],
            $this->pdo->query('SELECT slug FROM kb_categories ORDER BY sort_order')->fetchAll(\PDO::FETCH_COLUMN),
        );

        $manifest = json_decode((string) file_get_contents("{$this->knowledge}/knowledge.json"), true);
        self::assertIsArray($manifest);
        $manifest['categories'] = [['slug' => 'sublimering', 'name' => 'Sublimering og blekk']];
        $this->write('knowledge.json', (string) json_encode($manifest));
        $this->import();

        self::assertSame(
            ['Sublimering og blekk'],
            $this->pdo->query('SELECT name FROM kb_categories ORDER BY sort_order')->fetchAll(\PDO::FETCH_COLUMN),
        );
    }

    public function testAnInvalidManifestStopsTheImportBeforeAnythingChanges(): void
    {
        $this->seed();
        $this->import();
        $this->write('knowledge.json', '{"categories": [{"slug": "Stor Bokstav", "name": "X"}]}');

        try {
            $this->import();
            self::fail('Importen skulle ha stoppet.');
        } catch (ImportFailed $error) {
            self::assertStringContainsString('ugyldig eller gjentatt slug', $error->getMessage());
        }

        self::assertSame(3, (int) $this->pdo->query('SELECT COUNT(*) FROM kb_documents')->fetchColumn());
    }

    public function testAGuideWithoutAudienceAndStatusIsAnInternalDraft(): void
    {
        $this->seed();
        $manifest = json_decode((string) file_get_contents("{$this->knowledge}/knowledge.json"), true);
        self::assertIsArray($manifest);
        unset($manifest['guides'][0]['audience'], $manifest['guides'][0]['status']);
        $this->write('knowledge.json', (string) json_encode($manifest));

        $this->import();

        $chapter = $this->document('slik-fungerer-skriveren');
        self::assertSame(['internal', 'draft'], [$chapter['audience'], $chapter['status']]);
    }
}
