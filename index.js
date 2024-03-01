const http = require("http");
const uuid = require("uuid").v4;
const websocketServer = require("websocket").server;
const httpServer = http.createServer();
const app = require("express")();
app.listen(3000, () => console.log("http express server listening on poprt 3000"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});
const clients = {};
const games = {};
const times = {}

const wsServer = new websocketServer({
  httpServer: httpServer,
});
httpServer.listen("8080", () => console.log("listening on port 8080"));

wsServer.on("request", (request) => {
  const connection = request.accept(null, request.origin);
  connection.on("open", () => console.log("OPENED"));
  connection.on("close", () => {
    console.log("Connection closed for client with ID: " + clientId);
    delete clients[clientId];
    Object.keys(games).forEach((gameId) => {
      const game = games[gameId];
      const clientIndex = game.clients.findIndex(c => c.clientId === clientId);
      if (clientIndex !== -1) {
  
        game.clients.splice(clientIndex, 1);
        if (game.clients.length < 3) {
          console.log(`Game ${gameId} ended due to insufficient players.`);
          if (times[gameId]) {
            clearInterval(times[gameId]);
            delete times[gameId];
          }
          delete games[gameId];
        }
      }
    });
  });
  
  connection.on("message", (message) => {
    const result = JSON.parse(message.utf8Data);
    //I have recieved a message from the client
    //client wants to create a new game
    if (result.method === "create") {
      const clientId = result.clientId;
      const gameId = uuid();
      games[gameId] = {
        id: gameId,
        balls: 20,
        completed: new Set(),
        clients: [],
        state: {},
        finished: false,
        winner: null,
      };
      times[gameId] = {
        finished:false,
        timeId:null
      }
      const payLoad = {
        method: "create",
        game: games[gameId],
      };
      const conn = clients[clientId].connection;
      conn.send(JSON.stringify(payLoad));
    }
    if (result.method === "join") {
      const clientId = result.clientId;
      const gameId = result.gameId;
      const game = games[gameId];
      if (game.clients.length >= 3) {
        // sorry maximum players limit reached
        return;
      }
      const color = { 0: "Red", 1: "Green", 2: "Blue" }[game.clients.length];
      game.clients.push({
        clientId: clientId,
        color: color,
      });
      if (game.clients.length === 3) {
        console.log("game started")
        times[gameId] = setInterval(()=>updateGameState(gameId), 500);
      }
      const payLoad = {
        method: "join",
        game: game,
      };
      //loop through all the clients and tell them a new player has joined.
      game.clients.forEach((c) => {
        const conn = clients[c.clientId].connection;
        console.log(payLoad);
        conn.send(JSON.stringify(payLoad));
      });
    }
    if (result.method === "play") {
      const clientId = result.clientId;
      const gameId = result.gameId;
      const color = result.color;
      const ballId = result.ballId;
      const game = games[gameId];
      game.state[ballId] = { color: color, clientId: clientId };
      game.completed.add(ballId);

      let players = {};
      let winner = null;
      let currWinner = null;
      if (game.completed.size === 20) {
        for (let ballId of Object.keys(game.state)) {
          players[game.state[ballId].color] =
            (players[game.state[ballId].color] || 1) + 1;
          currWinner = game.state[ballId].color;
          if(!winner) winner = currWinner
          winner =
            players[currWinner] > players[winner]
              ? currWinner
              : winner;
        }
        game.finished = true;
        game.winner = winner
      }
    }
  });
  const clientId = uuid();
  clients[clientId] = {
    connection: connection,
  };
  const payLoad = {
    method: "connect",
    clientId: clientId,
  };
  //send back the client connect
  connection.send(JSON.stringify(payLoad));
});

function updateGameState(gameId) {
    let game = games[gameId]
    const payLoad = {
      method: "update",
      game: game,
    };
    game.clients.forEach((c) => {
      clients[c.clientId].connection.send(JSON.stringify(payLoad));
    });
    if(game.finished) return clearInterval(times[gameId])
  }

