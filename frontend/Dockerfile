# Criação: Node 20+ (obrigatório para o Vite 7)
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./

# Sem lockfile no frontend; instala direto das ranges.
RUN npm install

COPY . .

# URL da API injetada no build (default: localhost).
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Runtime: só os estáticos com fallback de SPA (react-router).
FROM node:20-alpine

WORKDIR /app

COPY --from=build /app/dist ./dist

# Serve incluído na imagem (sem rede no runtime).
RUN npm install -g serve

EXPOSE 5137

CMD ["serve", "-s", "dist", "-l", "5137"]