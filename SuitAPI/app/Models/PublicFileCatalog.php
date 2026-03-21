<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PublicFileCatalog extends Model
{
    protected $fillable = [
        'name',
        'description',
    ];

    public function publicFiles()
    {
        return $this->hasMany(PublicFile::class);
    }

    protected static function booted(): void
    {
        static::deleting(function (PublicFileCatalog $catalog) {
            $generalCatalog = self::where('name', 'General')->first();

            if ($generalCatalog && $catalog->id !== $generalCatalog->id) {
                $catalog->publicFiles()->update([
                    'public_file_catalog_id' => $generalCatalog->id,
                ]);
            }
        });
    }
}
