<?php

declare(strict_types=1);

// Pakkene ligger i /opt/vendor i containeren (se Dockerfile), ellers i vendor/.
$vendor = getenv('COMPOSER_VENDOR_DIR');
if (!is_string($vendor) || !is_file($vendor . '/autoload.php')) {
    $vendor = __DIR__ . '/vendor';
}

require $vendor . '/autoload.php';
