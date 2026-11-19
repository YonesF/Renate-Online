<?php

declare(strict_types=1);

namespace App\Pages;

use App\Http\Request;
use App\Http\Response;

/**
 * Endepunktene sidepanelet kaller. Besøkende er ikke brukere og har ingen sesjon.
 * Godtar bare POST fra panelets egen opprinnelse.
 *
 * Identiteten er et enhetstoken panelet lager og husker selv. Serveren
 * lagrer bare en HMAC av det, så en lekket database gir ingen tilgang.
 */
abstract class VisitorPage extends JSONPage
{
    private const string TOKEN = '/^[A-Za-z0-9_-]{43}$/';

    protected function guard(Request $request): ?Response
    {
        $denied = $this->allowOnly($request, ['POST']);
        if ($denied !== null) {
            return $denied;
        }

        if ($request->header('Sec-Fetch-Site') !== 'same-origin') {
            return $this->error(403, 'forbidden', 'Forespørselen må komme fra panelet.');
        }

        if (preg_match(self::TOKEN, $request->header('X-Agent-Token') ?? '') !== 1) {
            return $this->error(401, 'unauthorized', 'Mangler enhetstoken.');
        }

        return null;
    }

    /**
     * Det eneste som lagres om hvem den besøkende er.
     */
    protected function visitorHash(): string
    {
        return hash_hmac(
            'sha256',
            $this->context->request->header('X-Agent-Token') ?? '',
            $this->context->config->require('APP_SECRET'),
        );
    }
}
