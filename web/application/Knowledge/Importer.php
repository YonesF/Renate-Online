<?php

declare(strict_types=1);

namespace App\Knowledge;

use App\Uid;
use PDO;
use Throwable;

/**
 * kb:import: leser knowledge/ og gjør MySQL lik mappen.
 *
 * Mappestrukturen er metadataene:
 *
 *   knowledge/<kategori>/<guide>/*.md   kapitler i en guide (guiden står i knowledge.json)
 *   knowledge/<kategori>/*.md           frittstående artikler, alltid utkast og interne
 *
 * Tittelen er første overskrift, «3. » foran tittelen er rekkefølgen, og
 * adressen lages av tittelen. Filnavnet betyr ingenting, så en ny eksport
 * med nytt tidsstempel oppdaterer samme artikkel.
 *
 * Filene endres aldri. Rensingen gjøres på vei inn: ClickUp-lenker blir
 * interne, bilder speiles, og det som bør rettes i kilden, havner i rapporten.
 */
final readonly class Importer
{
    private const string CLICKUP_LINK = '\(\[https://doc\.clickup\.com/[^\]\s]*\]\(https://doc\.clickup\.com/[^)\s]*\)\)';
    private const string IMAGE = '~!\[([^\]]*)\]\((https?://[^)\s]+)\)~';
    private const string PLACEHOLDER = '~INSERT VIDEO|EKSTRA BILDE KOMMER~u';
    private const int SUMMARY_LENGTH = 200;

    public function __construct(
        private PDO $pdo,
        private Fetcher $fetcher,
    ) {
    }

    public function import(string $directory): ImportReport
    {
        $directory = rtrim($directory, '/\\');
        $manifest = Manifest::load("{$directory}/knowledge.json");
        $report = new ImportReport();
        $images = new ImageStore("{$directory}/assets", $this->fetcher, $manifest->imageHosts);

        $sources = $this->collect($directory, $manifest, $report);

        $slugByTitle = [];
        foreach ($sources as $source) {
            $slugByTitle[$source->title] = $source->slug;
        }
        uksort($slugByTitle, static fn (string $a, string $b): int => strlen($b) <=> strlen($a));

        foreach ($sources as $source) {
            $source->markdown = $this->clean($source, $slugByTitle, $images, $report);
            $source->summary = self::summary($source->markdown);
        }
        $images->save();
        $report->imagesFetched = $images->fetched;

        $this->pdo->beginTransaction();
        try {
            $this->store($manifest, $sources, $report);
            $this->pdo->commit();
        } catch (Throwable $error) {
            $this->pdo->rollBack();
            throw $error;
        }

        return $report;
    }

    /**
     * @return list<SourceDocument>
     */
    private function collect(string $directory, Manifest $manifest, ImportReport $report): array
    {
        /** @var array<string, SourceDocument> $bySlug */
        $bySlug = [];
        $add = static function (?SourceDocument $source) use (&$bySlug, $report): void {
            if ($source === null) {
                return;
            }
            if (isset($bySlug[$source->slug])) {
                $report->warn($source->file, "samme adresse som {$bySlug[$source->slug]->file}, hoppet over");

                return;
            }
            $bySlug[$source->slug] = $source;
        };

        $guideFolders = [];
        foreach ($manifest->guides as $guide) {
            $guideFolders[$guide['folder']] = true;
            $folder = "{$directory}/{$guide['folder']}";
            if (!is_dir($folder)) {
                $report->warn($guide['folder'], 'guidemappen finnes ikke');
                continue;
            }
            foreach (self::markdownFiles($folder) as $name) {
                $add($this->parse(
                    "{$folder}/{$name}",
                    "{$guide['folder']}/{$name}",
                    $guide['category'],
                    $guide['slug'],
                    $guide['audience'],
                    $guide['status'],
                    $report,
                ));
            }
        }

        $categories = [];
        foreach ($manifest->categories as $category) {
            $slug = $category['slug'];
            $categories[$slug] = true;
            $folder = "{$directory}/{$slug}";
            if (!is_dir($folder)) {
                continue;
            }
            // Frittstående artikler er interne utkast til noen publiserer dem.
            foreach (self::markdownFiles($folder) as $name) {
                $add($this->parse("{$folder}/{$name}", "{$slug}/{$name}", $slug, null, 'internal', 'draft', $report));
            }
            foreach (self::folders($folder) as $name) {
                if (!isset($guideFolders["{$slug}/{$name}"])) {
                    $report->warn("{$slug}/{$name}", 'mappen står ikke som guide i knowledge.json, hoppet over');
                }
            }
        }

        foreach (self::markdownFiles($directory) as $name) {
            $report->warn($name, 'ligger ikke i en kategorimappe, hoppet over');
        }
        foreach (self::folders($directory) as $name) {
            if ($name !== 'assets' && !isset($categories[$name])) {
                $report->warn($name, 'mappen er ikke en kategori i knowledge.json, hoppet over');
            }
        }

        return array_values($bySlug);
    }

    private function parse(
        string $path,
        string $relative,
        string $category,
        ?string $guide,
        string $audience,
        string $status,
        ImportReport $report,
    ): ?SourceDocument {
        $text = str_replace(["\r\n", "\r"], "\n", (string) file_get_contents($path));
        $text = preg_replace('/^\x{FEFF}/u', '', $text) ?? $text;

        if (preg_match('/^# +(.+)$/m', $text, $match) !== 1) {
            $report->warn($relative, 'mangler tittel (en linje som starter med «# »), hoppet over');

            return null;
        }

        $title = self::plain($match[1]);
        $numbered = preg_match('/^(\d+)\.\s+(.+)$/u', $title, $parts) === 1;
        $slug = Slug::of($numbered ? $parts[2] : $title);
        if ($slug === '') {
            $report->warn($relative, 'tittelen gir ingen adresse, hoppet over');

            return null;
        }

        // Tittelen vises av siden. Den, og gjentakelser av den, hører ikke hjemme i teksten.
        $body = preg_replace_callback(
            '/^# +(.+)\n?/m',
            static fn (array $line): string => self::plain($line[1]) === $title ? '' : $line[0],
            $text,
        ) ?? $text;

        return new SourceDocument(
            file: $relative,
            title: $title,
            slug: $slug,
            order: $numbered ? (int) $parts[1] : 0,
            body: trim($body) . "\n",
            category: $category,
            guide: $guide,
            audience: $audience,
            status: $status,
        );
    }

    /**
     * @param array<string, string> $slugByTitle lengste tittel først
     */
    private function clean(SourceDocument $source, array $slugByTitle, ImageStore $images, ImportReport $report): string
    {
        // ClickUp skriver fargede bokstaver som **C****M****Y****K**.
        $markdown = str_replace('****', '', $source->body);

        // «4. Tittel ([https://doc.clickup.com/…](…))» peker på et annet kapittel.
        foreach ($slugByTitle as $title => $slug) {
            $pattern = '~' . preg_quote($title, '~') . '\s*' . self::CLICKUP_LINK . '~u';
            $markdown = preg_replace_callback(
                $pattern,
                static fn (): string => "[{$title}](/artikkel/{$slug})",
                $markdown,
            ) ?? $markdown;
        }

        $markdown = preg_replace('~' . self::CLICKUP_LINK . '~u', '', $markdown, -1, $unresolved) ?? $markdown;
        if ($unresolved > 0) {
            $report->warn($source->file, "{$unresolved} ClickUp-lenke(r) uten kjent mål er fjernet");
        }
        if (str_contains($markdown, 'doc.clickup.com')) {
            $report->warn($source->file, 'har fortsatt en lenke til doc.clickup.com');
        }

        $markdown = preg_replace_callback(
            self::IMAGE,
            static function (array $match) use ($images, $report, $source): string {
                try {
                    return "![{$match[1]}](/media/{$images->mirror($match[2])})";
                } catch (FetchFailed $error) {
                    $report->warn($source->file, "bildet {$match[2]} ble ikke hentet: {$error->getMessage()}");

                    return '*[Bilde mangler]*';
                }
            },
            $markdown,
        ) ?? $markdown;

        if (preg_match_all(self::PLACEHOLDER, $markdown, $found) > 0) {
            $counts = array_count_values($found[0]);
            $list = implode(', ', array_map(
                static fn (string $text, int $count): string => "{$text} ({$count})",
                array_keys($counts),
                $counts,
            ));
            $report->warn($source->file, "inneholder plassholder: {$list}");
        }
        foreach (self::emptySections($markdown) as $heading) {
            $report->warn($source->file, "tom seksjon: «{$heading}»");
        }

        return $markdown;
    }

    /**
     * @param list<SourceDocument> $sources
     */
    private function store(Manifest $manifest, array $sources, ImportReport $report): void
    {
        $upsertCategory = $this->pdo->prepare(
            'INSERT INTO kb_categories (slug, name, sort_order) VALUES (?, ?, ?) AS new
             ON DUPLICATE KEY UPDATE name = new.name, sort_order = new.sort_order',
        );
        foreach ($manifest->categories as $position => $category) {
            $upsertCategory->execute([$category['slug'], $category['name'], $position]);
        }
        $categoryIds = $this->ids('kb_categories');

        $upsertGuide = $this->pdo->prepare(
            'INSERT INTO kb_guides (category_id, slug, title, sort_order) VALUES (?, ?, ?, ?) AS new
             ON DUPLICATE KEY UPDATE category_id = new.category_id, title = new.title, sort_order = new.sort_order',
        );
        foreach ($manifest->guides as $position => $guide) {
            $upsertGuide->execute([$categoryIds[$guide['category']], $guide['slug'], $guide['title'], $position]);
        }
        $guideIds = $this->ids('kb_guides');

        $find = $this->pdo->prepare(
            'SELECT id, source, title, summary, content_hash, category_id, guide_id, audience, status, sort_order, source_ref
             FROM kb_documents WHERE slug = ?',
        );
        $insert = $this->pdo->prepare(
            "INSERT INTO kb_documents
                (uid, category_id, guide_id, slug, title, summary, markdown, content_hash, audience, status, sort_order, source, source_ref)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'import', ?)",
        );
        $update = $this->pdo->prepare(
            'UPDATE kb_documents
             SET category_id = ?, guide_id = ?, title = ?, summary = ?, markdown = ?, content_hash = ?,
                 audience = ?, status = ?, sort_order = ?, source_ref = ?, updated_at = UTC_TIMESTAMP()
             WHERE id = ?',
        );

        $kept = [];
        foreach ($sources as $source) {
            $categoryId = $categoryIds[$source->category];
            $guideId = $source->guide === null ? null : $guideIds[$source->guide];
            $hash = hash('sha256', $source->markdown);

            $find->execute([$source->slug]);
            $existing = $find->fetch();
            $find->closeCursor();

            if (!is_array($existing)) {
                $insert->execute([
                    Uid::new('kd'), $categoryId, $guideId, $source->slug, $source->title, $source->summary,
                    $source->markdown, $hash, $source->audience, $source->status, $source->order, $source->file,
                ]);
                $kept[] = $source->slug;
                $report->created++;
                continue;
            }

            if ($existing['source'] !== 'import') {
                $report->warn($source->file, 'en artikkel med samme adresse er laget i konsollen, hoppet over');
                continue;
            }
            $kept[] = $source->slug;

            $same = $existing['content_hash'] === $hash
                && $existing['title'] === $source->title
                && $existing['summary'] === $source->summary
                && (int) $existing['category_id'] === $categoryId
                && ($existing['guide_id'] === null ? null : (int) $existing['guide_id']) === $guideId
                && $existing['audience'] === $source->audience
                && $existing['status'] === $source->status
                && (int) $existing['sort_order'] === $source->order
                && $existing['source_ref'] === $source->file;
            if ($same) {
                $report->unchanged++;
                continue;
            }

            $update->execute([
                $categoryId, $guideId, $source->title, $source->summary, $source->markdown, $hash,
                $source->audience, $source->status, $source->order, $source->file, (int) $existing['id'],
            ]);
            $report->updated++;
        }

        $report->removed = $this->deleteExcept("DELETE FROM kb_documents WHERE source = 'import'", 'slug', $kept);

        // Guider og kategorier som ikke lenger står i knowledge.json, fjernes hvis de er tomme.
        $this->deleteExcept(
            'DELETE FROM kb_guides WHERE NOT EXISTS (SELECT 1 FROM kb_documents d WHERE d.guide_id = kb_guides.id)',
            'slug',
            array_column($manifest->guides, 'slug'),
        );
        $this->deleteExcept(
            'DELETE FROM kb_categories
             WHERE NOT EXISTS (SELECT 1 FROM kb_documents d WHERE d.category_id = kb_categories.id)
               AND NOT EXISTS (SELECT 1 FROM kb_guides g WHERE g.category_id = kb_categories.id)',
            'slug',
            array_column($manifest->categories, 'slug'),
        );
    }

    /**
     * @return array<string, int> slug → id
     */
    private function ids(string $table): array
    {
        $ids = [];
        foreach ($this->pdo->query("SELECT id, slug FROM {$table}") ?: [] as $row) {
            $ids[(string) $row['slug']] = (int) $row['id'];
        }

        return $ids;
    }

    /**
     * @param list<string> $keep
     */
    private function deleteExcept(string $delete, string $column, array $keep): int
    {
        if ($keep !== []) {
            $delete .= " AND {$column} NOT IN (" . implode(', ', array_fill(0, count($keep), '?')) . ')';
        }
        $statement = $this->pdo->prepare($delete);
        $statement->execute($keep);

        return $statement->rowCount();
    }

    /**
     * Første avsnitt med vanlig tekst, til bruk i lister.
     */
    private static function summary(string $markdown): string
    {
        foreach (preg_split('/\n{2,}/', $markdown) ?: [] as $block) {
            // ClickUp setter ofte overskriften rett over avsnittet, uten tom linje imellom.
            $block = trim(preg_replace('/^#{1,6} .*$/m', '', $block) ?? $block);
            if ($block === '' || preg_match('/^(?:!\[|\||>|[-*] |\d+\. |\* \* \*)/', $block) === 1) {
                continue;
            }

            $text = preg_replace('/!\[[^\]]*\]\([^)]*\)/', '', $block) ?? $block;
            $text = preg_replace('/\[([^\]]*)\]\([^)]*\)/', '$1', $text) ?? $text;
            $text = self::plain(preg_replace('/\s+/', ' ', $text) ?? $text);
            if (mb_strlen($text) < 20) {
                continue;
            }
            if (mb_strlen($text) <= self::SUMMARY_LENGTH) {
                return $text;
            }

            $cut = mb_substr($text, 0, self::SUMMARY_LENGTH);
            $space = mb_strrpos($cut, ' ');

            return rtrim(mb_substr($cut, 0, $space === false ? self::SUMMARY_LENGTH : $space), ' ,;:') . '…';
        }

        return '';
    }

    /**
     * Overskrifter uten innhold under seg, som «På Mac:» med en tom punktliste.
     * En overskrift som bare har underoverskrifter, regnes ikke som tom.
     *
     * @return list<string>
     */
    private static function emptySections(string $markdown): array
    {
        $empty = [];
        $heading = null;
        $level = 0;
        $hasContent = false;

        foreach ([...explode("\n", $markdown), '# slutt'] as $line) {
            if (preg_match('/^(#{1,6}) +(.+)$/', $line, $match) === 1) {
                if ($heading !== null && !$hasContent && strlen($match[1]) <= $level) {
                    $empty[] = $heading;
                }
                $heading = self::plain($match[2]);
                $level = strlen($match[1]);
                $hasContent = false;
                continue;
            }
            // Tomme linjer, skillelinjer og punkter uten tekst er ikke innhold.
            if (preg_match('/^[\s*\-_]*$/', $line) !== 1) {
                $hasContent = true;
            }
        }

        return $empty;
    }

    /**
     * Fjerner Markdown-pynt fra en kort tekst: utheving og escapede tegn.
     */
    private static function plain(string $text): string
    {
        $text = preg_replace('/\\\\([\\\\`*_{}\[\]()#+\-.!|>~])/', '$1', $text) ?? $text;
        $text = preg_replace('/\*{1,3}|_{2,3}/', '', $text) ?? $text;

        return trim($text);
    }

    /**
     * @return list<string>
     */
    private static function markdownFiles(string $folder): array
    {
        $names = [];
        foreach (scandir($folder) ?: [] as $name) {
            if (str_ends_with(strtolower($name), '.md') && is_file("{$folder}/{$name}")) {
                $names[] = $name;
            }
        }
        sort($names);

        return $names;
    }

    /**
     * @return list<string>
     */
    private static function folders(string $folder): array
    {
        $names = [];
        foreach (scandir($folder) ?: [] as $name) {
            if ($name[0] !== '.' && is_dir("{$folder}/{$name}")) {
                $names[] = $name;
            }
        }
        sort($names);

        return $names;
    }
}
