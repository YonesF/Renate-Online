<?php

declare(strict_types=1);

use App\Http\Response;
use App\Knowledge\Group;
use App\Pages\HelpPage;

return new class extends HelpPage {
    /** GET / */
    public function execute(): Response
    {
        $library = $this->library();

        return $this->html('home.twig', [
            'categories' => $library->categories(self::AUDIENCES),
            // Bare guidene. Frittstående artikler finner kunden via kategorien.
            'guides' => array_values(array_filter(
                $library->groups(self::AUDIENCES),
                static fn (Group $group): bool => $group->slug !== null,
            )),
        ]);
    }
};
