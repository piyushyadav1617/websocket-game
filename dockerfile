FROM node:18.18.0

WORKDIR /usr/app

COPY . .

RUN npm install

EXPOSE 3000
EXPOSE 8080

ENV NODE_ENV=production

CMD ["npm", "start"]
