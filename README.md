# Personal Finance

A simple subscription tracker and expense dashboard, inspired by [Wallos](https://github.com/ellite/wallos). Built with SvelteKit, Drizzle ORM, SQLite, and Google SSO via Auth.js.

## Features

- Sign in with Google (no passwords)
- Track recurring subscriptions (price, billing cycle, next renewal, category)
- Log one-off expenses
- Dashboard with monthly totals, upcoming renewals, and spending by category

## Google OAuth setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and create an OAuth 2.0 Client ID (type: Web application).
2. Authorized redirect URI: `http://localhost:3000/auth/callback/google` (swap the host for your deployed origin in production).
3. Copy the client ID/secret into `.env`.

## Local development

```sh
cp .env.example .env   # fill in AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
npm install
npm run db:migrate
npm run dev
```

Generate a secret for `AUTH_SECRET` with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Database

Schema lives in `src/lib/server/db/schema.ts`. After changing it:

```sh
npm run db:generate   # create a new migration
npm run db:migrate    # apply migrations
npm run db:studio     # browse data
```

## Docker

```sh
cp .env.example .env   # fill in secrets, set ORIGIN to your real origin
docker compose up --build
```

The SQLite database is persisted in the `finance-data` Docker volume. Migrations run automatically on container start.
