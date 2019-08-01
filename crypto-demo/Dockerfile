# base image
FROM node:8.12.0-alpine

LABEL author="Yuwei Jiang <releases@macrometa.co>"

ENV TERM=xterm

# The base node image sets a very verbose log level.
ENV NPM_CONFIG_LOGLEVEL warn

RUN apk add --no-cache ca-certificates bash procps

# set working directory
RUN mkdir /app
WORKDIR /app

COPY config config
COPY scripts scripts
COPY public public
COPY src src

# add `/usr/src/app/node_modules/.bin` to $PATH
ENV PATH /app/node_modules/.bin:$PATH

# install and cache app dependencies
COPY package.json /app/package.json
RUN npm install 
# RUN npm install react-scripts@1.1.1 -g --silent

# RUN npm run build --production
# RUN npm install -g serve

EXPOSE 3000

# start app
CMD ["npm", "start"]