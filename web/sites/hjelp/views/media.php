<?php

declare(strict_types=1);

use App\Http\Response;
use App\Knowledge\ImageStore;
use App\Pages\HelpPage;

return new class extends HelpPage {
    /**
     * GET /media/<id>: et speilet bilde fra knowledge/assets.
     *
     * Id-en er hashen av innholdet. Da kan svaret mellomlagres for alltid,
     * og bare filer importen selv har godkjent som bilder, kan serveres.
     */
    public function execute(string $id): Response
    {
        $image = ImageStore::locate($this->context->knowledgeDirectory() . '/assets', $id);
        $bytes = $image === null ? false : file_get_contents($image['path']);
        if ($image === null || $bytes === false) {
            return $this->notFound();
        }

        return new Response(200, $bytes, [
            'Content-Type' => $image['mime'],
            'Content-Length' => (string) strlen($bytes),
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'Content-Security-Policy' => "default-src 'none'",
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
};
