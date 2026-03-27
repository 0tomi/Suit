<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tombstones', function (Blueprint $table) {
            $table->id();
            $table->string('resource_type');
            $table->unsignedBigInteger('resource_id');
            $table->timestamp('deleted_at');

            $table->index(['resource_type', 'deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tombstones');
    }
};
