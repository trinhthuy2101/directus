FROM node:alpine

WORKDIR /app

ADD . /app

VOLUME ./dist

RUN cd /app/hook && npm install && npm run build
RUN cd /app/endpoints && npm install && npm run build
