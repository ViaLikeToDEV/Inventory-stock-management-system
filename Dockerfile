FROM php:8.3-cli

RUN apt-get update && apt-get install -y \
    git curl zip unzip \
    libpng-dev libonig-dev libzip-dev libsqlite3-dev \
    && curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN docker-php-ext-install pdo pdo_sqlite mbstring bcmath gd zip pcntl

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN composer install --no-scripts --no-autoloader --prefer-dist

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN composer dump-autoload --optimize

RUN mkdir -p database storage/framework/{sessions,views,cache} storage/logs bootstrap/cache \
    && touch database/database.sqlite \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000 5173

ENTRYPOINT ["/entrypoint.sh"]
