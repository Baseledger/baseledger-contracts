FROM node:16-alpine

COPY . /usr/src/app

WORKDIR /usr/src/app

RUN npm install --non-interactive --frozen-lockfile

RUN npm run compile

ENTRYPOINT ["npx", "hardhat", "node"]