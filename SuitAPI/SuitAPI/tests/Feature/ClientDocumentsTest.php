<?php

use App\Models\Client;
use App\Models\Document;
use App\Models\Persona;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('admin can see all documents of a client including triple pagination structure', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $persona = Persona::factory()->create();
    $client = Client::factory()->create(['persona_id' => $persona->id]);

    // 1. Personal Document (created by another user)
    $otherUser = User::factory()->create(['role' => 'lawyer']);
    $personalDoc = Document::factory()->create(['user_id' => $otherUser->id, 'suit_case_id' => null, 'name' => 'Personal Doc']);
    $client->documents()->attach($personalDoc->id);

    // 2. Case Document
    $case = SuitCase::factory()->create(['lawyer_id' => $otherUser->id, 'title' => 'Case Alpha', 'status' => 'active']);
    $case->clients()->attach($client->id);
    $caseDoc = Document::factory()->create(['suit_case_id' => $case->id, 'name' => 'Case Doc', 'user_id' => $otherUser->id]);

    $response = $this->actingAs($admin)->getJson("/api/clients/{$client->id}/documents");

    $response->assertStatus(200)
        ->assertJsonStructure([
            'personales' => ['data', 'links', 'meta'],
            'por_casos' => [
                'data',
                'links',
                'meta',
            ],
        ])
        ->assertJsonCount(1, 'personales.data')
        ->assertJsonFragment(['name' => 'Personal Doc'])
        ->assertJsonFragment(['nombre' => 'Case Alpha'])
        // Check nesting and data structure of documents inside cases
        ->assertJsonPath('por_casos.data.0.documentos.data.0.name', 'Case Doc');
});

test('lawyer can only see personal documents they own', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $otherLawyer = User::factory()->create(['role' => 'lawyer']);

    $persona = Persona::factory()->create();
    $client = Client::factory()->create(['persona_id' => $persona->id]);

    // My personal doc
    $myPersonalDoc = Document::factory()->create(['user_id' => $lawyer->id, 'suit_case_id' => null, 'name' => 'My Doc']);
    $client->documents()->attach($myPersonalDoc->id);

    // Other lawyer's personal doc linked to same client
    $otherPersonalDoc = Document::factory()->create(['user_id' => $otherLawyer->id, 'suit_case_id' => null, 'name' => 'Other Doc']);
    $client->documents()->attach($otherPersonalDoc->id);

    $response = $this->actingAs($lawyer)->getJson("/api/clients/{$client->id}/documents");

    $response->assertStatus(200)
        ->assertJsonCount(1, 'personales.data')
        ->assertJsonFragment(['name' => 'My Doc'])
        ->assertJsonMissing(['name' => 'Other Doc']);
});

test('lawyer can only see cases and their documents they participate in', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $otherLawyer = User::factory()->create(['role' => 'lawyer']);

    $persona = Persona::factory()->create();
    $client = Client::factory()->create(['persona_id' => $persona->id]);

    // Case I own
    $myCase = SuitCase::factory()->create(['lawyer_id' => $lawyer->id, 'title' => 'My Case']);
    $myCase->clients()->attach($client->id);
    Document::factory()->create(['suit_case_id' => $myCase->id, 'name' => 'My Case Doc', 'user_id' => $lawyer->id]);

    // Case I don't participate in
    $otherCase = SuitCase::factory()->create(['lawyer_id' => $otherLawyer->id, 'title' => 'Other Case']);
    $otherCase->clients()->attach($client->id);
    Document::factory()->create(['suit_case_id' => $otherCase->id, 'name' => 'Other Case Doc', 'user_id' => $otherLawyer->id]);

    $response = $this->actingAs($lawyer)->getJson("/api/clients/{$client->id}/documents");

    $response->assertStatus(200)
        ->assertJsonCount(1, 'por_casos.data')
        ->assertJsonFragment(['nombre' => 'My Case'])
        ->assertJsonMissing(['nombre' => 'Other Case']);
});

test('triple pagination works with custom page parameters', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $persona = Persona::factory()->create();
    $client = Client::factory()->create(['persona_id' => $persona->id]);

    // Create 20 personal docs (page 1 should have 15, page 2 should have 5)
    Document::factory()->count(20)->create(['suit_case_id' => null, 'user_id' => $admin->id])->each(function ($doc) use ($client) {
        $client->documents()->attach($doc->id);
    });

    // Create 10 cases (page 1 should have 5, page 2 should have 5)
    SuitCase::factory()->count(10)->create(['lawyer_id' => $admin->id])->each(function ($case) use ($client, $admin) {
        $client->cases()->attach($case->id);
        // Create 10 docs for each case (page 1 of docs should have 5, page 2 should have 5)
        Document::factory()->count(10)->create(['suit_case_id' => $case->id, 'user_id' => $admin->id]);
    });

    // Test page 2 of personal docs
    $response = $this->actingAs($admin)->getJson("/api/clients/{$client->id}/documents?page_personal=2");
    $response->assertStatus(200)
        ->assertJsonPath('personales.meta.current_page', 2)
        ->assertJsonCount(5, 'personales.data');

    // Test page 2 of cases
    $response = $this->actingAs($admin)->getJson("/api/clients/{$client->id}/documents?page_cases=2");
    $response->assertStatus(200)
        ->assertJsonPath('por_casos.meta.current_page', 2)
        ->assertJsonCount(5, 'por_casos.data');

    // Test page 2 of documents within cases
    $response = $this->actingAs($admin)->getJson("/api/clients/{$client->id}/documents?page_case_docs=2");
    $response->assertStatus(200)
        ->assertJsonPath('por_casos.data.0.documentos.meta.current_page', 2)
        ->assertJsonCount(5, 'por_casos.data.0.documentos.data');
});

test('can list clients associated to a document', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $persona = Persona::factory()->create(['first_name' => 'Test', 'last_name' => 'Client']);
    $client = Client::factory()->create(['persona_id' => $persona->id]);
    $document = Document::factory()->create(['name' => 'Doc Test']);

    $document->clients()->attach($client->id);

    $response = $this->actingAs($admin)->getJson("/api/documents/{$document->id}/clients");

    $response->assertStatus(200)
        ->assertJsonCount(1)
        ->assertJsonFragment(['first_name' => 'Test', 'last_name' => 'Client']);
});
