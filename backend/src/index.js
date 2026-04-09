const { WebSocketServer } = require('ws');
const { GameManager } = require('./GameManager');

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });
console.log(`WebSocket server listening on port ${PORT}`);

const gameManager = new GameManager();

wss.on('connection', function connection(ws, req) {
    const url = new URL(req.url, 'https://localhost')
    const userID = url.searchParams.get("guestId");
    if (!userID) {
        ws.send(JSON.stringify({ type: "error", message: "no guest id provided" }));
        ws.close();
        return; // CRITICAL: Stop execution here
    }
    ws.userID = userID;
    gameManager.addUser(ws);
    ws.on("close", () => {
        gameManager.handleDisconnect(ws)
    });
})
