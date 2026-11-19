<?php

declare(strict_types=1);

namespace App\Chat;

use App\Config;

/**
 * Kaller agent på det interne nettet og leser svaret linje for linje.
 * Svarer agent ikke, kommer det én error-hendelse i stedet for et unntak.
 */
final readonly class HttpAgentClient implements AgentClient
{
    public function __construct(private Config $config)
    {
    }

    public function run(array $payload, callable $onEvent): void
    {
        $url = $this->config->get('AGENT_URL');
        $handle = $url === null ? false : curl_init(rtrim($url, '/') . '/v1/runs');
        if ($handle === false) {
            $onEvent(['type' => 'error', 'code' => 'agent_unavailable', 'message' => 'AGENT_URL mangler.']);

            return;
        }

        $buffer = '';
        $sawEnd = false;
        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . ($this->config->get('INTERNAL_TOKEN') ?? ''),
            ],
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$buffer, &$sawEnd, $onEvent): int {
                $buffer .= $chunk;
                while (($end = strpos($buffer, "\n")) !== false) {
                    $line = trim(substr($buffer, 0, $end));
                    $buffer = substr($buffer, $end + 1);
                    $event = $line === '' ? null : json_decode($line, true);
                    if (is_array($event) && is_string($event['type'] ?? null)) {
                        $sawEnd = $sawEnd || in_array($event['type'], ['done', 'error'], true);
                        $onEvent($event);
                    }
                }

                return strlen($chunk);
            },
        ]);

        $ok = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        if (($ok === false || $status !== 200) && !$sawEnd) {
            $onEvent(['type' => 'error', 'code' => 'agent_unavailable', 'message' => "agent svarte ikke (status {$status})."]);
        }
    }
}
