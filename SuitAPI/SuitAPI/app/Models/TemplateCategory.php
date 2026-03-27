<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TemplateCategory extends Model
{
    use HasFactory;

    public const DEFAULT_NAME = 'General';

    protected $fillable = ['name', 'description'];

    protected static function booted(): void
    {
        static::deleting(function (TemplateCategory $category): void {
            Tombstone::record(Tombstone::TYPE_TEMPLATE_CATEGORY, $category->id);
            // Cascade: each template delete fires its own booted() deleting event,
            // which creates a tombstone for that template too.
            $category->templates()->each(fn (Template $template) => $template->delete());
        });
    }

    public function templates(): HasMany
    {
        return $this->hasMany(Template::class);
    }

    /**
     * Get a lightweight list of template titles for this category.
     * Returns only id and title.
     */
    public function getLightweightTemplates()
    {
        return $this->templates()
            ->select('id', 'title')
            ->get();
    }

    public function isDefault(): bool
    {
        return $this->name === static::DEFAULT_NAME;
    }

    public static function defaultCategory(): self
    {
        return static::firstOrCreate(
            ['name' => static::DEFAULT_NAME],
            ['description' => 'Categoria general por defecto']
        );
    }
}
