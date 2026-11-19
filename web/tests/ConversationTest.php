<?php

declare(strict_types=1);

namespace App\Tests;

use App\Http\Kernel;
use App\Http\Request;
use App\Http\Response;
use App\Tests\Fake\FakeAgent;

/**
 * Chatten fra panelets forespørsel til lagret svar, med ekte database og falsk agent.
 */
final class ConversationTest extends KnowledgeTestCase
{
    private const string ANNA = 'annaannaannaannaannaannaannaannaannaannaann';
    private const string BIRK = 'birkbirkbirkbirkbirkbirkbirkbirkbirkbirkbir';

    private FakeAgent $agent;

    protected function setUp(): void
    {
        parent::setUp();

        $this->agent = new FakeAgent();
    }

    /**
     * @param array<string, mixed> $body
     * @phpstan-impure
     */
    private function post(string $path, array $body, string $token = self::ANNA, string $ip = '203.0.113.5'): Response
    {
        $request = new Request(
            'POST',
            'agent.localhost',
            $path,
            ['sec-fetch-site' => 'same-origin', 'x-agent-token' => $token],
            body: (string) json_encode($body),
            ip: $ip,
        );

        return new Kernel(dirname(__DIR__), $this->config(), $this->agent)->handle($request);
    }

    /**
     * Kjører svarstrømmen og gir hendelsene panelet ville ha fått.
     *
     * @return list<array<string, mixed>>
     */
    private function stream(Response $response): array
    {
        self::assertSame(200, $response->status);
        self::assertNotNull($response->stream);

        ob_start();
        ($response->stream)();
        $output = (string) ob_get_clean();

        $events = [];
        foreach (explode("\n\n", trim($output)) as $block) {
            self::assertStringStartsWith('data: ', $block);
            $event = json_decode(substr($block, 6), true);
            self::assertIsArray($event);
            $events[] = $event;
        }

        return $events;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function history(string $token = self::ANNA): array
    {
        $data = json_decode($this->post('/conversation/history', [], $token)->body, true);
        self::assertIsArray($data);

        return $data['messages'];
    }

    public function testAMessageIsStoredAnsweredAndStreamedToThePanel(): void
    {
        $events = $this->stream($this->post('/conversation/send', ['message' => ' Hva gjør jeg når cyan mangler? ']));

        self::assertSame(
            [
                ['type' => 'typing'],
                ['type' => 'delta', 'text' => 'Kjør en dysesjekk '],
                ['type' => 'delta', 'text' => 'først.'],
                ['type' => 'done', 'status' => 'open'],
            ],
            $events,
        );
        self::assertSame(
            [['visitor', 'Hva gjør jeg når cyan mangler?'], ['lena', 'Kjør en dysesjekk først.']],
            array_map(static fn (array $m): array => [$m['role'], $m['text']], $this->history()),
        );
    }

    public function testLenaGetsTheHistoryAndOnlyPublishedPublicKnowledge(): void
    {
        $this->seed();
        $this->import();
        $this->stream($this->post('/conversation/send', ['message' => 'Første']));

        $this->stream($this->post('/conversation/send', [
            'message' => 'Andre',
            'page' => ['url' => '/artikkel/hoderens-steg-for-steg', 'title' => '2. Hoderens'],
        ]));

        $run = $this->agent->runs[1];
        self::assertSame(['Første', 'Kjør en dysesjekk først.', 'Andre'], array_column($run['messages'], 'text'));
        self::assertSame(['public'], $run['audiences']);
        self::assertSame('2. Hoderens', $run['context']['page']['title']);
        // De to publiserte kapitlene, i guidens rekkefølge. Det interne utkastet er ikke med.
        self::assertSame(
            ['slik-fungerer-skriveren', 'hoderens-steg-for-steg'],
            array_column($run['knowledge'], 'slug'),
        );
        self::assertMatchesRegularExpression('/^ru[a-z0-9]{26}$/', $run['run']);
        self::assertMatchesRegularExpression('/^co[a-z0-9]{26}$/', $run['conversation']);
    }

    public function testAHandoverMarksTheConversationAsWaiting(): void
    {
        $this->agent->events = [
            ['type' => 'delta', 'text' => 'Dette må en ansatt svare på.'],
            ['type' => 'handover', 'reason' => 'Ordre'],
            ['type' => 'done', 'model' => 'fake', 'usage' => ['input_tokens' => 1, 'output_tokens' => 1]],
        ];

        $events = $this->stream($this->post('/conversation/send', ['message' => 'Hvor er ordren min?']));

        self::assertSame(['type' => 'done', 'status' => 'waiting'], $events[array_key_last($events)]);
        self::assertSame('waiting', $this->pdo->query('SELECT status FROM conversations')->fetchColumn());
    }

    public function testWhenLenaIsUnavailableTheCustomerIsToldAndTheConversationWaits(): void
    {
        $this->agent->events = [['type' => 'error', 'code' => 'model_unavailable', 'message' => 'x']];

        $events = $this->stream($this->post('/conversation/send', ['message' => 'Hei']));

        self::assertStringContainsString('Lena er ikke tilgjengelig akkurat nå', (string) $events[0]['text']);
        self::assertSame(['type' => 'done', 'status' => 'waiting'], $events[1]);
        self::assertStringContainsString('ikke tilgjengelig', $this->history()[1]['text']);
    }

    public function testOneDeviceNeverSeesAnotherDevicesConversation(): void
    {
        $this->stream($this->post('/conversation/send', ['message' => 'Annas hemmelige spørsmål'], self::ANNA));

        self::assertCount(2, $this->history(self::ANNA));
        self::assertSame([], $this->history(self::BIRK));
    }

    public function testOnlyAHashOfTheDeviceTokenIsStored(): void
    {
        $this->stream($this->post('/conversation/send', ['message' => 'Hei']));

        $stored = (string) $this->pdo->query('SELECT visitor_hash FROM conversations')->fetchColumn();

        self::assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $stored);
        self::assertStringNotContainsString(self::ANNA, $stored);
    }

    public function testAnEmptyOrTooLongMessageIsRejectedBeforeLenaIsCalled(): void
    {
        foreach (['', '   ', str_repeat('a', 4001)] as $message) {
            self::assertSame(422, $this->post('/conversation/send', ['message' => $message])->status);
        }
        self::assertSame(422, $this->post('/conversation/send', ['melding' => 'feil felt'])->status);
        self::assertSame([], $this->agent->runs);
    }

    public function testTheTwentyFirstMessageInFifteenMinutesIsRefused(): void
    {
        for ($i = 0; $i < 20; $i++) {
            self::assertSame(200, $this->post('/conversation/send', ['message' => "Nr {$i}"])->status);
        }

        $response = $this->post('/conversation/send', ['message' => 'En til']);

        self::assertSame(429, $response->status);
        // Et nytt token hjelper ikke når adressen har brukt opp sin kvote.
        for ($i = 0; $i < 280; $i++) {
            $token = str_pad("t{$i}", 43, 'x');
            $this->post('/conversation/send', ['message' => 'Hei'], $token);
        }
        self::assertSame(429, $this->post('/conversation/send', ['message' => 'Hei'], str_pad('ny', 43, 'y'))->status);
    }

    public function testThePanelPageLoadsItsScriptWithANonceAndKnowsWhereTheHelpSiteIs(): void
    {
        $response = new Kernel(dirname(__DIR__), $this->config(), $this->agent)
            ->handle(new Request('GET', 'agent.localhost', '/'));

        self::assertSame(200, $response->status);
        self::assertStringContainsString('data-help-origin="http://hjelp.localhost:8080"', $response->body);
        self::assertMatchesRegularExpression('~<script nonce="[A-Za-z0-9+/]{24}" src="/assets/panel.js[?]v=[0-9a-f]+">~', $response->body);
    }

    public function testTheHelpSiteMayFrameThePanelAndNothingElse(): void
    {
        $response = new Kernel(dirname(__DIR__), $this->config(), $this->agent)
            ->handle(new Request('GET', 'hjelp.localhost', '/'));

        self::assertStringContainsString(
            'frame-src http://agent.localhost:8080;',
            $response->headers['Content-Security-Policy'],
        );
        self::assertStringContainsString('data-origin="http://agent.localhost:8080"', $response->body);
    }
}
