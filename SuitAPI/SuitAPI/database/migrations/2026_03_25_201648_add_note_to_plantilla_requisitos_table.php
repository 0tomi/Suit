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
        Schema::table('plantilla_requisitos', function (Blueprint $table) {
            $table->string('note')->nullable()->after('NEntidad');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('plantilla_requisitos', function (Blueprint $table) {
            $table->dropColumn('note');
        });
    }
};
