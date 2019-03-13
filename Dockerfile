FROM node:10-alpine

WORKDIR /dapper

COPY package.json yarn.lock ./

ENV NODE_ENV=production

RUN yarn --silent install --production=true

COPY . .

EXPOSE 389 636 1812 1389

CMD [ "yarn", "start" ]
