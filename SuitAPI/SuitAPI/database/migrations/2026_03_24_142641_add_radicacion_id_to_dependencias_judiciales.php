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
        Schema::table('dependencias_judiciales', function (Blueprint $table) {
            $table->foreignId('radicacion_id')->nullable()->constrained('radicaciones')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dependencias_judiciales', function (Blueprint $table) {
            $table->dropConstrainedForeignId('radicacion_id');
        });
    }
};
