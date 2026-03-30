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
        Schema::table('agent_conversations', function (Blueprint $table) {
            $table->longText('current_html')->nullable()->after('title');
            $table->string('last_processed_assistant_message_id', 36)->nullable()->after('current_html');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('agent_conversations', function (Blueprint $table) {
            $table->dropColumn([
                'current_html',
                'last_processed_assistant_message_id',
            ]);
        });
    }
};
