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
        Schema::table('radicaciones', function (Blueprint $table) {
            $table->renameColumn('nombre_lugar', 'tipo');
        });

        Schema::table('radicaciones', function (Blueprint $table) {
            $table->string('tipo')->unique()->change();
        });

        Schema::table('suit_cases', function (Blueprint $table) {
            $table->foreignId('dependencia_id')->nullable()->constrained('dependencias_judiciales')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('suit_cases', function (Blueprint $table) {
            $table->dropConstrainedForeignId('dependencia_id');
        });

        Schema::table('radicaciones', function (Blueprint $table) {
            $table->renameColumn('tipo', 'nombre_lugar');
        });
    }
};
