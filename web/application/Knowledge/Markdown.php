<?php

declare(strict_types=1);

namespace App\Knowledge;

use League\CommonMark\Environment\Environment;
use League\CommonMark\Extension\CommonMark\CommonMarkCoreExtension;
use League\CommonMark\Extension\CommonMark\Node\Block\Heading;
use League\CommonMark\Extension\CommonMark\Node\Inline\Image;
use League\CommonMark\Extension\DefaultAttributes\DefaultAttributesExtension;
use League\CommonMark\Extension\ExternalLink\ExternalLinkExtension;
use League\CommonMark\Extension\GithubFlavoredMarkdownExtension;
use League\CommonMark\Extension\HeadingPermalink\HeadingPermalinkExtension;
use League\CommonMark\MarkdownConverter;
use League\CommonMark\Node\NodeIterator;
use League\CommonMark\Node\StringContainerHelper;

/**
 * Fra Markdown til HTML som trygt kan vises for kunder.
 *
 * All rå HTML i kilden escapes. Det eneste unntaket er <br>, som ClickUp
 * bruker inne i tabellceller: den byttes mot et merke før tolkingen og
 * settes inn igjen etterpå, så ingen annen HTML slipper gjennom.
 */
final class Markdown
{
    /** Overskriftsnivåene som får anker. Nivå 1 er tittelen og hører ikke hjemme i teksten. */
    private const int MIN_LEVEL = 2;
    private const int MAX_LEVEL = 4;

    /** Nivåene som vises i innholdsfortegnelsen. */
    private const int MAX_TOC_LEVEL = 3;

    /** Et tegn fra Unicodes private område, som ikke forekommer i vanlig tekst. */
    private const string LINE_BREAK = "\u{E000}br\u{E000}";

    private MarkdownConverter $converter;

    public function __construct()
    {
        $environment = new Environment([
            'html_input' => 'escape',
            'allow_unsafe_links' => false,
            'max_nesting_level' => 40,
            'heading_permalink' => [
                'insert' => 'none',
                'apply_id_to_heading' => true,
                'id_prefix' => '',
                'min_heading_level' => self::MIN_LEVEL,
                'max_heading_level' => self::MAX_LEVEL,
            ],
            'slug_normalizer' => [
                'instance' => new AnchorNormalizer(),
            ],
            'table' => [
                'wrap' => [
                    'enabled' => true,
                    'tag' => 'div',
                    'attributes' => ['class' => 'table-wrap'],
                ],
            ],
            'external_link' => [
                'internal_hosts' => [],
            ],
            'default_attributes' => [
                Image::class => ['loading' => 'lazy', 'decoding' => 'async'],
            ],
        ]);
        $environment->addExtension(new CommonMarkCoreExtension());
        $environment->addExtension(new GithubFlavoredMarkdownExtension());
        $environment->addExtension(new HeadingPermalinkExtension());
        $environment->addExtension(new ExternalLinkExtension());
        $environment->addExtension(new DefaultAttributesExtension());

        $this->converter = new MarkdownConverter($environment);
    }

    public function render(string $markdown): Rendered
    {
        $source = preg_replace('/<br\s*\/?>/i', self::LINE_BREAK, $markdown) ?? $markdown;
        $result = $this->converter->convert($source);

        $toc = [];
        foreach ($result->getDocument()->iterator(NodeIterator::FLAG_BLOCKS_ONLY) as $node) {
            if (!$node instanceof Heading || $node->getLevel() > self::MAX_TOC_LEVEL) {
                continue;
            }
            $id = $node->data->get('attributes/id', null);
            $text = trim(str_replace(self::LINE_BREAK, ' ', StringContainerHelper::getChildText($node)));
            if (is_string($id) && $text !== '') {
                $toc[] = ['id' => $id, 'text' => $text, 'level' => $node->getLevel()];
            }
        }

        return new Rendered(str_replace(self::LINE_BREAK, '<br>', $result->getContent()), $toc);
    }
}
