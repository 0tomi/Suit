<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class AgendaUserTableSeeder extends Seeder
{
    /**
     * Auto generated seed file
     *
     * @return void
     */
    public function run()
    {

        \DB::table('agenda_user')->delete();

        \DB::table('agenda_user')->insert([
            0 => [
                'user_id' => 1,
                'agenda_id' => 1,
                'created_at' => '2026-02-05 00:20:31',
                'updated_at' => '2026-02-05 00:20:31',
            ],
            1 => [
                'user_id' => 2,
                'agenda_id' => 2,
                'created_at' => '2026-02-05 00:20:46',
                'updated_at' => '2026-02-05 00:20:46',
            ],
            2 => [
                'user_id' => 1,
                'agenda_id' => 3,
                'created_at' => '2026-02-05 00:46:07',
                'updated_at' => '2026-02-05 00:46:07',
            ],
            3 => [
                'user_id' => 4,
                'agenda_id' => 4,
                'created_at' => '2026-02-26 19:39:46',
                'updated_at' => '2026-02-26 19:39:46',
            ],
            4 => [
                'user_id' => 1,
                'agenda_id' => 5,
                'created_at' => '2026-03-02 18:05:55',
                'updated_at' => '2026-03-02 18:05:55',
            ],
            5 => [
                'user_id' => 1,
                'agenda_id' => 6,
                'created_at' => '2026-03-02 18:26:17',
                'updated_at' => '2026-03-02 18:26:17',
            ],
            6 => [
                'user_id' => 1,
                'agenda_id' => 7,
                'created_at' => '2026-03-02 18:27:03',
                'updated_at' => '2026-03-02 18:27:03',
            ],
            7 => [
                'user_id' => 1,
                'agenda_id' => 8,
                'created_at' => '2026-03-02 18:29:01',
                'updated_at' => '2026-03-02 18:29:01',
            ],
            8 => [
                'user_id' => 1,
                'agenda_id' => 9,
                'created_at' => '2026-03-02 18:30:55',
                'updated_at' => '2026-03-02 18:30:55',
            ],
            9 => [
                'user_id' => 1,
                'agenda_id' => 10,
                'created_at' => '2026-03-02 18:33:14',
                'updated_at' => '2026-03-02 18:33:14',
            ],
            10 => [
                'user_id' => 1,
                'agenda_id' => 11,
                'created_at' => '2026-03-02 18:41:22',
                'updated_at' => '2026-03-02 18:41:22',
            ],
            11 => [
                'user_id' => 1,
                'agenda_id' => 12,
                'created_at' => '2026-03-02 18:43:16',
                'updated_at' => '2026-03-02 18:43:16',
            ],
            12 => [
                'user_id' => 1,
                'agenda_id' => 13,
                'created_at' => '2026-03-02 18:45:18',
                'updated_at' => '2026-03-02 18:45:18',
            ],
            13 => [
                'user_id' => 4,
                'agenda_id' => 14,
                'created_at' => '2026-03-02 19:24:59',
                'updated_at' => '2026-03-02 19:24:59',
            ],
            14 => [
                'user_id' => 4,
                'agenda_id' => 15,
                'created_at' => '2026-03-02 19:31:12',
                'updated_at' => '2026-03-02 19:31:12',
            ],
            15 => [
                'user_id' => 4,
                'agenda_id' => 16,
                'created_at' => '2026-03-02 19:32:39',
                'updated_at' => '2026-03-02 19:32:39',
            ],
            16 => [
                'user_id' => 4,
                'agenda_id' => 17,
                'created_at' => '2026-03-02 19:34:53',
                'updated_at' => '2026-03-02 19:34:53',
            ],
            17 => [
                'user_id' => 4,
                'agenda_id' => 18,
                'created_at' => '2026-03-02 19:37:40',
                'updated_at' => '2026-03-02 19:37:40',
            ],
            18 => [
                'user_id' => 4,
                'agenda_id' => 19,
                'created_at' => '2026-03-02 19:38:36',
                'updated_at' => '2026-03-02 19:38:36',
            ],
            19 => [
                'user_id' => 4,
                'agenda_id' => 20,
                'created_at' => '2026-03-02 19:40:28',
                'updated_at' => '2026-03-02 19:40:28',
            ],
            20 => [
                'user_id' => 1,
                'agenda_id' => 21,
                'created_at' => '2026-03-02 19:59:02',
                'updated_at' => '2026-03-02 19:59:02',
            ],
            21 => [
                'user_id' => 4,
                'agenda_id' => 22,
                'created_at' => '2026-03-02 20:06:23',
                'updated_at' => '2026-03-02 20:06:23',
            ],
            22 => [
                'user_id' => 4,
                'agenda_id' => 23,
                'created_at' => '2026-03-02 20:08:19',
                'updated_at' => '2026-03-02 20:08:19',
            ],
            23 => [
                'user_id' => 4,
                'agenda_id' => 24,
                'created_at' => '2026-03-02 20:56:49',
                'updated_at' => '2026-03-02 20:56:49',
            ],
            24 => [
                'user_id' => 1,
                'agenda_id' => 25,
                'created_at' => '2026-03-03 00:08:22',
                'updated_at' => '2026-03-03 00:08:22',
            ],
            25 => [
                'user_id' => 1,
                'agenda_id' => 26,
                'created_at' => '2026-03-04 21:52:09',
                'updated_at' => '2026-03-04 21:52:09',
            ],
            26 => [
                'user_id' => 4,
                'agenda_id' => 27,
                'created_at' => '2026-03-05 18:40:41',
                'updated_at' => '2026-03-05 18:40:41',
            ],
            27 => [
                'user_id' => 4,
                'agenda_id' => 28,
                'created_at' => '2026-03-05 19:15:07',
                'updated_at' => '2026-03-05 19:15:07',
            ],
            28 => [
                'user_id' => 5,
                'agenda_id' => 29,
                'created_at' => '2026-03-05 10:00:00',
                'updated_at' => '2026-03-05 10:00:00',
            ],
            29 => [
                'user_id' => 6,
                'agenda_id' => 30,
                'created_at' => '2026-03-05 10:00:00',
                'updated_at' => '2026-03-05 10:00:00',
            ],
            30 => [
                'user_id' => 7,
                'agenda_id' => 31,
                'created_at' => '2026-03-05 10:00:00',
                'updated_at' => '2026-03-05 10:00:00',
            ],
            31 => [
                'user_id' => 4,
                'agenda_id' => 32,
                'created_at' => '2026-03-05 21:57:15',
                'updated_at' => '2026-03-05 21:57:15',
            ],
            32 => [
                'user_id' => 4,
                'agenda_id' => 33,
                'created_at' => '2026-03-05 21:59:08',
                'updated_at' => '2026-03-05 21:59:08',
            ],
            33 => [
                'user_id' => 4,
                'agenda_id' => 34,
                'created_at' => '2026-03-05 21:59:56',
                'updated_at' => '2026-03-05 21:59:56',
            ],
            34 => [
                'user_id' => 4,
                'agenda_id' => 35,
                'created_at' => '2026-03-06 18:42:38',
                'updated_at' => '2026-03-06 18:42:38',
            ],
            35 => [
                'user_id' => 4,
                'agenda_id' => 36,
                'created_at' => '2026-03-06 18:49:34',
                'updated_at' => '2026-03-06 18:49:34',
            ],
            36 => [
                'user_id' => 4,
                'agenda_id' => 37,
                'created_at' => '2026-03-06 18:53:18',
                'updated_at' => '2026-03-06 18:53:18',
            ],
            37 => [
                'user_id' => 4,
                'agenda_id' => 38,
                'created_at' => '2026-03-06 19:01:35',
                'updated_at' => '2026-03-06 19:01:35',
            ],
            38 => [
                'user_id' => 4,
                'agenda_id' => 39,
                'created_at' => '2026-03-06 19:05:20',
                'updated_at' => '2026-03-06 19:05:20',
            ],
            39 => [
                'user_id' => 4,
                'agenda_id' => 40,
                'created_at' => '2026-03-06 19:12:15',
                'updated_at' => '2026-03-06 19:12:15',
            ],
            40 => [
                'user_id' => 4,
                'agenda_id' => 41,
                'created_at' => '2026-03-06 19:20:11',
                'updated_at' => '2026-03-06 19:20:11',
            ],
            41 => [
                'user_id' => 4,
                'agenda_id' => 42,
                'created_at' => '2026-03-06 19:26:36',
                'updated_at' => '2026-03-06 19:26:36',
            ],
            42 => [
                'user_id' => 4,
                'agenda_id' => 43,
                'created_at' => '2026-03-06 19:31:05',
                'updated_at' => '2026-03-06 19:31:05',
            ],
            43 => [
                'user_id' => 4,
                'agenda_id' => 44,
                'created_at' => '2026-03-06 20:50:21',
                'updated_at' => '2026-03-06 20:50:21',
            ],
            44 => [
                'user_id' => 4,
                'agenda_id' => 45,
                'created_at' => '2026-03-06 21:18:33',
                'updated_at' => '2026-03-06 21:18:33',
            ],
            45 => [
                'user_id' => 4,
                'agenda_id' => 46,
                'created_at' => '2026-03-06 21:20:27',
                'updated_at' => '2026-03-06 21:20:27',
            ],
            46 => [
                'user_id' => 4,
                'agenda_id' => 47,
                'created_at' => '2026-03-06 21:21:27',
                'updated_at' => '2026-03-06 21:21:27',
            ],
            47 => [
                'user_id' => 4,
                'agenda_id' => 48,
                'created_at' => '2026-03-06 21:32:15',
                'updated_at' => '2026-03-06 21:32:15',
            ],
        ]);

        // Reset PostgreSQL sequence to max id
        if (\Illuminate\Support\Facades\DB::getDriverName() === 'pgsql') {
            \Illuminate\Support\Facades\DB::statement("SELECT setval(pg_get_serial_sequence('agenda_user', 'id'), COALESCE((SELECT MAX(id) FROM agenda_user), 1))");
        }

    }
}
