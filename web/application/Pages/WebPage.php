<?php

declare(strict_types=1);

namespace App\Pages;

use App\Http\Response;
use App\View\Templates;

/**
 * En HTML-side. Legger på CSP med nonce, og nekter innramming med mindre
 * nettstedet er merket som framed i hostmap.php.
 */
abstract class WebPage extends BasePage
{
    /**
     * @param array<string, mixed> $variables
     */
    protected function html(string $template, array $variables = [], int $status = 200): Response
    {
        $nonce = base64_encode(random_bytes(18));
        $body = Templates::forSite($this->context)->render($template, $variables + [
            'nonce' => $nonce,
            'site' => $this->context->site->name,
            'panel_origin' => $this->context->site->panel,
            'help_origin' => $this->context->site->frameAncestors[0] ?? null,
            'asset_version' => $this->assetVersion(),
        ]);

        return new Response($status, $body, [
            'Content-Type' => 'text/html; charset=utf-8',
            'Content-Security-Policy' => $this->contentSecurityPolicy($nonce),
            'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
        ]);
    }

    /**
     * Endres når en fil i public/assets endres, slik at nettleseren aldri
     * bruker et gammelt stilark eller skript.
     */
    private function assetVersion(): string
    {
        $newest = 0;
        foreach (glob("{$this->context->root}/public/assets/*") ?: [] as $file) {
            $newest = max($newest, (int) filemtime($file));
        }

        return dechex($newest);
    }

    protected function notFound(): Response
    {
        return Response::text(404, "Fant ikke siden.\n");
    }

    private function contentSecurityPolicy(string $nonce): string
    {
        $site = $this->context->site;
        $ancestors = $site->framed && $site->frameAncestors !== []
            ? implode(' ', $site->frameAncestors)
            : "'none'";

        // Nettsteder som viser Lenas panel, får ramme inn akkurat den adressen.
        $frames = $site->panel === null ? "'none'" : $site->panel;

        return implode('; ', [
            "default-src 'none'",
            "frame-src {$frames}",
            "script-src 'nonce-{$nonce}'",
            "style-src 'self'",
            "img-src 'self'",
            "connect-src 'self'",
            "base-uri 'none'",
            "form-action 'self'",
            "frame-ancestors {$ancestors}",
        ]);
    }
}
