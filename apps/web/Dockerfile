FROM node:20-alpine

WORKDIR /app

COPY packages/ui/package.json packages/ui/package-lock.json* ./packages/ui/
RUN cd packages/ui && npm install

COPY apps/web/package.json apps/web/package-lock.json* ./apps/web/
RUN cd apps/web && npm install

COPY packages/ui ./packages/ui
COPY apps/web ./apps/web

WORKDIR /app/apps/web

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
