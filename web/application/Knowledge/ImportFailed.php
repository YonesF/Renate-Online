<?php

declare(strict_types=1);

namespace App\Knowledge;

use RuntimeException;

/**
 * Importen kunne ikke starte, for eksempel fordi knowledge.json er ugyldig.
 */
final class ImportFailed extends RuntimeException
{
}
