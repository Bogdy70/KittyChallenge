FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
COPY public ./public
RUN mkdir -p data config && chown -R node:node /app
USER node
EXPOSE 3001
CMD ["node", "server/index.mjs"]
