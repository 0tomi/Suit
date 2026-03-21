<?php

namespace App\Providers;

use App\Models\EventType;
use App\Models\TemplateCategory;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::define('case-write', function ($user, $resource) {
            $suitCase = ($resource instanceof \App\Models\SuitCase)
                ? $resource
                : ($resource->suitCase ?? null);

            if ($suitCase) {
                return Gate::allows('update', $suitCase);
            }

            // If no case is associated, it's a personal resource.
            // Allow if user is owner or admin.
            return (($resource->user_id ?? null) === $user->id) || Gate::allows('admin');
        });

        Gate::before(function ($user, string $ability, array $arguments = []) {
            if (($user->role ?? null) !== 'admin') {
                return null;
            }

            // Preserve business invariants even for admins.
            if (in_array($ability, ['rename', 'delete']) && ($arguments[0] ?? null) instanceof EventType) {
                return null;
            }

            if (in_array($ability, ['update', 'delete']) && ($arguments[0] ?? null) instanceof TemplateCategory) {
                return null;
            }
            if (($arguments[0] ?? null) instanceof \App\Models\PublicFileCatalog) {
                return null;
            }

            return true;
        });
    }
}
