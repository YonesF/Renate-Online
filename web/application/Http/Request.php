<?php

declare(strict_types=1);

namespace App\Http;

/**
 * Input-laget. Dette er den eneste filen som leser superglobals; bin/lint håndhever det.
 */
final readonly class Request
{
    /**
     * @param array<string, string> $headers nøklene er små bokstaver
     * @param array<array-key, mixed> $query
     */
    public function __construct(
        public string $method,
        public string $host,
        public string $path,
        public array $headers = [],
        public array $query = [],
        public string $body = '',
        public string $ip = '',
    ) {
    }

    public static function fromGlobals(): self
    {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (is_string($value) && str_starts_with((string) $key, 'HTTP_')) {
                $headers[strtolower(str_replace('_', '-', substr($key, 5)))] = $value;
            }
        }

        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = parse_url(is_string($uri) ? $uri : '/', PHP_URL_PATH);
        $body = file_get_contents('php://input');

        return new self(
            method: strtoupper(is_string($method) ? $method : 'GET'),
            host: $headers['host'] ?? '',
            path: is_string($path) ? $path : '/',
            headers: $headers,
            query: $_GET,
            body: is_string($body) ? $body : '',
            ip: is_string($_SERVER['REMOTE_ADDR'] ?? null) ? $_SERVER['REMOTE_ADDR'] : '',
        );
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }
}
