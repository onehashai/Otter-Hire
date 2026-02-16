FROM node:20-alpine

WORKDIR /app/apps/web

COPY apps/web/package.json apps/web/package-lock.json ./
COPY packages/ui /app/packages/ui

RUN npm install

COPY apps/web ./

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
