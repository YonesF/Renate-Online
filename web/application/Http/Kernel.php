<?php

declare(strict_types=1);

namespace App\Http;

use App\Chat\AgentClient;
use App\Chat\HttpAgentClient;
use App\Config;
use App\Database;
use App\Pages\BasePage;
use LogicException;
use Throwable;

/**
 * Fra forespørsel til svar:
 *
 *   1. Host velger nettsted i configuration/hostmap.php. Ukjent host gir 400.
 *   2. Stisegmentene velger sites/<nettsted>/views/<segment>.php.
 *   3. Sidetypen er vakten, og neste segment velger execute-metoden.
 */
final readonly class Kernel
{
    private const string HOST = '/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/';

    public function __construct(
        private string $root,
        private Config $config,
        private ?AgentClient $agent = null,
    ) {
    }

    public function handle(Request $request): Response
    {
        try {
            $site = $this->site($request->host);
            if ($site === null) {
                return Response::text(400, "Ukjent vert.\n");
            }

            $route = Router::resolve("{$this->root}/sites/{$site->name}/views", $request->path);
            if ($route === null) {
                return Response::text(404, "Fant ikke siden.\n");
            }

            $page = require $route->file;
            if (!$page instanceof BasePage) {
                throw new LogicException("{$route->file} må returnere en side.");
            }

            $context = new Context(
                $request,
                $site,
                $this->config,
                $this->root,
                new Database($this->config),
                $this->agent ?? new HttpAgentClient($this->config),
            );

            return $page->run($context, $route->action, $route->args);
        } catch (Throwable $error) {
            error_log(sprintf(
                '%s: %s i %s:%d',
                $error::class,
                $error->getMessage(),
                $error->getFile(),
                $error->getLine(),
            ));

            return Response::text(500, "Noe gikk galt.\n");
        }
    }

    private function site(string $host): ?Site
    {
        $name = preg_replace('/:\d{1,5}$/', '', strtolower($host)) ?? '';
        if (preg_match(self::HOST, $name) !== 1) {
            return null;
        }

        $map = require "{$this->root}/configuration/hostmap.php";
        $entry = is_array($map) ? ($map[$name] ?? null) : null;
        if (!is_array($entry) || !is_string($entry['site'] ?? null)) {
            return null;
        }

        $ancestors = [];
        foreach (is_array($entry['frame_ancestors'] ?? null) ? $entry['frame_ancestors'] : [] as $origin) {
            if (is_string($origin)) {
                $ancestors[] = $origin;
            }
        }

        return new Site(
            name: $entry['site'],
            framed: ($entry['framed'] ?? false) === true,
            frameAncestors: $ancestors,
            panel: is_string($entry['panel'] ?? null) ? $entry['panel'] : null,
        );
    }
}
