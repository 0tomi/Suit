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
        Schema::create('dependencias_judiciales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('jurisdiccion_id')->constrained('jurisdicciones')->onDelete('cascade');
            $table->foreignId('competencia_id')->constrained('competencias')->onDelete('cascade');
            $table->string('nombre_juzgado');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dependencias_judiciales');
    }
};
