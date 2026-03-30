<?php

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'admin']);
    $this->lawyer = User::factory()->create(['role' => 'lawyer']);
});

test('admin can see ai settings with key existence flags', function () {
    Setting::setAiApiKey('gemini', 'secret-key-123');
    Setting::setAiActiveConfig('gemini', 'gemini-2.0-flash');

    $response = $this->actingAs($this->admin)->getJson('/api/ai/settings');

    $response->assertStatus(200)
        ->assertJson([
            'active_provider' => 'gemini',
            'active_model' => 'gemini-2.0-flash',
            'has_gemini_key' => true,
            'has_openai_key' => false,
        ]);
});

test('non-admin cannot see ai settings', function () {
    $response = $this->actingAs($this->lawyer)->getJson('/api/ai/settings');
    $response->assertStatus(403);
});

test('admin can update active provider and model', function () {
    $response = $this->actingAs($this->admin)->putJson('/api/ai/settings', [
        'active_provider' => 'openai',
        'active_model' => 'gpt-4o',
    ]);

    $response->assertStatus(200);
    expect(Setting::getAiActiveProvider())->toBe('openai');
    expect(Setting::getAiActiveModel())->toBe('gpt-4o');
});

test('admin can save encrypted api keys', function () {
    $response = $this->actingAs($this->admin)->putJson('/api/ai/settings', [
        'openai_key' => 'sk-test-12345',
    ]);

    $response->assertStatus(200);
    expect(Setting::getAiApiKey('openai'))->toBe('sk-test-12345');

    // Check raw DB to ensure it is encrypted
    $raw = Setting::query()->where('key', 'ai_openai_key')->first();
    expect($raw->value)->not->toBe('sk-test-12345');
});

test('example', function () {
    $response = $this->get('/');

    $response->assertStatus(200);
});
