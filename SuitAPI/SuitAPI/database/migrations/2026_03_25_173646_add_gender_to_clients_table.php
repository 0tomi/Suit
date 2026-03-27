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
        Schema::table('clients', function (Blueprint $table) {
            if (! Schema::hasColumn('clients', 'gender')) {
                $table->enum('gender', ['M', 'F', 'X'])->default('X');
            }
        });

        // After setting default for existing records, we can remove the default if we want strictly non-nullable without default
        // But for sync purposes often a default is fine or we just let it be.
        // The user said "The gender cannot be nullable", so default 'X' is a good compromise for existing ones.
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            if (Schema::hasColumn('clients', 'gender')) {
                $table->dropColumn('gender');
            }
        });
    }
};
