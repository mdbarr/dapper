FROM node:10-alpine

WORKDIR /extracked

COPY package.json yarn.lock ./

ENV NODE_ENV=production

RUN yarn --silent install --production=true

COPY . .

CMD [ "yarn", "start" ]

