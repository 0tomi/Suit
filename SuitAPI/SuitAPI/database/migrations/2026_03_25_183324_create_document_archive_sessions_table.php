<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_archive_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('documents')->cascadeOnDelete();
            // Path to the directory holding the temporarily extracted version files
            $table->string('extracted_path');
            // Path to the encrypted .arch file that was extracted
            $table->string('archive_path');
            // Datetime until which the extracted files should remain on disk
            $table->dateTime('keep_until');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_archive_sessions');
    }
};
