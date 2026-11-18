<?php

use App\Http\Controllers\Api\V1\Admin;
use App\Http\Controllers\Api\V1\Auth\CustomerAuthController;
use App\Http\Controllers\Api\V1\Auth\CustomerProfileController;
use App\Http\Controllers\Api\V1\Auth\EmailVerificationController;
use App\Http\Controllers\Api\V1\Auth\PasswordResetController;
use App\Http\Controllers\Api\V1\Auth\StaffAuthController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->middleware('throttle:api')->group(function () {

    // Customer authentication
    Route::prefix('auth')->name('auth.')->group(function () {
        Route::middleware('throttle:auth')->group(function () {
            Route::post('register', [CustomerAuthController::class, 'register'])->name('register');
            Route::post('login', [CustomerAuthController::class, 'login'])->name('login');
            Route::post('forgot-password', [PasswordResetController::class, 'sendLink'])->name('password.email');
            Route::post('reset-password', [PasswordResetController::class, 'reset'])->name('password.reset');
        });

        Route::get('email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
            ->middleware(['signed', 'throttle:auth'])->name('verification.verify');

        Route::middleware(['auth:customer', 'active'])->group(function () {
            Route::get('me', [CustomerAuthController::class, 'me'])->name('me');
            Route::post('logout', [CustomerAuthController::class, 'logout'])->name('logout');
            Route::post('email/resend', [EmailVerificationController::class, 'resend'])
                ->middleware('throttle:auth')->name('verification.send');
            Route::put('profile', [CustomerProfileController::class, 'update'])->name('profile.update');
            Route::put('password', [CustomerProfileController::class, 'password'])->name('password.update');
        });
    });

    // Admin panel
    Route::prefix('admin')->name('admin.')->group(function () {
        Route::prefix('auth')->name('auth.')->group(function () {
            Route::middleware('throttle:auth')->group(function () {
                Route::post('login', [StaffAuthController::class, 'login'])->name('login');
                Route::post('forgot-password', [PasswordResetController::class, 'sendLink'])->name('password.email');
                Route::post('reset-password', [PasswordResetController::class, 'reset'])->name('password.reset');
            });

            Route::middleware(['auth:admin', 'active'])->group(function () {
                Route::get('me', [StaffAuthController::class, 'me'])->name('me');
                Route::post('logout', [StaffAuthController::class, 'logout'])->name('logout');
            });
        });

        Route::middleware(['auth:admin', 'active'])->group(function () {
            Route::put('profile', [Admin\ProfileController::class, 'update'])->name('profile.update');
            Route::put('profile/password', [Admin\ProfileController::class, 'password'])->name('profile.password');
        });
    });
});
