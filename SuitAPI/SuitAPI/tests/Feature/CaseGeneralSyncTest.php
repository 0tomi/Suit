<?php

use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

test('syncDown returns cases modified since date for admin', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $case1 = SuitCase::factory()->create(['updated_at' => Carbon::now()->subDays(10)]);
    $case2 = SuitCase::factory()->create(['updated_at' => Carbon::now()->subDays(1)]);

    $since = Carbon::now()->subDays(5)->format('Y-m-d H:i:s');

    $response = $this->actingAs($admin)->getJson("/api/suit-cases/sync?since={$since}");

    $response->assertOk();
    $response->assertJsonCount(1);
    $response->assertJsonPath('data.0.id', $case2->id);
});

test('syncDown returns only owned/participating cases for lawyer', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $otherLawyer = User::factory()->create(['role' => 'lawyer']);

    $ownedCase = SuitCase::factory()->create(['lawyer_id' => $lawyer->id, 'updated_at' => Carbon::now()]);
    $participatingCase = SuitCase::factory()->create(['updated_at' => Carbon::now()]);
    $participatingCase->participants()->attach($lawyer->id, ['permission_level' => 'edit']);

    // Explicitly touch to ensure updated_at is fresh
    $ownedCase->touch();
    $participatingCase->touch();

    $otherCase = SuitCase::factory()->create(['lawyer_id' => $otherLawyer->id, 'updated_at' => Carbon::now()]);

    $since = Carbon::now()->subDays(1)->format('Y-m-d H:i:s');

    $response = $this->actingAs($lawyer)->getJson("/api/suit-cases/sync?since={$since}");

    $response->assertOk();
    $response->assertJsonCount(2, 'data');

    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($ownedCase->id);
    expect($ids)->toContain($participatingCase->id);
    expect($ids)->not->toContain($otherCase->id);
});

test('syncDown includes soft-deleted cases', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $case = SuitCase::factory()->create(['updated_at' => Carbon::now()]);
    $case->delete(); // Soft delete

    $since = Carbon::now()->subDays(1)->format('Y-m-d H:i:s');

    $response = $this->actingAs($admin)->getJson("/api/suit-cases/sync?since={$since}");

    $response->assertOk();
    $response->assertJsonCount(1);
    expect($response->json('data.0.deleted_at'))->not->toBeNull();
});

test('syncDown requires auth', function () {
    $response = $this->getJson('/api/suit-cases/sync?since=2024-01-01');
    $response->assertUnauthorized();
});

test('syncDown validates since parameter', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $response = $this->actingAs($user)->getJson('/api/suit-cases/sync?since=invalid-date');
    $response->assertUnprocessable();
});
