<?php

declare(strict_types=1);

namespace App\Tests;

use App\Http\Kernel;
use App\Http\Request;
use App\Http\Response;

/**
 * Hjelpesiden fra forespørsel til HTML, med ekte database og en importert testmappe.
 */
final class HelpPagesTest extends KnowledgeTestCase
{
    /**
     * Hvert kall er en ny forespørsel og kan gi et annet svar.
     *
     * @phpstan-impure
     */
    private function get(string $path): Response
    {
        return new Kernel(dirname(__DIR__), $this->config())->handle(new Request('GET', 'hjelp.localhost', $path));
    }

    public function testTheFrontPageSaysSoWhenNothingIsPublished(): void
    {
        $response = $this->get('/');

        self::assertSame(200, $response->status);
        self::assertStringContainsString('Det er ikke publisert noen artikler ennå.', $response->body);
    }

    public function testTheFrontPageShowsOnlyCategoriesWithPublishedArticles(): void
    {
        $this->seed();
        $this->import();

        $response = $this->get('/');

        self::assertSame(200, $response->status);
        self::assertStringContainsString('href="/kategori/sublimering"', $response->body);
        // To publiserte kapitler. Den frittstående artikkelen er et internt utkast.
        self::assertStringContainsString('2 artikler', $response->body);
        self::assertStringNotContainsString('Vinyl og tekstil', $response->body);
        self::assertStringContainsString('Epson-guiden', $response->body);
        self::assertStringContainsString('href="/kategori/sublimering#epson"', $response->body);
        self::assertStringNotContainsString('Gå tilbake til hjelpesenter', $response->body);
    }

    public function testACategoryListsItsChaptersInOrderWithSummaries(): void
    {
        $this->seed();
        $this->import();

        $body = $this->get('/kategori/sublimering')->body;

        self::assertStringContainsString('<section class="group" id="epson">', $body);
        self::assertStringContainsString('Blekket går fra tank til dyse gjennom tynne slanger.', $body);
        self::assertLessThan(
            strpos($body, '2. Hoderens – steg for steg'),
            strpos($body, '1. Slik fungerer skriveren'),
        );
        self::assertStringNotContainsString('Løs artikkel', $body);
        self::assertStringNotContainsString('aria-label="Brødsmulesti"', $body);
        self::assertSame(2, substr_count($body, 'Gå tilbake til hjelpesenter'));
        self::assertSame(2, substr_count($body, 'class="back-btn" href="/"'));
    }

    public function testACategoryThatIsUnknownOrHasNothingPublishedIs404(): void
    {
        $this->seed();
        $this->import();

        self::assertSame(404, $this->get('/kategori/finnes-ikke')->status);
        self::assertSame(404, $this->get('/kategori/vinyl-og-tekstil')->status);
        self::assertSame(404, $this->get('/kategori')->status);
    }

    public function testAnArticleIsRenderedWithInternalLinksImagesAndNavigation(): void
    {
        $this->seed();
        $this->import();

        $response = $this->get('/artikkel/slik-fungerer-skriveren');

        self::assertSame(200, $response->status);
        $body = $response->body;
        self::assertStringContainsString('<h1>1. Slik fungerer skriveren</h1>', $body);
        self::assertStringContainsString('<a href="/artikkel/hoderens-steg-for-steg">2. Hoderens – steg for steg</a>', $body);
        self::assertMatchesRegularExpression('~<img [^>]*src="/media/[0-9a-f]{32}"~', $body);
        self::assertStringContainsString('<strong>CMYK</strong>-CHART', $body);
        // Brødsmulesti, innholdsfortegnelse og neste kapittel.
        self::assertStringContainsString('<a href="/kategori/sublimering#epson">Epson-guiden</a>', $body);
        self::assertStringContainsString('<a href="#blekkflyten">', $body);
        self::assertStringContainsString('<span class="pager-label">Neste</span>', $body);
        self::assertStringNotContainsString('<span class="pager-label">Forrige</span>', $body);
        // Tittelen står én gang, ikke også inne i teksten.
        self::assertSame(1, substr_count($body, '<h1'));
        // Tilbake-knapp øverst og nederst, og rullegardin-støtte for Markdown-innhold.
        self::assertSame(2, substr_count($body, 'Gå tilbake til hjelpesenter'));
        self::assertSame(2, substr_count($body, 'class="back-btn" href="/"'));
        self::assertStringContainsString('data-collapsible-markdown', $body);
    }

    public function testLiveTopicPagesRenderCollapsibleSectionsWithControls(): void
    {
        $this->seed();
        $this->import();
        $this->pdo->exec("UPDATE kb_guides SET slug = 'vedlikehold-epson' WHERE slug = 'epson'");
        $this->pdo->exec("UPDATE kb_documents SET slug = 'om-guiden' WHERE slug = 'slik-fungerer-skriveren'");

        $sublimering = $this->get('/kategori/sublimering');
        self::assertSame(200, $sublimering->status);
        self::assertStringContainsString('Vedlikeholdsguide for din konverterte Epson sublimeringsprinter', $sublimering->body);
        self::assertStringContainsString('href="/artikkel/om-guiden"', $sublimering->body);
        self::assertStringContainsString('class="featured-guide"', $sublimering->body);
        self::assertStringContainsString('Les hele vedlikeholdsguiden', $sublimering->body);
        self::assertSame(6, substr_count($sublimering->body, '<details class="guide-section"'));

        foreach (['/kategori/varmepresser' => 5, '/kategori/vinyl-og-tekstil' => 5] as $path => $expectedSections) {
            $response = $this->get($path);

            self::assertSame(200, $response->status, $path);
            self::assertSame($expectedSections, substr_count($response->body, '<details class="guide-section"'), $path);
            self::assertStringContainsString('data-guide-toggle-all', $response->body, $path);
            self::assertStringContainsString('data-label="', $response->body, $path);
            self::assertSame(2, substr_count($response->body, 'Gå tilbake til hjelpesenter'), $path);
        }
    }

    public function testADraftOrInternalArticleIs404EvenWithTheRightAddress(): void
    {
        $this->seed();
        $this->import();

        self::assertSame(404, $this->get('/artikkel/los-artikkel')->status);

        // Hver av de to sperrene holder alene.
        $this->pdo->exec("UPDATE kb_documents SET status = 'published' WHERE slug = 'los-artikkel'");
        self::assertSame(404, $this->get('/artikkel/los-artikkel')->status);
        $this->pdo->exec("UPDATE kb_documents SET status = 'draft', audience = 'public' WHERE slug = 'los-artikkel'");
        self::assertSame(404, $this->get('/artikkel/los-artikkel')->status);
        $this->pdo->exec("UPDATE kb_documents SET audience = 'customer', status = 'published' WHERE slug = 'los-artikkel'");
        self::assertSame(404, $this->get('/artikkel/los-artikkel')->status);

        $this->pdo->exec("UPDATE kb_documents SET audience = 'public' WHERE slug = 'los-artikkel'");
        self::assertSame(200, $this->get('/artikkel/los-artikkel')->status);
    }

    public function testAnUnknownArticleIs404(): void
    {
        self::assertSame(404, $this->get('/artikkel/finnes-ikke')->status);
        self::assertSame(404, $this->get('/artikkel')->status);
        self::assertSame(404, $this->get('/artikkel/a/b')->status);
    }

    public function testHtmlStoredInAnArticleIsShownAsTextNotRun(): void
    {
        $this->seed();
        $this->import();
        $this->pdo->exec(
            "UPDATE kb_documents SET markdown = 'Hei <script>alert(1)</script> og <img src=x onerror=alert(2)>'
             WHERE slug = 'slik-fungerer-skriveren'",
        );

        $body = $this->get('/artikkel/slik-fungerer-skriveren')->body;

        self::assertStringNotContainsString('<script>alert', $body);
        self::assertStringNotContainsString('<img src=x', $body);
        self::assertStringContainsString('&lt;script&gt;alert(1)&lt;/script&gt;', $body);
    }

    public function testATitleWithHtmlIsEscapedByTheTemplate(): void
    {
        $this->seed();
        $this->import();
        $this->pdo->exec("UPDATE kb_documents SET title = '<b>Fet</b> tittel' WHERE slug = 'slik-fungerer-skriveren'");

        $body = $this->get('/artikkel/slik-fungerer-skriveren')->body;

        self::assertStringContainsString('<h1>&lt;b&gt;Fet&lt;/b&gt; tittel</h1>', $body);
    }

    public function testAMirroredImageIsServedWithItsTypeAndCachedForever(): void
    {
        $this->seed();
        $this->import();
        preg_match('~/media/([0-9a-f]{32})~', $this->get('/artikkel/slik-fungerer-skriveren')->body, $match);

        $response = $this->get("/media/{$match[1]}");

        self::assertSame(200, $response->status);
        self::assertSame('image/png', $response->headers['Content-Type']);
        self::assertSame('public, max-age=31536000, immutable', $response->headers['Cache-Control']);
        self::assertSame('nosniff', $response->headers['X-Content-Type-Options']);
        self::assertStringStartsWith("\x89PNG", $response->body);
    }

    public function testOnlyIdsOfMirroredImagesAreServed(): void
    {
        $this->seed();
        $this->import();
        // En fil i assets som ikke er et bilde importen har godkjent.
        file_put_contents("{$this->knowledge}/assets/index.json", '{}');
        file_put_contents("{$this->knowledge}/assets/" . str_repeat('a', 32) . '.svg', '<svg/>');

        self::assertSame(404, $this->get('/media/' . str_repeat('0', 32))->status);
        self::assertSame(404, $this->get('/media/' . str_repeat('a', 32))->status);
        self::assertSame(404, $this->get('/media/index')->status);
        self::assertSame(404, $this->get('/media')->status);
    }
}
