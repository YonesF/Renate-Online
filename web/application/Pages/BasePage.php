<?php

declare(strict_types=1);

namespace App\Pages;

use App\Http\Context;
use App\Http\Request;
use App\Http\Response;
use LogicException;
use ReflectionMethod;

/**
 * Sidetypene er vaktene:
 *
 *   BasePage → WebPage  → HelpPage, PanelPage, ConsolePage
 *            → JSONPage → VisitorPage, HealthPage
 *
 * En view må arve fra en sidetype med vakt. tests/GuardTest.php feiler ellers.
 */
abstract class BasePage
{
    protected Context $context;

    /**
     * Hvem slipper inn? null betyr sluppet inn, et svar betyr avvist.
     */
    abstract protected function guard(Request $request): ?Response;

    abstract protected function notFound(): Response;

    /**
     * Neste stisegment velger metoden: foo-bar kaller executeFooBar(), ellers execute().
     * Argumenter metoden ikke tar imot, gir 404.
     *
     * @param list<string> $args
     */
    final public function run(Context $context, ?string $action, array $args): Response
    {
        $this->context = $context;

        $denied = $this->guard($context->request);
        if ($denied !== null) {
            return $denied;
        }

        $method = 'execute';
        if ($action !== null) {
            $named = 'execute' . str_replace('-', '', ucwords($action, '-'));
            if ($this->declares($named)) {
                $method = $named;
            } else {
                array_unshift($args, $action);
            }
        }

        if (!$this->declares($method)) {
            return $this->notFound();
        }

        $reflection = new ReflectionMethod($this, $method);
        $tooMany = !$reflection->isVariadic() && count($args) > $reflection->getNumberOfParameters();
        $tooFew = count($args) < $reflection->getNumberOfRequiredParameters();
        if ($tooMany || $tooFew) {
            return $this->notFound();
        }

        $response = $reflection->invokeArgs($this, $args);
        if (!$response instanceof Response) {
            throw new LogicException(static::class . "::{$method}() må returnere et svar.");
        }

        return $response;
    }

    /**
     * @param list<string> $methods
     */
    protected function allowOnly(Request $request, array $methods): ?Response
    {
        if (in_array($request->method, $methods, true)) {
            return null;
        }

        return Response::text(405, "Metoden er ikke tillatt.\n")
            ->withHeader('Allow', implode(', ', $methods));
    }

    /**
     * PHP skiller ikke mellom store og små bokstaver i metodenavn.
     * Uten denne sjekken ville /send og /s-end truffet samme metode.
     */
    private function declares(string $method): bool
    {
        if (!method_exists($this, $method)) {
            return false;
        }

        $reflection = new ReflectionMethod($this, $method);

        return $reflection->isPublic() && $reflection->getName() === $method;
    }
}
