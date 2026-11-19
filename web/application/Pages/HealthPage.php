<?php

declare(strict_types=1);

namespace App\Pages;

use App\Http\Request;
use App\Http\Response;

/**
 * /healthz: svarer at PHP kjører og hvilket nettsted verten ga.
 * Sier bevisst ingenting om MySQL, search eller agent. Det gjør bin/console env:check.
 */
final class HealthPage extends JSONPage
{
    public function execute(): Response
    {
        return $this->json(['status' => 'ok', 'site' => $this->context->site->name]);
    }

    protected function guard(Request $request): ?Response
    {
        return $this->allowOnly($request, ['GET', 'HEAD']);
    }
}
