<?php

declare(strict_types=1);

namespace App\Pages;

use App\Http\Request;
use App\Http\Response;
use App\Knowledge\Library;

/**
 * Hjelpesiden: åpen for alle, bare lesing, ingen sesjon.
 */
abstract class HelpPage extends WebPage
{
    /**
     * Hvem hjelpesiden viser innhold for. Uten bekreftet kunde er det bare
     * det offentlige. Sidene sender denne listen til Library og velger aldri selv.
     */
    protected const array AUDIENCES = ['public'];

    protected function guard(Request $request): ?Response
    {
        return $this->allowOnly($request, ['GET', 'HEAD']);
    }

    protected function library(): Library
    {
        return new Library($this->context->database->pdo());
    }
}
