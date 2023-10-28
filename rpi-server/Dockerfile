FROM node:20-alpine as base
WORKDIR /usr/src/app

COPY package*.json ./

# Install all dependencies
RUN npm install

COPY . .

FROM base as production
ENV NODE_PATH=./dist
RUN npm run build

EXPOSE 8080