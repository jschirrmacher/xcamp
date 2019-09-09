FROM node:dubnium-alpine

RUN mkdir /app
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs && chown nodejs.nodejs /app
USER nodejs

WORKDIR /app

ADD package*.json /app/
ADD src /app/src
ADD public /app/public
RUN npm install --production

EXPOSE 3000
CMD node src/xcamp.js

