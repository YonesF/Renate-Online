<?php

declare(strict_types=1);

namespace App\Chat;

/**
 * Kjører Lena. Den ekte snakker med agent over HTTP; testene bruker en falsk.
 */
interface AgentClient
{
    /**
     * Sender en kjøring (contracts/agent.run.request.schema.json) og kaller
     * $onEvent for hver hendelse i svarstrømmen (agent.run.event.schema.json).
     *
     * @param array<string, mixed> $payload
     * @param callable(array<string, mixed>): void $onEvent
     */
    public function run(array $payload, callable $onEvent): void;
}
