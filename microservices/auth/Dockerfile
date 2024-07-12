FROM node:lts-alpine

WORKDIR /app
COPY ./package.json /app/
COPY . /app
RUN npm i

CMD cd ./ && node index.js
