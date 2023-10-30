FROM node:20-alpine as base
WORKDIR /usr/src/app

COPY rpi-server/package*.json ./

# Install all dependencies
RUN npm install

COPY rpi-server .

FROM base as production
ENV NODE_PATH=./dist
RUN npm run build

EXPOSE 8080