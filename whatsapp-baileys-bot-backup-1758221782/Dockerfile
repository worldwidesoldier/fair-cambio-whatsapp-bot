# Fair Câmbio Multi-Branch WhatsApp Bot
# Dockerfile for production deployment

FROM node:18-alpine

# Instala dependências do sistema necessárias
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Configura Puppeteer para usar o Chromium instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Define variáveis de ambiente
ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo

# Cria usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S whatsapp -u 1001

# Define diretório de trabalho
WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./

# Instala dependências
RUN npm ci --only=production && npm cache clean --force

# Copia código fonte
COPY --chown=whatsapp:nodejs . .

# Cria estrutura de diretórios necessária
RUN mkdir -p logs sessions data && \
    mkdir -p logs/branches sessions/matriz sessions/shopping-manauara sessions/amazonas-shopping sessions/ponta-negra sessions/aeroporto && \
    mkdir -p data/matriz data/shopping-manauara data/amazonas-shopping data/ponta-negra data/aeroporto && \
    chown -R whatsapp:nodejs logs sessions data

# Instala PM2 globalmente
RUN npm install -g pm2

# Cria script de saúde para Docker
COPY --chown=whatsapp:nodejs docker/healthcheck.js /app/healthcheck.js

# Define usuário não-root
USER whatsapp

# Expõe portas (API de monitoramento)
EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node /app/healthcheck.js || exit 1

# Comando padrão - inicia todas as filiais
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]