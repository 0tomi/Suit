<?php

namespace App\Http\Concerns;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

trait ChecksForConflict
{
    /**
     * Check if the client's version of the model is outdated compared to the database.
     * Throws a 409 Conflict if someone else modified the record.
     *
     * @param  \Illuminate\Database\Eloquent\Model  $model
     * @param  Request|array  $data  Can be a Request object or an array of data.
     */
    protected function checkForConflict($model, $data): void
    {
        $lastUpdatedAt = null;

        if ($data instanceof Request && $data->has('last_updated_at')) {
            $lastUpdatedAt = $data->input('last_updated_at');
        } elseif (is_array($data) && array_key_exists('last_updated_at', $data)) {
            $lastUpdatedAt = $data['last_updated_at'];
        }

        if ($lastUpdatedAt) {
            $clientDate = Carbon::parse($lastUpdatedAt);

            // If the database version is newer than the client's version, there's a conflict
            if ($model->updated_at && $model->updated_at->gt($clientDate)) {
                abort(409, 'Conflict: El registro fue modificado por otra persona.');
            }
        }
    }
}
