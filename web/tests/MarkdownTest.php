<?php

declare(strict_types=1);

namespace App\Tests;

use App\Knowledge\Markdown;
use App\Knowledge\Slug;
use App\Uid;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class MarkdownTest extends TestCase
{
    private function html(string $markdown): string
    {
        return new Markdown()->render($markdown)->html;
    }

    #[DataProvider('hostileMarkdown')]
    public function testHtmlInTheSourceIsNeverPassedThrough(string $markdown, string $mustNotContain): void
    {
        self::assertStringNotContainsStringIgnoringCase($mustNotContain, $this->html($markdown));
    }

    /**
     * @return iterable<string, array{string, string}>
     */
    public static function hostileMarkdown(): iterable
    {
        yield 'script' => ['Hei <script>alert(1)</script>', '<script'];
        yield 'hendelse på bilde' => ['<img src=x onerror=alert(1)>', '<img'];
        yield 'iframe' => ["<iframe src=\"https://evil.example\"></iframe>\n", '<iframe'];
        yield 'javascript-lenke' => ['[klikk](javascript:alert(1))', 'javascript:'];
        yield 'data-lenke' => ['[klikk](data:text/html,<script>alert(1)</script>)', 'href="data:'];
        yield 'stil' => ['<style>body{display:none}</style>', '<style'];
        yield 'html i tabellcelle' => ["| A |\n| --- |\n| <b onclick=x>y</b> |\n", '<b onclick'];
    }

    public function testEscapedHtmlIsStillVisibleAsText(): void
    {
        self::assertStringContainsString('&lt;script&gt;alert(1)&lt;/script&gt;', $this->html('Hei <script>alert(1)</script>'));
    }

    public function testLineBreaksInTableCellsSurviveBecauseClickUpWritesThemAsHtml(): void
    {
        $html = $this->html("| Faktor | Hvorfor |\n| --- | --- |\n| Temperatur | For varmt:<br>Blekket tørker.<BR />For kaldt |\n");

        self::assertStringContainsString('For varmt:<br>Blekket tørker.<br>For kaldt', $html);
        self::assertStringContainsString('<div class="table-wrap"><table>', $html);
    }

    public function testHeadingsGetAsciiAnchorsAndATableOfContents(): void
    {
        $rendered = new Markdown()->render(
            "## 🩸 Blekkflyten fra tank til dyse\n\nTekst.\n\n### Steg 1: Hoderengjøring (Head Cleaning)\n\nTekst.\n\n#### Detalj\n",
        );

        self::assertStringContainsString('<h2 id="blekkflyten-fra-tank-til-dyse">', $rendered->html);
        self::assertStringContainsString('<h3 id="steg-1-hoderengjoring-head-cleaning">', $rendered->html);
        self::assertStringContainsString('<h4 id="detalj">', $rendered->html);
        // Innholdsfortegnelsen stopper på nivå 3.
        self::assertSame(
            [
                ['id' => 'blekkflyten-fra-tank-til-dyse', 'text' => '🩸 Blekkflyten fra tank til dyse', 'level' => 2],
                ['id' => 'steg-1-hoderengjoring-head-cleaning', 'text' => 'Steg 1: Hoderengjøring (Head Cleaning)', 'level' => 3],
            ],
            $rendered->toc,
        );
    }

    public function testTwoHeadingsWithTheSameTextGetDifferentAnchors(): void
    {
        $markdown = "## På Windows\n\na\n\n## På Windows\n\nb\n";

        $first = new Markdown()->render($markdown);
        self::assertSame(['pa-windows', 'pa-windows-1'], array_column($first->toc, 'id'));

        // Tellingen starter på nytt for hvert dokument, også med samme Markdown-objekt.
        $renderer = new Markdown();
        $renderer->render($markdown);
        self::assertSame(['pa-windows', 'pa-windows-1'], array_column($renderer->render($markdown)->toc, 'id'));
    }

    public function testAHeadingWithOnlyEmojiStillGetsAnAnchor(): void
    {
        self::assertSame(['avsnitt'], array_column(new Markdown()->render("## 🚨\n")->toc, 'id'));
    }

    public function testImagesAreLazyAndInternalLinksArePlain(): void
    {
        $html = $this->html("![Dysesjekk](/media/0123456789abcdef0123456789abcdef)\n\n[Kapittel 4](/artikkel/hoderens)\n");

        self::assertStringContainsString('src="/media/0123456789abcdef0123456789abcdef"', $html);
        self::assertStringContainsString('loading="lazy"', $html);
        self::assertStringContainsString('<a href="/artikkel/hoderens">Kapittel 4</a>', $html);
    }

    public function testExternalLinksDoNotLeakWhereTheCustomerCameFrom(): void
    {
        $html = $this->html('[ikea.no](http://ikea.no)');

        self::assertStringContainsString('href="http://ikea.no"', $html);
        self::assertStringContainsString('noopener', $html);
        self::assertStringContainsString('noreferrer', $html);
    }

    public function testChecklistsBecomeDisabledCheckboxes(): void
    {
        $html = $this->html("- [ ] **Sjekk blekknivåene**\n- [x] Ferdig\n");

        self::assertSame(2, substr_count($html, 'type="checkbox"'));
        self::assertSame(2, substr_count($html, 'disabled'));
    }

    /**
     * @return iterable<string, array{string, string}>
     */
    public static function slugs(): iterable
    {
        yield 'norske bokstaver' => ['Feilsøking – vanlige problemer og løsninger', 'feilsoking-vanlige-problemer-og-losninger'];
        yield 'æ og å' => ['Bære på våte ærmer', 'baere-pa-vate-aermer'];
        yield 'skråstrek' => ['Bytting av blekkpute/vedlikeholdstank', 'bytting-av-blekkpute-vedlikeholdstank'];
        yield 'emoji og tegn' => ['🖨️ Slik printer du en dysesjekk!', 'slik-printer-du-en-dysesjekk'];
        yield 'bare tegn' => ['🚨 !!!', ''];
        yield 'store bokstaver' => ['CMYK-CHART', 'cmyk-chart'];
    }

    #[DataProvider('slugs')]
    public function testSlugsAreLowercaseAsciiWithHyphens(string $text, string $expected): void
    {
        self::assertSame($expected, Slug::of($text));
    }

    public function testALongSlugIsCutWithoutATrailingHyphen(): void
    {
        self::assertSame('aaaa-bbbb', Slug::of('aaaa bbbb cccc', 10));
    }

    public function testUidsHaveTheirPrefixAndAreUnique(): void
    {
        $first = Uid::new('kd');
        $second = Uid::new('kd');

        self::assertMatchesRegularExpression('/^kd[ybndrfg8ejkmcpqxot1uwisza345h769]{26}$/', $first);
        self::assertNotSame($first, $second);
    }

    public function testAUidPrefixMustBeTwoLowercaseLetters(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        Uid::new('KD');
    }
}
