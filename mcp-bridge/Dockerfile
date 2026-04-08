FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY index.js ./
COPY claude-legacy-wrapper.js ./
COPY multi-backend-wrapper.js ./
COPY smoke-test.mjs ./
COPY e2e-test.mjs ./

EXPOSE 4100

CMD ["node", "index.js"]
