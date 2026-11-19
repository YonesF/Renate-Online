<?php

declare(strict_types=1);

use App\Chat\Conversations;
use App\Chat\RateLimit;
use App\Http\Response;
use App\Knowledge\Library;
use App\Pages\VisitorPage;
use App\Uid;

return new class extends VisitorPage {
    private const int MAX_LENGTH = 4000;
    private const array AUDIENCES = ['public'];
    private const string UNAVAILABLE = 'Lena er ikke tilgjengelig akkurat nå. Ta kontakt med oss via nettbutikken '
        . 'på creativeart.no, så hjelper vi deg.';

    /**
     * POST /conversation/send: lagrer kundens melding og strømmer Lenas svar.
     */
    public function executeSend(): Response
    {
        $data = json_decode($this->context->request->body, true);
        $text = is_array($data) && is_string($data['message'] ?? null) ? trim($data['message']) : '';
        if ($text === '' || mb_strlen($text) > self::MAX_LENGTH) {
            return $this->error(422, 'invalid_request', 'Meldingen må ha mellom 1 og 4000 tegn.');
        }

        $pdo = $this->context->database->pdo();
        $visitor = $this->visitorHash();

        // 20 meldinger per enhet og 300 per adresse hvert kvarter. Et nytt token er gratis, derfor begge.
        // Bak Docker ser alle kunder ut til å komme fra samme adresse, så det taket er også et samlet tak.
        $limits = new RateLimit($pdo);
        if (!$limits->allow("visitor:{$visitor}", 20, 900) || !$limits->allow('ip:' . $this->context->request->ip, 300, 900)) {
            return $this->error(429, 'rate_limited', 'Du har sendt mange meldinger. Vent litt og prøv igjen.');
        }

        $conversations = new Conversations($pdo);
        $conversation = $conversations->forVisitor($visitor);
        $conversations->add($conversation['id'], 'visitor', $text);

        $payload = [
            'run' => Uid::new('ru'),
            'conversation' => $conversation['uid'],
            'messages' => $conversations->messages($conversation['id']),
            'context' => $this->pageContext($data),
            'audiences' => self::AUDIENCES,
            'locale' => 'nb_NO',
            'knowledge' => new Library($pdo)->knowledge(self::AUDIENCES),
        ];
        $agent = $this->context->agent;

        $stream = static function () use ($agent, $payload, $conversations, $conversation): void {
            // Svaret skal lagres også om kunden lukker panelet underveis.
            ignore_user_abort(true);
            set_time_limit(150);

            $emit = static function (array $event): void {
                echo 'data: ' . json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n\n";
                flush();
            };

            $answer = '';
            $handover = false;
            $agent->run($payload, static function (array $event) use (&$answer, &$handover, $emit): void {
                if ($event['type'] === 'delta' && is_string($event['text'] ?? null)) {
                    $answer .= $event['text'];
                    $emit(['type' => 'delta', 'text' => $event['text']]);
                } elseif ($event['type'] === 'typing') {
                    $emit(['type' => 'typing']);
                } elseif ($event['type'] === 'handover' || $event['type'] === 'error') {
                    $handover = true;
                }
            });

            // Uten svar fra Lena får kunden en ærlig beskjed, og samtalen venter på en ansatt.
            if (trim($answer) === '') {
                $answer = self::UNAVAILABLE;
                $handover = true;
                $emit(['type' => 'delta', 'text' => $answer]);
            }

            $conversations->add($conversation['id'], 'lena', trim($answer));
            if ($handover) {
                $conversations->setStatus($conversation['id'], 'waiting');
            }
            $emit(['type' => 'done', 'status' => $handover ? 'waiting' : 'open']);
        };

        return new Response(200, '', [
            'Content-Type' => 'text/event-stream; charset=utf-8',
            'Cache-Control' => 'no-cache, no-store',
            'X-Accel-Buffering' => 'no',
            'X-Content-Type-Options' => 'nosniff',
        ], $stream);
    }

    /**
     * POST /conversation/history: meldingene i denne enhetens samtale.
     */
    public function executeHistory(): Response
    {
        $conversations = new Conversations($this->context->database->pdo());
        $conversation = $conversations->forVisitor($this->visitorHash());

        return $this->json([
            'status' => $conversation['status'],
            'messages' => $conversations->messages($conversation['id']),
        ]);
    }

    /**
     * Hvilken side kunden er på. Kommer fra nettleseren og er opplysning, ikke instruks.
     *
     * @param array<array-key, mixed> $data
     * @return array<string, mixed>
     */
    private function pageContext(array $data): array
    {
        $context = ['source' => 'help'];
        $page = is_array($data['page'] ?? null) ? $data['page'] : [];
        if (is_string($page['url'] ?? null) && $page['url'] !== '') {
            $context['page'] = ['url' => mb_substr($page['url'], 0, 500)];
            if (is_string($page['title'] ?? null) && $page['title'] !== '') {
                $context['page']['title'] = mb_substr($page['title'], 0, 200);
            }
        }

        return $context;
    }
};
