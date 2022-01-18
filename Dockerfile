FROM node:latest

WORKDIR /app
COPY ./package.json /app/
COPY . /app
RUN npm i
EXPOSE 80
CMD node gateway.js
