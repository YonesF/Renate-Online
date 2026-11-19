<?php

declare(strict_types=1);

use App\Http\Response;
use App\Knowledge\Category;
use App\Pages\HelpPage;

return new class extends HelpPage {
    private const array LIVE_TOPICS = [
        'varmepresser' => 'Varmepresser',
        'vinyl-og-tekstil' => 'Vinyl og tekstil',
    ];

    /** GET /kategori/<slug> */
    public function execute(string $slug): Response
    {
        $library = $this->library();
        $category = $library->category($slug, self::AUDIENCES);
        if ($category === null && isset(self::LIVE_TOPICS[$slug]) && $library->document('om-guiden', self::AUDIENCES) !== null) {
            $category = new Category($slug, self::LIVE_TOPICS[$slug], 0);
        }
        if ($category === null) {
            return $this->notFound();
        }

        return $this->html('category.twig', [
            'category' => $category,
            'groups' => $library->groups(self::AUDIENCES, $slug),
        ]);
    }
};
