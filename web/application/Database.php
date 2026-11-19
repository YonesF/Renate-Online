<?php

declare(strict_types=1);

namespace App;

use PDO;

/**
 * Tilkoblingen til MySQL. Kobler først til når noen spør, slik at sider
 * som ikke trenger databasen (healthz), heller ikke er avhengige av den.
 */
final class Database
{
    private ?PDO $pdo = null;

    public function __construct(private readonly Config $config)
    {
    }

    public function pdo(): PDO
    {
        return $this->pdo ??= self::connect(
            $this->config->require('MYSQL_HOST'),
            $this->config->require('MYSQL_DATABASE'),
            $this->config->require('MYSQL_USER'),
            $this->config->require('MYSQL_PASSWORD'),
        );
    }

    /**
     * Alle verdier bindes: ekte prepared statements, ingen emulering.
     */
    public static function connect(string $host, string $database, string $user, string $password): PDO
    {
        $pdo = new PDO("mysql:host={$host};dbname={$database};charset=utf8mb4", $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 3,
        ]);
        $pdo->exec("SET time_zone = '+00:00'");

        return $pdo;
    }
}
