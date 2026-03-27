<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class forceJsonResponse
{
    /**
     * Force the Accept header to application/json on API requests.
     *
     * This ensures Laravel always returns JSON error responses (422, 401, etc.)
     * instead of redirecting to HTML pages, without affecting binary responses
     * like file downloads which are determined by the controller, not this header.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $request->headers->set('Accept', 'application/json');

        return $next($request);
    }
}
