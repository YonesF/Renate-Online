<?php

declare(strict_types=1);

namespace App\View;

use App\Http\Context;
use Twig\Environment;
use Twig\Loader\FilesystemLoader;

/**
 * Twig. Nettstedets egne maler vinner over de felles i application/templates.
 */
final class Templates
{
    public static function forSite(Context $context): Environment
    {
        $paths = array_values(array_filter(
            [
                "{$context->root}/sites/{$context->site->name}/templates",
                "{$context->root}/application/templates",
            ],
            is_dir(...),
        ));

        return new Environment(new FilesystemLoader($paths), [
            'autoescape' => 'html',
            'strict_variables' => true,
            'cache' => false,
        ]);
    }
}
