<?php

namespace Tests\Feature;

use App\Models\CaseType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CaseTypeTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_list_case_types()
    {
        $user = User::factory()->create();
        CaseType::create(['name' => 'Civil']);
        CaseType::create(['name' => 'Penal']);

        $response = $this->actingAs($user)->getJson('/api/case-types');

        $response->assertStatus(200)
            ->assertJsonCount(2);
    }

    public function test_can_create_case_type()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $response = $this->actingAs($admin)->postJson('/api/case-types', [
            'name' => 'Laboral',
            'description' => 'Casos de trabajo',
        ]);

        $response->assertStatus(201)
            ->assertJsonFragment(['name' => 'Laboral']);

        $this->assertDatabaseHas('case_types', ['name' => 'Laboral']);
    }

    public function test_non_admin_cannot_create_case_type()
    {
        $user = User::factory()->create(['role' => 'user']);

        $this->actingAs($user)->postJson('/api/case-types', [
            'name' => 'Laboral',
            'description' => 'Casos de trabajo',
        ])->assertForbidden();
    }

    public function test_can_delete_case_type()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $type = CaseType::create(['name' => 'Borrar']);

        $response = $this->actingAs($admin)->deleteJson("/api/case-types/{$type->id}");

        $response->assertStatus(204);
        $this->assertDatabaseMissing('case_types', ['id' => $type->id]);
    }

    public function test_non_admin_cannot_delete_case_type()
    {
        $user = User::factory()->create(['role' => 'user']);
        $type = CaseType::create(['name' => 'Borrar']);

        $this->actingAs($user)
            ->deleteJson("/api/case-types/{$type->id}")
            ->assertForbidden();
    }
}
