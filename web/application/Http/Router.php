<?php

declare(strict_types=1);

namespace App\Http;

/**
 * Fra sti til view-fil, etter konvensjon:
 *
 *   /conversations/view/co8f3k
 *     → sites/<nettsted>/views/conversations/default.php
 *     → executeView('co8f3k')
 *
 * Segmentene valideres strengt, så stien kan aldri gå ut av views-mappen.
 */
final class Router
{
    public const int MAX_SEGMENTS = 16;
    public const int MAX_SEGMENT_LENGTH = 64;

    private const string SEGMENT = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

    /**
     * @return list<string>|null null når stien ikke er gyldig
     */
    public static function segments(string $path): ?array
    {
        $trimmed = trim($path, '/');
        if ($trimmed === '') {
            return [];
        }

        $segments = explode('/', $trimmed);
        if (count($segments) > self::MAX_SEGMENTS) {
            return null;
        }

        foreach ($segments as $segment) {
            if (strlen($segment) > self::MAX_SEGMENT_LENGTH || preg_match(self::SEGMENT, $segment) !== 1) {
                return null;
            }
        }

        return $segments;
    }

    public static function resolve(string $viewsDir, string $path): ?Route
    {
        $segments = self::segments($path);
        if ($segments === null) {
            return null;
        }

        // Mapper først: /conversations/... går inn i views/conversations/.
        $dir = $viewsDir;
        while ($segments !== [] && is_dir($dir . '/' . $segments[0])) {
            $dir .= '/' . array_shift($segments);
        }

        // Så en fil med segmentets navn, ellers default.php i mappen.
        if ($segments !== [] && is_file($dir . '/' . $segments[0] . '.php')) {
            $file = $dir . '/' . array_shift($segments) . '.php';
        } else {
            $file = $dir . '/default.php';
            if (!is_file($file)) {
                return null;
            }
        }

        // Neste segment er handlingen, resten er argumenter.
        $action = array_shift($segments);

        return new Route($file, $action, $segments);
    }
}
