<?php

use App\Http\Controllers\Api\V1\Admin;
use App\Http\Controllers\Api\V1\Auth\CustomerAuthController;
use App\Http\Controllers\Api\V1\Auth\CustomerProfileController;
use App\Http\Controllers\Api\V1\Auth\EmailVerificationController;
use App\Http\Controllers\Api\V1\Auth\PasswordResetController;
use App\Http\Controllers\Api\V1\Auth\StaffAuthController;
use App\Http\Controllers\Api\V1\Storefront;
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

    // Catalog (public)
    Route::get('categories', [Storefront\CategoryController::class, 'index'])->name('categories.index');
    Route::get('products', [Storefront\ProductController::class, 'index'])->name('products.index');
    Route::get('products/filters', [Storefront\ProductController::class, 'filters'])->name('products.filters');
    Route::get('products/{slug}', [Storefront\ProductController::class, 'show'])->name('products.show');
    Route::get('products/{slug}/related', [Storefront\ProductController::class, 'related'])->name('products.related');
    Route::get('products/{slug}/reviews', [Storefront\ReviewController::class, 'index'])->name('products.reviews.index');
    Route::get('reviews/featured', [Storefront\ReviewController::class, 'featured'])->name('reviews.featured');
    Route::post('products/{slug}/reviews', [Storefront\ReviewController::class, 'store'])
        ->middleware(['auth:customer', 'active'])->name('products.reviews.store');

    // Cart (guest via X-Cart-Token, or signed-in customer)
    Route::prefix('cart')->name('cart.')->group(function () {
        Route::get('/', [Storefront\CartController::class, 'show'])->name('show');
        Route::post('items', [Storefront\CartController::class, 'addItem'])->name('items.store');
        Route::patch('items/{item}', [Storefront\CartController::class, 'updateItem'])->whereNumber('item')->name('items.update');
        Route::delete('items/{item}', [Storefront\CartController::class, 'removeItem'])->whereNumber('item')->name('items.destroy');
        Route::post('coupon', [Storefront\CartController::class, 'applyCoupon'])->name('coupon.store');
        Route::delete('coupon', [Storefront\CartController::class, 'removeCoupon'])->name('coupon.destroy');
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

            Route::get('permissions', [Admin\RoleController::class, 'permissions'])->middleware('permission:roles.view')->name('permissions.index');
            Route::get('roles', [Admin\RoleController::class, 'index'])->middleware('permission:roles.view|staff.view')->name('roles.index');
            Route::post('roles', [Admin\RoleController::class, 'store'])->middleware('permission:roles.manage')->name('roles.store');
            Route::put('roles/{role}', [Admin\RoleController::class, 'update'])->middleware('permission:roles.manage')->name('roles.update');
            Route::delete('roles/{role}', [Admin\RoleController::class, 'destroy'])->middleware('permission:roles.manage')->name('roles.destroy');

            Route::get('staff', [Admin\StaffController::class, 'index'])->middleware('permission:staff.view')->name('staff.index');
            Route::get('staff/{staff}', [Admin\StaffController::class, 'show'])->middleware('permission:staff.view')->name('staff.show');
            Route::post('staff', [Admin\StaffController::class, 'store'])->middleware('permission:staff.manage')->name('staff.store');
            Route::put('staff/{staff}', [Admin\StaffController::class, 'update'])->middleware('permission:staff.manage')->name('staff.update');
            Route::delete('staff/{staff}', [Admin\StaffController::class, 'destroy'])->middleware('permission:staff.manage')->name('staff.destroy');

            Route::get('activity-logs', [Admin\ActivityLogController::class, 'index'])->middleware('permission:activity_logs.view')->name('activity-logs.index');
        });
    });
});
