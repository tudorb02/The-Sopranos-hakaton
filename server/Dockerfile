FROM node:24-alpine
WORKDIR /app/server
COPY server/package.json ./
RUN npm install --include=dev --no-audit --no-fund
COPY server/ ./
COPY api/node-openapi.yaml /app/api/node-openapi.yaml
COPY frontend/src/lib/api.js /app/frontend/src/lib/api.js
COPY frontend/src/lib/forms.js /app/frontend/src/lib/forms.js
COPY frontend/package.json /app/frontend/package.json
ENV NODE_ENV=production PORT=3001
EXPOSE 3001
CMD ["npm", "start"]
