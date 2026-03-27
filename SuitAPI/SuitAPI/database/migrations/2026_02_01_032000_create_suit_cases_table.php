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
        Schema::create('suit_cases', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->foreignId('lawyer_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('case_type_id')->nullable()->constrained('case_types')->onDelete('set null');
            $table->string('nro_expediente');
            $table->foreignId('radicacion_id')->constrained('radicaciones');
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->text('details')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('suit_cases');
    }
};
