<?php

declare(strict_types=1);

namespace App;

use InvalidArgumentException;

/**
 * Offentlige ID-er: to bokstaver som sier hva ID-en er, og 128 tilfeldige
 * bit i zbase32. Det numeriske id-feltet forlater aldri serveren.
 *
 *   kd dokument · kp passasje · co samtale · me melding · ru kjøring · us bruker
 */
final class Uid
{
    private const string ALPHABET = 'ybndrfg8ejkmcpqxot1uwisza345h769';

    public static function new(string $prefix): string
    {
        if (preg_match('/^[a-z]{2}$/', $prefix) !== 1) {
            throw new InvalidArgumentException('Prefikset må være to små bokstaver.');
        }

        return $prefix . self::encode(random_bytes(16));
    }

    /**
     * 16 byte blir 26 tegn: 128 bit fylt opp til 130, fem bit per tegn.
     */
    private static function encode(string $bytes): string
    {
        $bits = '';
        foreach (str_split($bytes) as $byte) {
            $bits .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
        }

        $encoded = '';
        foreach (str_split(str_pad($bits, 130, '0'), 5) as $chunk) {
            $encoded .= self::ALPHABET[(int) bindec($chunk)];
        }

        return $encoded;
    }
}
