<?php

declare(strict_types=1);

namespace App\Tests;

use App\Http\Router;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class RouterTest extends TestCase
{
    private string $views;

    protected function setUp(): void
    {
        $this->views = sys_get_temp_dir() . '/ca-views-' . bin2hex(random_bytes(6));
        mkdir($this->views . '/conversations', recursive: true);
        foreach (['default.php', 'conversation.php', 'conversations/default.php'] as $file) {
            file_put_contents("{$this->views}/{$file}", "<?php\n");
        }
    }

    protected function tearDown(): void
    {
        foreach (['conversations/default.php', 'conversation.php', 'default.php'] as $file) {
            unlink("{$this->views}/{$file}");
        }
        rmdir($this->views . '/conversations');
        rmdir($this->views);
    }

    public function testTheRootIsDefaultWithoutAnAction(): void
    {
        $route = Router::resolve($this->views, '/');

        self::assertNotNull($route);
        self::assertSame("{$this->views}/default.php", $route->file);
        self::assertNull($route->action);
        self::assertSame([], $route->args);
    }

    public function testAFileNamedAfterTheSegmentWinsAndTheNextSegmentIsTheAction(): void
    {
        $route = Router::resolve($this->views, '/conversation/send');

        self::assertNotNull($route);
        self::assertSame("{$this->views}/conversation.php", $route->file);
        self::assertSame('send', $route->action);
        self::assertSame([], $route->args);
    }

    public function testADirectoryIsEnteredAndTheRestIsActionAndArguments(): void
    {
        $route = Router::resolve($this->views, '/conversations/view/co8f3k');

        self::assertNotNull($route);
        self::assertSame("{$this->views}/conversations/default.php", $route->file);
        self::assertSame('view', $route->action);
        self::assertSame(['co8f3k'], $route->args);
    }

    public function testAnUnknownSegmentBecomesTheActionOfDefault(): void
    {
        $route = Router::resolve($this->views, '/ukjent/a/b');

        self::assertNotNull($route);
        self::assertSame("{$this->views}/default.php", $route->file);
        self::assertSame('ukjent', $route->action);
        self::assertSame(['a', 'b'], $route->args);
    }

    public function testATrailingSlashChangesNothing(): void
    {
        self::assertEquals(
            Router::resolve($this->views, '/conversation/send'),
            Router::resolve($this->views, '/conversation/send/'),
        );
    }

    public function testAFolderWithoutDefaultHasNoRoute(): void
    {
        unlink($this->views . '/conversations/default.php');

        try {
            self::assertNull(Router::resolve($this->views, '/conversations/view'));
        } finally {
            file_put_contents($this->views . '/conversations/default.php', "<?php\n");
        }
    }

    public function testSixteenSegmentsAreAllowedAndSeventeenAreNot(): void
    {
        self::assertCount(16, Router::segments(str_repeat('/a', 16)) ?? []);
        self::assertNull(Router::segments(str_repeat('/a', 17)));
    }

    #[DataProvider('pathsThatMustNeverReachTheFilesystem')]
    public function testAnInvalidPathHasNoRoute(string $path): void
    {
        self::assertNull(Router::segments($path));
        self::assertNull(Router::resolve($this->views, $path));
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function pathsThatMustNeverReachTheFilesystem(): iterable
    {
        yield 'opp av mappen' => ['/../etc/passwd'];
        yield 'opp midt i stien' => ['/conversations/../../default'];
        yield 'punktum' => ['/.env'];
        yield 'filendelse' => ['/default.php'];
        yield 'store bokstaver' => ['/Conversation/send'];
        yield 'mellomrom' => ['/a b'];
        yield 'prosentkoding' => ['/a%2fb'];
        yield 'bakstrek' => ['/a\\b'];
        yield 'nullbyte' => ["/a\0b"];
        yield 'tomt segment' => ['/a//b'];
        yield 'bindestrek først' => ['/-a'];
        yield 'bindestrek sist' => ['/a-'];
        yield 'dobbel bindestrek' => ['/a--b'];
        yield 'norske bokstaver' => ['/søk'];
        yield 'for langt segment' => ['/' . str_repeat('a', 65)];
    }
}
