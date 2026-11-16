FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY config ./config
RUN npm run build
ENV NODE_ENV=production
EXPOSE 8787
CMD ["npm", "start"]