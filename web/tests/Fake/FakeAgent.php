<?php

declare(strict_types=1);

namespace App\Tests\Fake;

use App\Chat\AgentClient;

/**
 * Står for agent i testene. Sender hendelsene testen har lagt inn, og
 * husker kjøringene den fikk.
 */
final class FakeAgent implements AgentClient
{
    /** @var list<array<string, mixed>> */
    public array $events = [
        ['type' => 'typing'],
        ['type' => 'delta', 'text' => 'Kjør en dysesjekk '],
        ['type' => 'delta', 'text' => 'først.'],
        ['type' => 'done', 'model' => 'fake', 'usage' => ['input_tokens' => 1, 'output_tokens' => 1]],
    ];

    /** @var list<array<string, mixed>> */
    public array $runs = [];

    public function run(array $payload, callable $onEvent): void
    {
        $this->runs[] = $payload;
        foreach ($this->events as $event) {
            $onEvent($event);
        }
    }
}
