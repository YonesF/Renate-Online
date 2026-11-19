<?php

declare(strict_types=1);

namespace App\Http;

use Closure;

final readonly class Response
{
    /**
     * @param array<string, string> $headers
     * @param (Closure(): void)|null $stream skriver svaret selv, bit for bit (Lenas svarstrøm)
     */
    public function __construct(
        public int $status = 200,
        public string $body = '',
        public array $headers = [],
        public ?Closure $stream = null,
    ) {
    }

    public static function text(int $status, string $body): self
    {
        return new self($status, $body, [
            'Content-Type' => 'text/plain; charset=utf-8',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function json(int $status, array $data): self
    {
        $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR;

        return new self($status, json_encode($data, $flags) . "\n", [
            'Content-Type' => 'application/json; charset=utf-8',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function withHeader(string $name, string $value): self
    {
        return new self($this->status, $this->body, [$name => $value] + $this->headers, $this->stream);
    }

    public function send(): void
    {
        http_response_code($this->status);
        foreach ($this->headers as $name => $value) {
            header("{$name}: {$value}");
        }

        if ($this->stream === null) {
            echo $this->body;

            return;
        }

        // Ingen mellomlagring: hver bit skal ut til nettleseren med en gang.
        while (ob_get_level() > 0) {
            ob_end_flush();
        }
        ($this->stream)();
    }
}
