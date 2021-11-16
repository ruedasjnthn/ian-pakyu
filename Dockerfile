FROM node:latest

WORKDIR /app
COPY ./package.json /app/
COPY . /app
RUN npm i

CMD node gateway.js
