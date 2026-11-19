<?php

declare(strict_types=1);

namespace App;

use RuntimeException;

/**
 * Alt web trenger utenfra. Leses én gang per forespørsel.
 */
final readonly class Config
{
    private const array NAMES = [
        'MYSQL_HOST',
        'MYSQL_DATABASE',
        'MYSQL_USER',
        'MYSQL_PASSWORD',
        'SEARCH_URL',
        'AGENT_URL',
        'INTERNAL_TOKEN',
        'APP_SECRET',
        'KNOWLEDGE_DIR',
    ];

    /**
     * @param array<string, string> $values
     */
    public function __construct(private array $values)
    {
    }

    public static function fromEnvironment(): self
    {
        $values = [];
        foreach (self::NAMES as $name) {
            $value = getenv($name);
            if (is_string($value) && trim($value) !== '') {
                $values[$name] = $value;
            }
        }

        return new self($values);
    }

    public function get(string $name): ?string
    {
        return $this->values[$name] ?? null;
    }

    public function require(string $name): string
    {
        return $this->values[$name]
            ?? throw new RuntimeException("Miljøvariabelen {$name} mangler.");
    }
}
