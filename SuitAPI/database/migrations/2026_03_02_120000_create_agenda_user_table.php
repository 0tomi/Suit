<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agenda_user', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('agenda_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->primary(['user_id', 'agenda_id']);
        });

        DB::table('agendas')
            ->select('id', 'user_id', 'suit_case_id', 'created_at', 'updated_at')
            ->orderBy('id')
            ->get()
            ->each(function ($agenda) {
                $rows = [];

                if ($agenda->user_id) {
                    $rows[] = [
                        'user_id' => $agenda->user_id,
                        'agenda_id' => $agenda->id,
                        'created_at' => $agenda->created_at,
                        'updated_at' => $agenda->updated_at,
                    ];
                }

                if ($agenda->suit_case_id) {
                    $permissions = DB::table('case_permissions')
                        ->where('suit_case_id', $agenda->suit_case_id)
                        ->get(['user_id', 'created_at', 'updated_at']);

                    foreach ($permissions as $permission) {
                        $rows[] = [
                            'user_id' => $permission->user_id,
                            'agenda_id' => $agenda->id,
                            'created_at' => $permission->created_at,
                            'updated_at' => $permission->updated_at,
                        ];
                    }
                }

                if ($rows !== []) {
                    DB::table('agenda_user')->upsert(
                        $rows,
                        ['user_id', 'agenda_id'],
                        ['updated_at']
                    );
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('agenda_user');
    }
};
