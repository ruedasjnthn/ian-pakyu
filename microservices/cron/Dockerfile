FROM node:lts-alpine

WORKDIR /app
COPY ./package.json /app/
COPY . /app
RUN npm i
# RUN mkdir -p /var/tmp

# ENV TemDir=/var/tmp

CMD node cron-start.js
