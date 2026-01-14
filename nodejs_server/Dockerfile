FROM node:18-alpine

WORKDIR /opt/server
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN chown -R node:node /opt/server

USER node
EXPOSE 8080

CMD ["npm", "start"]
