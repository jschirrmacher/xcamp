FROM node:dubnium-alpine

RUN mkdir /app && addgroup -S nodejs && adduser -S nodejs -G nodejs && chown nodejs.nodejs /app
USER nodejs

WORKDIR /app

ADD package*.json /app/
RUN npm install --production
ADD src /app/src
ADD public /app/public

EXPOSE 3000
CMD node src/xcamp.js

