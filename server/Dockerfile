FROM node:18

WORKDIR /home/nodejsesp8266/app

COPY package*.json ./

RUN npm install

COPY . .

# EXPOSE 4200

RUN npm run build

CMD ["npm", "start"]
