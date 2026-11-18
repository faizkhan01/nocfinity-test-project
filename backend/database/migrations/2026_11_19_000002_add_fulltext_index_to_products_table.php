<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Backs the "database" Scout driver (MATCH ... AGAINST) when Meilisearch is not configured.
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->fullText(['name', 'short_description', 'description'], 'products_search_fulltext');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropFullText('products_search_fulltext');
        });
    }
};
