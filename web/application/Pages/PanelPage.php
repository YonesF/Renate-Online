<?php

declare(strict_types=1);

namespace App\Pages;

use App\Http\Request;
use App\Http\Response;

/**
 * Lenas sidepanel: HTML-en som vises i iframen. Åpen for alle, bare lesing.
 * Endepunktene panelet kaller, er VisitorPage.
 */
abstract class PanelPage extends WebPage
{
    protected function guard(Request $request): ?Response
    {
        return $this->allowOnly($request, ['GET', 'HEAD']);
    }
}
