FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# SvelteKit imports server modules while analysing the production bundle. Prepare
# a disposable database so importing the DB module has a valid schema. The build
# database remains in this stage and is not copied into the runtime image.
RUN mkdir -p /app/data \
	&& node_modules/.bin/tsx src/lib/server/db/migrate.ts \
	&& npm run build

FROM node:22-slim
WORKDIR /app
RUN useradd -m appuser
COPY --from=build /app/build build
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json package.json
COPY --from=build /app/drizzle drizzle
COPY --from=build /app/src/lib/server/db/migrate.ts migrate.ts
RUN mkdir -p /app/data && chown -R appuser:appuser /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=/app/data/db.sqlite

USER appuser
EXPOSE 3000
CMD ["sh", "-c", "node_modules/.bin/tsx migrate.ts && node build"]
