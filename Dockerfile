FROM node

WORKDIR /opt/kaltura/configure-logs
ADD . ./

RUN npm install

CMD npm start

ARG VERSION
LABEL version=${VERSION}