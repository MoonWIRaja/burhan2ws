FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY turbo.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/database/package*.json ./packages/database/
COPY packages/auth/package*.json ./packages/auth/
COPY packages/whatsapp/package*.json ./packages/whatsapp/

RUN npm install

# Copy source
COPY apps/api ./apps/api
COPY packages ./packages

# Build packages first, then api
RUN npm run build -w @whatsapp-blast/database || true
RUN npm run build -w apps/api || true

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["npm", "run", "start", "-w", "apps/api"]
