<?php

declare(strict_types=1);

namespace App\Knowledge;

use InvalidArgumentException;
use PDO;

/**
 * Lesesiden av kunnskapsbasen.
 *
 * Hver metode tar målgruppene som får se svaret. Bare publiserte dokumenter
 * i en av dem kommer med. Filteret ligger i spørringen, så en side kan ikke
 * glemme det.
 */
final readonly class Library
{
    public function __construct(private PDO $pdo)
    {
    }

    /**
     * Kategorier som har minst én synlig artikkel.
     *
     * @param list<string> $audiences
     * @return list<Category>
     */
    public function categories(array $audiences): array
    {
        $rows = $this->rows(
            "SELECT c.slug, c.name, COUNT(d.id) AS documents
             FROM kb_categories c
             JOIN kb_documents d ON d.category_id = c.id AND {$this->visible($audiences)}
             GROUP BY c.id, c.slug, c.name, c.sort_order
             ORDER BY c.sort_order, c.name",
            $audiences,
        );

        return array_map(
            static fn (array $row): Category => new Category(
                (string) $row['slug'],
                (string) $row['name'],
                (int) $row['documents'],
            ),
            $rows,
        );
    }

    /**
     * Synlige artikler gruppert per guide. Uten kategori: alle kategorier.
     *
     * @param list<string> $audiences
     * @return list<Group>
     */
    public function groups(array $audiences, ?string $categorySlug = null): array
    {
        $rows = $this->rows(
            "SELECT d.slug, d.title, d.summary, g.slug AS guide_slug, g.title AS guide_title,
                    c.slug AS category_slug, c.name AS category_name
             FROM kb_documents d
             JOIN kb_categories c ON c.id = d.category_id
             LEFT JOIN kb_guides g ON g.id = d.guide_id
             WHERE {$this->visible($audiences)}" . ($categorySlug === null ? '' : ' AND c.slug = ?') . '
             ORDER BY c.sort_order, c.name, g.id IS NULL, g.sort_order, g.title, d.sort_order, d.title',
            $categorySlug === null ? $audiences : [...$audiences, $categorySlug],
        );

        /** @var array<string, array{slug: ?string, title: ?string, categorySlug: string, categoryName: string, documents: list<Listing>}> $groups */
        $groups = [];
        foreach ($rows as $row) {
            $guide = is_string($row['guide_slug']) ? $row['guide_slug'] : null;
            $key = (string) $row['category_slug'] . '/' . ($guide ?? '');
            $groups[$key] ??= [
                'slug' => $guide,
                'title' => is_string($row['guide_title']) ? $row['guide_title'] : null,
                'categorySlug' => (string) $row['category_slug'],
                'categoryName' => (string) $row['category_name'],
                'documents' => [],
            ];
            $groups[$key]['documents'][] = new Listing(
                (string) $row['slug'],
                (string) $row['title'],
                (string) $row['summary'],
            );
        }

        return array_values(array_map(
            static fn (array $group): Group => new Group(
                $group['slug'],
                $group['title'],
                $group['categorySlug'],
                $group['categoryName'],
                $group['documents'],
            ),
            $groups,
        ));
    }

    /**
     * @param list<string> $audiences
     */
    public function category(string $slug, array $audiences): ?Category
    {
        foreach ($this->categories($audiences) as $category) {
            if ($category->slug === $slug) {
                return $category;
            }
        }

        return null;
    }

    /**
     * @param list<string> $audiences
     */
    public function document(string $slug, array $audiences): ?Document
    {
        $rows = $this->rows(
            "SELECT d.uid, d.slug, d.title, d.markdown, g.slug AS guide_slug, g.title AS guide_title,
                    c.slug AS category_slug, c.name AS category_name
             FROM kb_documents d
             JOIN kb_categories c ON c.id = d.category_id
             LEFT JOIN kb_guides g ON g.id = d.guide_id
             WHERE {$this->visible($audiences)} AND d.slug = ?",
            [...$audiences, $slug],
        );
        if ($rows === []) {
            return null;
        }
        $row = $rows[0];
        $guide = is_string($row['guide_slug']) ? $row['guide_slug'] : null;

        // Forrige og neste i samme guide, eller blant de frittstående i kategorien.
        $previous = null;
        $next = null;
        foreach ($this->groups($audiences, (string) $row['category_slug']) as $group) {
            if ($group->slug !== $guide) {
                continue;
            }
            foreach ($group->documents as $position => $listing) {
                if ($listing->slug === $slug) {
                    $previous = $group->documents[$position - 1] ?? null;
                    $next = $group->documents[$position + 1] ?? null;
                }
            }
        }

        return new Document(
            uid: (string) $row['uid'],
            slug: (string) $row['slug'],
            title: (string) $row['title'],
            markdown: (string) $row['markdown'],
            categorySlug: (string) $row['category_slug'],
            categoryName: (string) $row['category_name'],
            guideSlug: $guide,
            guideTitle: is_string($row['guide_title']) ? $row['guide_title'] : null,
            previous: $previous,
            next: $next,
        );
    }

    /**
     * Alt Lena får lese, i fast rekkefølge slik at prompten kan caches.
     *
     * @param list<string> $audiences
     * @return list<array{document: string, slug: string, title: string, text: string}>
     */
    public function knowledge(array $audiences): array
    {
        $rows = $this->rows(
            "SELECT d.uid, d.slug, d.title, d.markdown
             FROM kb_documents d
             JOIN kb_categories c ON c.id = d.category_id
             LEFT JOIN kb_guides g ON g.id = d.guide_id
             WHERE {$this->visible($audiences)}
             ORDER BY c.sort_order, g.sort_order, d.sort_order, d.slug",
            $audiences,
        );

        return array_map(
            static fn (array $row): array => [
                'document' => (string) $row['uid'],
                'slug' => (string) $row['slug'],
                'title' => (string) $row['title'],
                'text' => (string) $row['markdown'],
            ],
            $rows,
        );
    }

    /**
     * Vilkåret som avgjør hva som er synlig. Målgruppene bindes som verdier.
     *
     * @param list<string> $audiences
     */
    private function visible(array $audiences): string
    {
        if ($audiences === [] || array_diff($audiences, Manifest::AUDIENCES) !== []) {
            throw new InvalidArgumentException('Ugyldig eller tom liste med målgrupper.');
        }

        return "d.status = 'published' AND d.audience IN (" . implode(', ', array_fill(0, count($audiences), '?')) . ')';
    }

    /**
     * @param list<string> $values
     * @return list<array<string, mixed>>
     */
    private function rows(string $sql, array $values): array
    {
        $statement = $this->pdo->prepare($sql);
        $statement->execute($values);

        return array_values($statement->fetchAll());
    }
}
