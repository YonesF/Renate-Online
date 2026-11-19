<?php

declare(strict_types=1);

use App\Http\Response;
use App\Pages\ConsolePage;

return new class extends ConsolePage {
    /** GET / */
    public function execute(): Response
    {
        return Response::text(200, "Konsollen er ikke bygd ennå.\n");
    }
};
