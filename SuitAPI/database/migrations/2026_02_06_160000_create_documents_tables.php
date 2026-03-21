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
        // Documents Table
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade'); // Owner
            $table->foreignId('suit_case_id')->nullable()->constrained('suit_cases')->onDelete('cascade');
            $table->foreignId('event_id')->nullable()->constrained('events')->onDelete('set null');

            // Locking mechanism
            $table->boolean('is_locked')->default(false);
            $table->foreignId('locked_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('locked_at')->nullable();

            $table->string('category')->default('General');
            $table->timestamps();
            $table->softDeletes();
        });

        // Document Versions Table
        Schema::create('document_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('documents')->onDelete('cascade');
            $table->integer('version_number');

            // File details
            $table->string('file_path'); // Stores the UUID filename relative to storage root
            $table->string('mime_type');
            $table->unsignedBigInteger('size'); // In bytes

            // Security
            $table->string('encryption_iv'); // IV for AES-256-CBC
            $table->string('checksum'); // SHA-256 hash of the original file

            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();

            // Unique constraint on document + version
            $table->unique(['document_id', 'version_number']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('document_versions');
        Schema::dropIfExists('documents');
    }
};
