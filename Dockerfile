FROM node:10 AS dapper-ui
WORKDIR /
RUN git clone https://github.com/mdbarr/dapper-ui.git && \
        cd dapper-ui && \
        yarn --silent install && \
        yarn build

FROM node:10-alpine
WORKDIR /dapper
ENV NODE_ENV=production
COPY --from=dapper-ui /dapper-ui/dist dist
COPY package.json yarn.lock ./
RUN yarn --silent install --production=true
COPY . .
EXPOSE 389 636 1812 1389
CMD [ "yarn", "start" ]
