FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY *.js ./

EXPOSE 4000

CMD ["node", "index.js"]
