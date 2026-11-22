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
        $guideChapters = [];
        if ($document->guideSlug === 'vedlikehold-epson') {
            foreach ($this->library()->groups(self::AUDIENCES, $document->categorySlug) as $group) {
                if ($group->slug === $document->guideSlug) {
                    $guideChapters = array_values(array_filter(
                        $group->documents,
                        static fn ($chapter): bool => $chapter->slug !== 'om-guiden',
                    ));
                    break;
                }
            }
        }

        return $this->html('article.twig', [
            'document' => $document,
            'html' => $rendered->html,
            'toc' => $rendered->toc,
            'guideChapters' => $guideChapters,
        ]);
    }
};
