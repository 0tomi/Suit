<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('public_files', function (Blueprint $table) {
            $table->id();
            $table->uuid()->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->integer('public_file_catalog_id')->nullable();
            $table->foreign('public_file_catalog_id')->references('id')->on('public_file_catalogs')->nullOnDelete();
            $table->string('name');
            $table->string('path')->unique();
            $table->string('mime_type');
            $table->unsignedBigInteger('size');
            $table->string('hash', 64);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('public_files');
    }
};
