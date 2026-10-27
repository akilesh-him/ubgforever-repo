FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.mjs server-origins.mjs ai-service.mjs ./
COPY index.html sw.js ./
COPY js ./js
COPY css ./css
COPY img ./img
COPY apps ./apps
COPY links ./links
COPY game-pictures ./game-pictures
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
