<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EventType extends Model
{
    use HasFactory;

    public const DEFAULT_NAME = 'Otro';

    protected $fillable = ['name', 'color'];

    public function isDefault(): bool
    {
        return $this->name === static::DEFAULT_NAME;
    }

    public static function defaultType(): self
    {
        return static::firstOrCreate(
            ['name' => static::DEFAULT_NAME],
            ['color' => null]
        );
    }

    public function events()
    {
        return $this->hasMany(Event::class);
    }
}
