FROM node:20-alpine as base
WORKDIR /usr/src/app

COPY ./rpi-server/package*.json ./

# Install build dependencies for rpio
RUN apk add --no-cache python3 py3-pip make build-base

# Install all dependencies
RUN npm install

COPY ./rpi-server ./

EXPOSE 8080