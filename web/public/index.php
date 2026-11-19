<?php

declare(strict_types=1);

use App\Config;
use App\Http\Kernel;
use App\Http\Request;

require dirname(__DIR__) . '/bootstrap.php';

$kernel = new Kernel(dirname(__DIR__), Config::fromEnvironment());
$kernel->handle(Request::fromGlobals())->send();
