<?php

declare(strict_types=1);

use App\Http\Response;
use App\Pages\PanelPage;

return new class extends PanelPage {
    /** GET / */
    public function execute(): Response
    {
        return $this->html('panel.twig');
    }
};
