<?php

declare(strict_types=1);

namespace App\Console;

use App\Config;
use App\Database;

/**
 * conversations [antall]: viser de siste samtalene, de som venter på en ansatt først.
 *
 * Erstatter innboksen i konsollen til den er bygd. Panelet sier at
 * CreativeArt kan lese samtalene, og dette er måten å gjøre det på.
 */
final readonly class ConversationsList
{
    public function __construct(private Config $config)
    {
    }

    public function run(?string $limit): int
    {
        $count = max(1, min(200, (int) ($limit ?? '20')));
        $pdo = new Database($this->config)->pdo();

        $conversations = $pdo->query(
            "SELECT id, uid, status, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i') AS updated
             FROM conversations
             ORDER BY status = 'waiting' DESC, updated_at DESC
             LIMIT {$count}",
        );
        $rows = $conversations === false ? [] : $conversations->fetchAll();
        if ($rows === []) {
            echo "Ingen samtaler ennå.\n";

            return 0;
        }

        $messages = $pdo->prepare(
            "SELECT role, text, DATE_FORMAT(created_at, '%H:%i') AS at FROM messages WHERE conversation_id = ? ORDER BY id",
        );
        foreach ($rows as $row) {
            $label = $row['status'] === 'waiting' ? 'VENTER PÅ ANSATT' : 'åpen';
            printf("\n=== %s · %s · sist %s UTC\n", (string) $row['uid'], $label, (string) $row['updated']);

            $messages->execute([(int) $row['id']]);
            foreach ($messages->fetchAll() as $message) {
                $who = match ($message['role']) {
                    'visitor' => 'Kunde',
                    'staff' => 'Ansatt',
                    default => 'Lena',
                };
                $text = preg_replace('/\s*\n\s*/', "\n          ", trim((string) $message['text'])) ?? '';
                printf("  %s %-6s %s\n", (string) $message['at'], $who, $text);
            }
        }

        return 0;
    }
}
