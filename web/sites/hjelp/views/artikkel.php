<?php

declare(strict_types=1);

use App\Http\Response;
use App\Knowledge\Markdown;
use App\Pages\HelpPage;

return new class extends HelpPage {
    /** GET /artikkel/<slug> */
    public function execute(string $slug): Response
    {
        $document = $this->library()->document($slug, self::AUDIENCES);
        if ($document === null) {
            return $this->notFound();
        }

        $rendered = new Markdown()->render($document->markdown);

        return $this->html('article.twig', [
            'document' => $document,
            'html' => $rendered->html,
            'toc' => $rendered->toc,
        ]);
    }
};
