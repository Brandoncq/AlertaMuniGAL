# Etapa 1: Compilación de Vite
FROM node:20-alpine AS build

WORKDIR /app

# Copiar paquetes e instalar
COPY package*.json ./
RUN npm install

# Copiar el resto del código
COPY . .

# (Opcional) Si en tu .env usas variables VITE_ algo, 
# asegúrate de pasarlas durante el build o tener el .env al construir.
RUN npm run build

# Etapa 2: Servidor Nginx ultra ligero para producción
FROM nginx:alpine

# Copiar nuestra configuración de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar lo compilado (la carpeta dist) a la ruta pública de Nginx
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
