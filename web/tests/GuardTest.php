<?php

declare(strict_types=1);

namespace App\Tests;

use App\Pages\BasePage;
use App\Pages\ConsolePage;
use App\Pages\HealthPage;
use App\Pages\HelpPage;
use App\Pages\PanelPage;
use App\Pages\VisitorPage;
use FilesystemIterator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

/**
 * Går gjennom alle views og feiler hvis én mangler vakt.
 * En ny sidetype må legges til i GUARDS for å kunne brukes.
 */
final class GuardTest extends TestCase
{
    private const array GUARDS = [
        HelpPage::class,
        PanelPage::class,
        VisitorPage::class,
        ConsolePage::class,
        HealthPage::class,
    ];

    #[DataProvider('views')]
    public function testEveryViewIsBehindAGuard(string $file): void
    {
        $page = require $file;

        self::assertInstanceOf(BasePage::class, $page, "{$file} må returnere en side.");
        self::assertNotNull(self::guardOf($page), "{$file} arver ikke fra en sidetype med vakt.");
    }

    #[DataProvider('adminViews')]
    public function testEverythingOnAdminExceptHealthzRequiresStaff(string $file): void
    {
        $page = require $file;

        self::assertInstanceOf(BasePage::class, $page);
        if (basename($file) === 'healthz.php') {
            self::assertSame(HealthPage::class, self::guardOf($page));
        } else {
            self::assertSame(ConsolePage::class, self::guardOf($page), "{$file} må være en ConsolePage.");
        }
    }

    public function testEverySiteInTheHostmapHasAFrontPage(): void
    {
        $root = dirname(__DIR__);
        $map = require "{$root}/configuration/hostmap.php";

        self::assertIsArray($map);
        self::assertNotEmpty($map);
        foreach ($map as $host => $entry) {
            self::assertIsArray($entry);
            self::assertIsString($entry['site'] ?? null, "{$host} mangler site.");
            self::assertFileExists("{$root}/sites/{$entry['site']}/views/default.php");
        }
    }

    /**
     * @return class-string|null
     */
    private static function guardOf(BasePage $page): ?string
    {
        foreach (self::GUARDS as $guard) {
            if ($page instanceof $guard) {
                return $guard;
            }
        }

        return null;
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function views(): iterable
    {
        return self::viewsIn('sites');
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function adminViews(): iterable
    {
        return self::viewsIn('sites/admin');
    }

    /**
     * @return iterable<string, array{string}>
     */
    private static function viewsIn(string $directory): iterable
    {
        $root = dirname(__DIR__);
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator("{$root}/{$directory}", FilesystemIterator::SKIP_DOTS),
        );

        foreach ($iterator as $file) {
            $path = $file instanceof SplFileInfo ? str_replace('\\', '/', $file->getPathname()) : '';
            if (str_ends_with($path, '.php') && str_contains($path, '/views/')) {
                yield substr($path, strlen($root) + 1) => [$path];
            }
        }
    }
}
