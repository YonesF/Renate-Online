<?php

declare(strict_types=1);

namespace App\Pages;

use App\Http\Request;
use App\Http\Response;

/**
 * Konsollen for ansatte. Krever innlogget ansatt.
 *
 * Innlogging er ikke bygd ennå, så vakten avviser alle. Den skal åpnes
 * av en sesjon, aldri ved å fjerne sjekken.
 */
abstract class ConsolePage extends WebPage
{
    protected function guard(Request $request): ?Response
    {
        return Response::text(401, "Innlogging er ikke bygd ennå.\n");
    }
}
