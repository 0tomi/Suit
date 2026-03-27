<?php

namespace App\Enums;

enum DocumentStatus: string
{
    case Borrador = 'Borrador';
    case Firmado = 'Firmado';
    case Presentado = 'Presentado';

    /**
     * Get all as an array.
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
