<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $defaultEventTypeId = DB::table('event_types')->where('name', 'Otro')->value('id');

        if (! $defaultEventTypeId) {
            $defaultEventTypeId = DB::table('event_types')->insertGetId([
                'name' => 'Otro',
                'color' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        Schema::create('events', function (Blueprint $table) use ($defaultEventTypeId) {
            $table->id();
            $table->foreignId('agenda_id')->constrained()->cascadeOnDelete();
            $table->foreignId('suit_case_id')->nullable()->constrained('suit_cases')->cascadeOnDelete();
            $table->foreignId('event_type_id')->default($defaultEventTypeId)->constrained('event_types')->restrictOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->dateTime('starts_at');
            $table->boolean('is_all_day')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('events');
    }
};
