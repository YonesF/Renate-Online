<?php

declare(strict_types=1);

namespace App\Http;

use App\Chat\AgentClient;
use App\Config;
use App\Database;

/**
 * Det en side får vite om forespørselen den svarer på.
 */
final readonly class Context
{
    public function __construct(
        public Request $request,
        public Site $site,
        public Config $config,
        public string $root,
        public Database $database,
        public AgentClient $agent,
    ) {
    }

    /**
     * Mappen med Markdown-kildene og de speilede bildene.
     */
    public function knowledgeDirectory(): string
    {
        return rtrim($this->config->get('KNOWLEDGE_DIR') ?? dirname($this->root) . '/knowledge', '/\\');
    }
}
