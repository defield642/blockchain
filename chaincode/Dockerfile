FROM node:18-alpine

WORKDIR /usr/src/chaincode

COPY package.json ./

# Install production dependencies for chaincode runtime
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 9999

CMD ["/bin/sh", "-c", "./node_modules/.bin/fabric-chaincode-node server --chaincode-address ${CHAINCODE_SERVER_ADDRESS} --chaincode-id ${CORE_CHAINCODE_ID_NAME}"]
