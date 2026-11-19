<?php

declare(strict_types=1);

namespace App\Tests;

use App\Http\Kernel;
use App\Http\Request;
use App\Http\Response;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * Hele veien fra forespørsel til svar, mot de ekte nettstedene i sites/.
 */
final class KernelTest extends DatabaseTestCase
{
    private const array SAME_ORIGIN = [
        'sec-fetch-site' => 'same-origin',
        'x-agent-token' => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ',
    ];

    /**
     * @param array<string, string> $headers nøklene må være små bokstaver
     */
    private function send(string $method, string $host, string $path, array $headers = []): Response
    {
        $kernel = new Kernel(dirname(__DIR__), $this->config());

        return $kernel->handle(new Request($method, $host, $path, $headers));
    }

    /**
     * @return array<string, mixed>
     */
    private function decode(Response $response): array
    {
        self::assertSame('application/json; charset=utf-8', $response->headers['Content-Type'] ?? null);
        $data = json_decode($response->body, true, flags: JSON_THROW_ON_ERROR);
        self::assertIsArray($data);

        return $data;
    }

    #[DataProvider('hostsThatAreNotInTheHostmap')]
    public function testAnUnknownHostGets400(string $host): void
    {
        self::assertSame(400, $this->send('GET', $host, '/')->status);
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function hostsThatAreNotInTheHostmap(): iterable
    {
        yield 'ukjent' => ['evil.example'];
        yield 'tom' => [''];
        yield 'bare port' => [':8080'];
        yield 'sti i verten' => ['hjelp.localhost/x'];
        yield 'underdomene av en kjent vert' => ['x.hjelp.localhost'];
    }

    public function testTheHostIsMatchedWithoutPortAndCase(): void
    {
        self::assertSame(200, $this->send('GET', 'hjelp.localhost:8080', '/')->status);
        self::assertSame(200, $this->send('GET', 'HJELP.localhost', '/')->status);
    }

    public function testTheHelpHomeIsServedAndMayNotBeFramed(): void
    {
        $response = $this->send('GET', 'hjelp.localhost', '/');

        self::assertSame(200, $response->status);
        self::assertStringContainsString('Hva trenger du hjelp med?', $response->body);
        $csp = $response->headers['Content-Security-Policy'] ?? '';
        self::assertStringContainsString("frame-ancestors 'none'", $csp);
        self::assertMatchesRegularExpression("/script-src 'nonce-[A-Za-z0-9+\/]{24}'/", $csp);
    }

    public function testEveryResponseGetsItsOwnNonce(): void
    {
        $first = $this->send('GET', 'hjelp.localhost', '/')->headers['Content-Security-Policy'] ?? '';
        $second = $this->send('GET', 'hjelp.localhost', '/')->headers['Content-Security-Policy'] ?? '';

        self::assertNotSame($first, $second);
    }

    #[DataProvider('pathsThatDoNotExist')]
    public function testAPathThatDoesNotExistGets404(string $path): void
    {
        self::assertSame(404, $this->send('GET', 'hjelp.localhost', $path)->status);
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function pathsThatDoNotExist(): iterable
    {
        yield 'ukjent side' => ['/finnes-ikke'];
        yield 'ukjent side med argumenter' => ['/a/b/c'];
        yield 'argument til healthz' => ['/healthz/ekstra'];
        yield 'ugyldig sti' => ['/../configuration/hostmap'];
        yield 'store bokstaver' => ['/HEALTHZ'];
    }

    public function testTheHelpSiteIsReadOnly(): void
    {
        $response = $this->send('POST', 'hjelp.localhost', '/');

        self::assertSame(405, $response->status);
        self::assertSame('GET, HEAD', $response->headers['Allow'] ?? null);
    }

    public function testThePanelMayOnlyBeFramedByTheSitesInTheHostmap(): void
    {
        $response = $this->send('GET', 'agent.localhost', '/');

        self::assertSame(200, $response->status);
        self::assertStringContainsString(
            'frame-ancestors http://hjelp.localhost:8080',
            $response->headers['Content-Security-Policy'] ?? '',
        );
    }

    public function testAVisitorEndpointOnlyTakesPost(): void
    {
        $response = $this->send('GET', 'agent.localhost', '/conversation/send', self::SAME_ORIGIN);

        self::assertSame(405, $response->status);
        self::assertSame('POST', $response->headers['Allow'] ?? null);
    }

    #[DataProvider('fetchSitesThatAreNotThePanel')]
    public function testAVisitorEndpointRejectsRequestsFromOtherOrigins(?string $fetchSite): void
    {
        $headers = $fetchSite === null ? [] : ['sec-fetch-site' => $fetchSite];

        $response = $this->send('POST', 'agent.localhost', '/conversation/send', $headers);

        self::assertSame(403, $response->status);
        self::assertSame('forbidden', $this->decode($response)['error']['code']);
    }

    /**
     * @return iterable<string, array{?string}>
     */
    public static function fetchSitesThatAreNotThePanel(): iterable
    {
        yield 'mangler' => [null];
        yield 'cross-site' => ['cross-site'];
        yield 'same-site' => ['same-site'];
        yield 'none' => ['none'];
    }

    public function testAVisitorEndpointRequiresADeviceToken(): void
    {
        $response = $this->send('POST', 'agent.localhost', '/conversation/send', ['sec-fetch-site' => 'same-origin']);

        self::assertSame(401, $response->status);
        self::assertSame('unauthorized', $this->decode($response)['error']['code']);
    }

    #[DataProvider('visitorPathsWithoutAMethod')]
    public function testOnlyDeclaredActionsCanBeCalled(string $path): void
    {
        $response = $this->send('POST', 'agent.localhost', $path, self::SAME_ORIGIN);

        self::assertSame(404, $response->status);
        self::assertSame('not_found', $this->decode($response)['error']['code']);
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function visitorPathsWithoutAMethod(): iterable
    {
        yield 'ingen handling' => ['/conversation'];
        yield 'ukjent handling' => ['/conversation/slett'];
        yield 'samme metode med andre bokstaver' => ['/conversation/s-end'];
        yield 'argument metoden ikke tar' => ['/conversation/send/ekstra'];
        yield 'arvet metode' => ['/conversation/run'];
        yield 'vakten' => ['/conversation/guard'];
    }

    #[DataProvider('adminRequests')]
    public function testTheConsoleIsClosedUntilLoginExists(string $method, string $path): void
    {
        self::assertSame(401, $this->send($method, 'admin.localhost', $path)->status);
    }

    /**
     * @return iterable<string, array{string, string}>
     */
    public static function adminRequests(): iterable
    {
        yield 'forsiden' => ['GET', '/'];
        yield 'en side som ikke finnes' => ['GET', '/brukere'];
        yield 'post' => ['POST', '/'];
    }

    #[DataProvider('sites')]
    public function testHealthzSaysWhichSiteTheHostGave(string $host, string $site): void
    {
        $response = $this->send('GET', $host, '/healthz');

        self::assertSame(200, $response->status);
        self::assertSame(['status' => 'ok', 'site' => $site], $this->decode($response));
    }

    /**
     * @return iterable<string, array{string, string}>
     */
    public static function sites(): iterable
    {
        yield 'hjelp' => ['hjelp.localhost', 'hjelp'];
        yield 'agent' => ['agent.localhost', 'agent'];
        yield 'admin' => ['admin.localhost', 'admin'];
    }
}
