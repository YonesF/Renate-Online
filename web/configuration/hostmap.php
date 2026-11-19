<?php

declare(strict_types=1);

// Host-header → nettsted. En vert som ikke står her, får 400.
// Bare agent kan vises i en ramme, og bare av nettstedene i frame_ancestors.
// «panel» er adressen til Lenas panel for nettsteder som viser det.
// Produksjonsvertene (hjelp.creativeart.no osv.) legges til ved lansering.

return [
    'hjelp.localhost' => [
        'site' => 'hjelp',
        'panel' => 'http://agent.localhost:8080',
    ],
    'agent.localhost' => [
        'site' => 'agent',
        'framed' => true,
        'frame_ancestors' => ['http://hjelp.localhost:8080'],
    ],
    'admin.localhost' => [
        'site' => 'admin',
    ],
];
