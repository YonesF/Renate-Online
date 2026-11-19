<?php

declare(strict_types=1);

namespace App\Pages;

use App\Http\Response;

/**
 * Et JSON-endepunkt. Feil har formen fra contracts/error.schema.json,
 * og en avvist forespørsel får en statuskode, aldri en videresending.
 */
abstract class JSONPage extends BasePage
{
    /**
     * @param array<string, mixed> $data
     */
    protected function json(array $data, int $status = 200): Response
    {
        return Response::json($status, $data);
    }

    protected function error(int $status, string $code, string $message): Response
    {
        return Response::json($status, ['error' => ['code' => $code, 'message' => $message]]);
    }

    protected function notFound(): Response
    {
        return $this->error(404, 'not_found', 'Fant ikke endepunktet.');
    }
}
