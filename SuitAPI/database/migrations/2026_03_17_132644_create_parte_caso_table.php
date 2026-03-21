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
        Schema::create('parte_caso', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parte_id')->constrained('partes')->cascadeOnDelete();
            $table->foreignId('suit_case_id')->constrained('suit_cases')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['parte_id', 'suit_case_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('parte_caso');
    }
};
