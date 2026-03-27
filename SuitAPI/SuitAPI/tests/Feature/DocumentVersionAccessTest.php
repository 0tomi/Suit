<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentVersionAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_can_access_previous_versions_of_a_document()
    {
        $user = User::factory()->create();

        // 1. Create document (Version 1)
        $content1 = '<h1>Versión 1</h1>';
        $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Documento de Prueba',
            'content' => $content1,
        ])->assertStatus(201);

        $document = Document::first();

        // 2. Edit document (Version 2)
        $content2 = '<h1>Versión 2</h1>';
        $this->actingAs($user)->putJson("/api/documents/{$document->id}", [
            'content' => $content2,
        ])->assertStatus(201);

        // 3. Edit document (Version 3)
        $content3 = '<h1>Versión 3</h1>';
        $this->actingAs($user)->putJson("/api/documents/{$document->id}", [
            'content' => $content3,
        ])->assertStatus(201);

        // 4. Edit document (Version 4)
        $content4 = '<h1>Versión 4</h1>';
        $this->actingAs($user)->putJson("/api/documents/{$document->id}", [
            'content' => $content4,
        ])->assertStatus(201);

        // Verify there are 4 versions
        $this->assertEquals(4, $document->versions()->count());

        // 5. Try to access Version 1
        $response1 = $this->actingAs($user)->get("/api/documents/{$document->id}/versions/1");
        $response1->assertStatus(200);
        $response1->assertHeader('Content-Type', 'text/html; charset=utf-8');
        $this->assertEquals($content1, $response1->getContent());

        // 6. Try to access Version 2
        $response2 = $this->actingAs($user)->get("/api/documents/{$document->id}/versions/2");
        $response2->assertStatus(200);
        $this->assertEquals($content2, $response2->getContent());

        // 7. Try to access Version 3
        $response3 = $this->actingAs($user)->get("/api/documents/{$document->id}/versions/3");
        $response3->assertStatus(200);
        $this->assertEquals($content3, $response3->getContent());

        // 8. Try to access Version 4 (latest)
        $response4 = $this->actingAs($user)->get("/api/documents/{$document->id}/versions/4");
        $response4->assertStatus(200);
        $this->assertEquals($content4, $response4->getContent());

        // 9. Try to access non-existent version 5
        $this->actingAs($user)->get("/api/documents/{$document->id}/versions/5")
            ->assertStatus(404);
    }
}
