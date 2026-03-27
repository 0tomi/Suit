<?php

namespace App\Traits;

use Illuminate\Http\Request;
use Illuminate\Routing\Exceptions\InvalidSignatureException;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

trait HandlesManualSignatures
{
    /**
     * Create a manual signed URL that is host-agnostic.
     */
    protected function createManualSignedUrl(string $routeName, int $expirationMinutes, array $params = []): string
    {
        $params['expires'] = now()->addMinutes($expirationMinutes)->timestamp;

        // Ensure params are sorted by key to have a consistent signature
        ksort($params);

        // Generate signature based on route name and parameters (excluding host/root)
        $signature = $this->calculateManualSignature($routeName, $params);

        $params['signature'] = $signature;

        return URL::route($routeName, $params);
    }

    /**
     * Validate the manual signature from the request.
     *
     * @param  string|null  $routeName  If null, will try to get from current route
     *
     * @throws InvalidSignatureException
     */
    protected function validateManualSignature(Request $request, ?string $routeName = null): void
    {
        $routeName = $routeName ?? $request->route()->getName();
        $params = array_merge($request->route()->parameters(), $request->query());

        if (! isset($params['expires']) || ! isset($params['signature'])) {
            throw new InvalidSignatureException;
        }

        $signature = $params['signature'];
        unset($params['signature']);
        unset($params['confirmed']);

        // Verify expiration
        if (now()->timestamp > (int) $params['expires']) {
            throw new InvalidSignatureException;
        }

        // Verify signature
        $expectedSignature = $this->calculateManualSignature($routeName, $params);

        if (! hash_equals($expectedSignature, $signature)) {
            throw new InvalidSignatureException;
        }
    }

    /**
     * Calculate hash for signing.
     */
    private function calculateManualSignature(string $routeName, array $params): string
    {
        ksort($params);

        // Use http_build_query to treat all values as strings (host-agnostic and type-safe)
        $data = $routeName.'|'.http_build_query($params);

        $key = config('app.key');
        if (Str::startsWith($key, 'base64:')) {
            $key = base64_decode(substr($key, 7));
        }

        return hash_hmac('sha256', $data, $key);
    }
}
