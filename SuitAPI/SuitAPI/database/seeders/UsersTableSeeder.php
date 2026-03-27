<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class UsersTableSeeder extends Seeder
{
    /**
     * Auto generated seed file
     *
     * @return void
     */
    public function run()
    {

        \DB::table('users')->delete();

        \DB::table('users')->insert([
            0 => [
                'id' => 1,
                'name' => 'user',
                'email' => 'user@example.com',
                'email_verified_at' => null,
                'password' => '$2y$12$OaLAxk6oGXYLbvO/O8qMTuJ9V2exeModDlWFJXwORYdNMK0X7YPeS',
                'remember_token' => null,
                'created_at' => '2026-02-05 00:20:31',
                'updated_at' => '2026-02-05 00:20:31',
                'role' => 'lawyer',
                'tag' => 'user',
                'last_name' => null,
                'profile_photo_path' => null,
                'deleted_at' => null,
            ],
            1 => [
                'id' => 2,
                'name' => 'admin',
                'email' => 'admin@example.com',
                'email_verified_at' => null,
                'password' => '$2y$12$r2r7r4D8Fig3Zmuut99cqO0RRWSZXAkZnyg/EJRspYpCQhvWVMmxi',
                'remember_token' => null,
                'created_at' => '2026-02-05 00:20:46',
                'updated_at' => '2026-02-05 00:20:46',
                'role' => 'admin',
                'tag' => 'admin',
                'last_name' => null,
                'profile_photo_path' => null,
                'deleted_at' => null,
            ],
            2 => [
                'id' => 3,
                'name' => 'Jazmin Kuhlman',
                'email' => 'curl_test@example.com',
                'email_verified_at' => '2026-02-12 20:05:46',
                'password' => '$2y$12$jnZ0nz9UZ4Pvytw/YMBWg.1QZZ424iAxm1ExGOSBoZXOewbEyWb6e',
                'remember_token' => 'neN02A4vGs',
                'created_at' => '2026-02-12 20:05:46',
                'updated_at' => '2026-02-12 20:05:46',
                'role' => 'lawyer',
                'tag' => '#PPMY1287',
                'last_name' => null,
                'profile_photo_path' => null,
                'deleted_at' => null,
            ],
            3 => [
                'id' => 4,
                'name' => 'Test User',
                'email' => 'test@example.com',
                'email_verified_at' => null,
                'password' => '$2y$12$IGYcO0KtmiXfHHkk54/D.OA7EYL5HQir5lhWJq/Gc0PJV0DTg63Mm',
                'remember_token' => null,
                'created_at' => '2026-02-26 19:29:59',
                'updated_at' => '2026-03-02 19:22:42',
                'role' => 'lawyer',
                'tag' => 'test',
                'last_name' => null,
                'profile_photo_path' => null,
                'deleted_at' => null,
            ],
            4 => [
                'id' => 5,
                'name' => 'Caesar Stehr',
                'email' => 'langworth.katelyn@example.com',
                'email_verified_at' => '2026-03-05 10:00:00',
                'password' => '$2y$12$GrtUlixclD/QyCyzQWI/vOYqPlEcFTsMiCRyXzu4.U0Je.Couj/GG',
                'remember_token' => 'ERCbek4m30',
                'created_at' => '2026-03-05 10:00:00',
                'updated_at' => '2026-03-05 10:00:00',
                'role' => 'user',
                'tag' => '#ZEQB9949',
                'last_name' => null,
                'profile_photo_path' => null,
                'deleted_at' => null,
            ],
            5 => [
                'id' => 6,
                'name' => 'Missouri Cummerata',
                'email' => 'dwest@example.net',
                'email_verified_at' => '2026-03-05 10:00:00',
                'password' => '$2y$12$NcRWZU7t7lIIlVbjA8En5uoRJTU3tru7/jNYNbAf8I.ZLvuQz1XwO',
                'remember_token' => 'FkW93XXATn',
                'created_at' => '2026-03-05 10:00:00',
                'updated_at' => '2026-03-05 10:00:00',
                'role' => 'user',
                'tag' => '#LIIE4376',
                'last_name' => null,
                'profile_photo_path' => null,
                'deleted_at' => null,
            ],
            6 => [
                'id' => 7,
                'name' => 'Bernardo Swift DVM',
                'email' => 'brath@example.net',
                'email_verified_at' => '2026-03-05 10:00:00',
                'password' => '$2y$12$QIg1D2PDFDDKZVpHI542JORgsPzSYMNcuhyvsKa/LT23FcdVVthOq',
                'remember_token' => '6hoq1cCbbR',
                'created_at' => '2026-03-05 10:00:00',
                'updated_at' => '2026-03-05 10:00:00',
                'role' => 'user',
                'tag' => '#GEEC4443',
                'last_name' => null,
                'profile_photo_path' => null,
                'deleted_at' => null,
            ],
        ]);

        // Reset PostgreSQL sequence to max id
        if (\Illuminate\Support\Facades\DB::getDriverName() === 'pgsql') {
            \Illuminate\Support\Facades\DB::statement("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))");
        }

    }
}
