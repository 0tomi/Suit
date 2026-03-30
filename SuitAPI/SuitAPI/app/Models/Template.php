<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Template extends Model
{
    use HasFactory;

    protected $fillable = ['template_category_id', 'title', 'content'];

    protected static function booted(): void
    {
        static::deleting(function (Template $template): void {
            Tombstone::record(Tombstone::TYPE_TEMPLATE, $template->id);
        });
    }

    /**
     * When a template is created/updated/deleted, propagate the timestamp
     * to the parent category so clients can detect catalog changes via last-modified.
     */
    protected $touches = ['category'];

    public function category(): BelongsTo
    {
        return $this->belongsTo(TemplateCategory::class, 'template_category_id');
    }

    /**
     * Get a lightweight list of templates indicating their category.
     * Used for the main catalog catalog caching where content is omitted.
     */
    public static function getLightweightCatalog(): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        return self::select('id', 'title', 'template_category_id')
            ->latest()
            ->paginate(40);
    }

    /**
     * Scope to search templates by title or content.
     */
    public function scopeSearch($query, string $search): void
    {
        $like = config('database.default') === 'pgsql' ? 'ilike' : 'like';

        $query->where(function ($q) use ($search, $like) {
            $q->where('title', $like, "%{$search}%")
                ->orWhere('content', $like, "%{$search}%");
        });
    }

    public function requirements()
    {
        return $this->belongsToMany(Requisito::class, 'plantilla_requisitos', 'template_id', 'requisito_id')
            ->withPivot(['id_campo', 'NEntidad', 'note'])
            ->withTimestamps();
    }
}
