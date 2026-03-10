# Development only — uses `next dev` with hot reload via bind-mounted source.
# For production use Dockerfile.prod.
FROM node:20-alpine

WORKDIR /app

COPY packages/ui/package.json packages/ui/package-lock.json* ./packages/ui/
RUN cd packages/ui && npm install

COPY apps/web/package.json apps/web/package-lock.json* ./apps/web/
RUN cd apps/web && npm install

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
