<?php

namespace Database\Seeders;

use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\File;
use App\Models\Multimedia;
use App\Models\SuitCase;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CaseAttachmentsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $cases = SuitCase::all();

        foreach ($cases as $case) {
            // Create 2 documents for each case
            Document::factory()->count(2)->create([
                'suit_case_id' => $case->id,
                'user_id' => $case->lawyer_id,
            ])->each(function ($document) use ($case) {
                // Create a version for each document
                DocumentVersion::create([
                    'document_id' => $document->id,
                    'version_number' => 1,
                    'file_path' => 'documents/'.Str::uuid().'.pdf',
                    'mime_type' => 'application/pdf',
                    'size' => rand(1000, 5000000),
                    'encryption_iv' => base64_encode(random_bytes(16)),
                    'checksum' => hash('sha256', 'fake-document-content'),
                    'created_by' => $case->lawyer_id,
                ]);
            });

            // Create 2 multimedia files for each case
            Multimedia::factory()->count(2)->create([
                'suit_case_id' => $case->id,
                'user_id' => $case->lawyer_id,
                'filename' => 'video_test_'.rand(100, 999).'.mp4',
                'mime_type' => 'video/mp4',
            ]);

            // Create 2 general files for each case
            File::factory()->count(2)->create([
                'suit_case_id' => $case->id,
                'user_id' => $case->lawyer_id,
                'filename' => 'file_test_'.rand(100, 999).'.pdf',
                'mime_type' => 'application/pdf',
            ]);
        }
    }
}
