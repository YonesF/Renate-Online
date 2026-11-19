<?php

declare(strict_types=1);

namespace App\Chat;

use App\Uid;
use PDO;

/**
 * Samtalene med Lena. Én endeløs samtale per besøkende.
 */
final readonly class Conversations
{
    public function __construct(private PDO $pdo)
    {
    }

    /**
     * @return array{id: int, uid: string, status: string}
     */
    public function forVisitor(string $visitorHash): array
    {
        $insert = $this->pdo->prepare('INSERT IGNORE INTO conversations (uid, visitor_hash) VALUES (?, ?)');
        $insert->execute([Uid::new('co'), $visitorHash]);

        $find = $this->pdo->prepare('SELECT id, uid, status FROM conversations WHERE visitor_hash = ?');
        $find->execute([$visitorHash]);
        /** @var array{id: int|string, uid: string, status: string} $row */
        $row = $find->fetch();

        return ['id' => (int) $row['id'], 'uid' => $row['uid'], 'status' => $row['status']];
    }

    public function add(int $conversationId, string $role, string $text): void
    {
        $insert = $this->pdo->prepare('INSERT INTO messages (uid, conversation_id, role, text) VALUES (?, ?, ?, ?)');
        $insert->execute([Uid::new('me'), $conversationId, $role, $text]);

        $touch = $this->pdo->prepare('UPDATE conversations SET updated_at = UTC_TIMESTAMP() WHERE id = ?');
        $touch->execute([$conversationId]);
    }

    /**
     * De siste meldingene, eldste først.
     *
     * @return list<array{role: string, text: string, at: string}>
     */
    public function messages(int $conversationId, int $limit = 40): array
    {
        $statement = $this->pdo->prepare(
            "SELECT role, text, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS at
             FROM (SELECT id, role, text, created_at FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT {$limit}) recent
             ORDER BY id",
        );
        $statement->execute([$conversationId]);

        $messages = [];
        foreach ($statement->fetchAll() as $row) {
            $messages[] = ['role' => (string) $row['role'], 'text' => (string) $row['text'], 'at' => (string) $row['at']];
        }

        return $messages;
    }

    public function setStatus(int $conversationId, string $status): void
    {
        $update = $this->pdo->prepare('UPDATE conversations SET status = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?');
        $update->execute([$status, $conversationId]);
    }
}
