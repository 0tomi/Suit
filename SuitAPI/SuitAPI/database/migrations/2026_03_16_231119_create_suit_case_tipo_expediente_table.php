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
        Schema::create('suit_case_tipo_expediente', function (Blueprint $table) {
            $table->foreignId('suit_case_id')->constrained('suit_cases')->cascadeOnDelete();
            $table->foreignId('tipo_expediente_id')->constrained('tipo_expedientes')->cascadeOnDelete();
            $table->timestamps();

            $table->primary(['suit_case_id', 'tipo_expediente_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('suit_case_tipo_expediente');
    }
};
