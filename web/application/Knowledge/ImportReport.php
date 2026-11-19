<?php

declare(strict_types=1);

namespace App\Knowledge;

/**
 * Hva en import gjorde, og hva en ansatt bør se på.
 */
final class ImportReport
{
    public int $created = 0;
    public int $updated = 0;
    public int $unchanged = 0;
    public int $removed = 0;
    public int $imagesFetched = 0;

    /** @var list<array{file: string, message: string}> */
    public array $warnings = [];

    public function warn(string $file, string $message): void
    {
        $this->warnings[] = ['file' => $file, 'message' => $message];
    }
}
