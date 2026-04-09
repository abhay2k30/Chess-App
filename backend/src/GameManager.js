const { Game } = require("./Games");
const { GAME_OVER, ERROR, INIT_GAME, MOVE, RESIGN, REJOIN, DRAW_OFFER, DRAW_RESPONSE } = require("./Messages");

class GameManager {
    constructor() {
        this.userIDGameIdMap = {};
        this.userIdSocketMap = {};
        this.gameIDGameMap = {};
        this.userIDTimerMap = {}
        this.pendingUser = null;
    }

    getActiveGame(socket) {
        try {
            const activeGameId = this.userIDGameIdMap[socket.userID]
            if (typeof activeGameId === "undefined") {
                return;
            }
            const activeGame = this.gameIDGameMap[activeGameId]
            if (typeof activeGame === "undefined") {
                return;
            }
            return activeGame;
        } catch (err) {
            console.error("Error finding active game:", err);
            return;
        }
    }

    handleDisconnect(socket) {
        const userID = socket.userID;
        if (this.userIdSocketMap[userID] !== socket) {
            return;
        }
        if (this.pendingUser?.userID === userID) {
            this.pendingUser = null;
            this.removeUser(socket);
            return
        }
        const timer = setTimeout(() => {
            const activeGame = this.getActiveGame(socket);
            if (activeGame) {
                const result = activeGame.endgame(socket.userID); // pass userID instead of socekt object.
                const ws1 = this.userIdSocketMap[activeGame.player1Id];
                const ws2 = this.userIdSocketMap[activeGame.player2Id];
                if (ws1) ws1.send(JSON.stringify(result));
                if (ws2) ws2.send(JSON.stringify(result));
            }
            this.removeUser(socket);
        }, 15000);
        this.userIDTimerMap[userID] = timer;
    }

    addUser(socket) {
        const userID = socket.userID;
        clearTimeout(this.userIDTimerMap[userID]);
        delete this.userIDTimerMap[userID];
        this.userIdSocketMap[userID] = socket;
        this.rejoinHandler(socket);
        this.addHandler(socket);
    }
    removeUser(socket) {
        const userID = socket.userID;
        const activeGame = this.getActiveGame(socket);

        if (activeGame) {
            delete this.userIDGameIdMap[activeGame.player1Id];
            delete this.userIDGameIdMap[activeGame.player2Id];
            delete this.gameIDGameMap[activeGame.gameID];
        }

        // Only remove the socket from tracking if it is no longer open.
        // If the socket is still OPEN (e.g. game ended but player hasn't navigated away),
        // we keep it so they can immediately queue for a new match and still receive messages.
        const WS_OPEN = 1; // WebSocket.OPEN
        if (socket.readyState !== WS_OPEN) {
            delete this.userIdSocketMap[userID];
        }
        delete this.userIDTimerMap[userID];
    }

    addHandler(socket) {
        socket.on("message", (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === INIT_GAME) {
                const activeGame = this.getActiveGame(socket);
                if (activeGame) {
                    return;
                }
                if (this.pendingUser) {
                    if (this.pendingUser.userID === socket.userID) {
                        // Update their pending socket to the new one, but don't start a game
                        this.pendingUser = socket;
                        return;
                    }
                    const game = new Game(this.pendingUser, socket);
                    this.gameIDGameMap[game.gameID] = game;
                    this.userIDGameIdMap[socket.userID] = game.gameID
                    this.userIDGameIdMap[this.pendingUser.userID] = game.gameID
                    this.pendingUser = null;
                } else {
                    this.pendingUser = socket;
                }
            }

            const activeGame = this.getActiveGame(socket);
            if (!activeGame) {
                    return;
                }

                if (message.type === MOVE) {
                    const result = activeGame.makeMove(socket, message.move);
                    const ws1 = this.userIdSocketMap[activeGame.player1Id];
                    const ws2 = this.userIdSocketMap[activeGame.player2Id];

                    switch (result.type) {
                        case MOVE:
                            if (ws1) ws1.send(JSON.stringify({
                                type: MOVE,
                                move: result.move,
                                board: result.board
                            }));
                            if (ws2) ws2.send(JSON.stringify({
                                type: MOVE,
                                move: result.move,
                                board: result.board
                            }));
                            break;
                        case GAME_OVER:
                            if (ws1) ws1.send(JSON.stringify({
                                type: GAME_OVER,
                                winner: result.winner
                            }));
                            if (ws2) ws2.send(JSON.stringify({
                                type: GAME_OVER,
                                winner: result.winner
                            }));
                            this.removeUser(socket)
                            break;
                        case ERROR:
                            // send aomething to client too
                            // something as simple as , "can't mak the move"
                            break;
                    }
                }
                if (message.type === RESIGN) {
                    const result = activeGame.endgame(socket.userID);
                    const ws1 = this.userIdSocketMap[activeGame.player1Id];
                    const ws2 = this.userIdSocketMap[activeGame.player2Id];
                    if (ws1) ws1.send(JSON.stringify(result));
                    if (ws2) ws2.send(JSON.stringify(result));
                    this.removeUser(socket);
                }
                if (message.type === DRAW_OFFER) {
                    activeGame.drawOffer = socket.userID;
                    const opponentId = activeGame.player1Id === socket.userID ? activeGame.player2Id : activeGame.player1Id;
                    const opponentSocket = this.userIdSocketMap[opponentId];
                    if (opponentSocket) opponentSocket.send(JSON.stringify({ type: DRAW_OFFER }));
                }

                if (message.type === DRAW_RESPONSE) {
                    if (activeGame.drawOffer === null) return;

                    if (message.accepted) {
                        const result = activeGame.endgame("draw");
                        const ws1 = this.userIdSocketMap[activeGame.player1Id];
                        const ws2 = this.userIdSocketMap[activeGame.player2Id];
                        if (ws1) ws1.send(JSON.stringify(result));
                        if (ws2) ws2.send(JSON.stringify(result));
                        this.removeUser(socket);
                    } else {
                        const offererSocket = this.userIdSocketMap[activeGame.drawOffer];
                        activeGame.drawOffer = null;
                        if (offererSocket) offererSocket.send(JSON.stringify({ type: DRAW_RESPONSE, accepted: false }));
                    }
                }
            });
    }

    rejoinHandler(socket) {
        const activeGame = this.getActiveGame(socket);
        if (!activeGame) {
            return;
        }
        const gameState = activeGame.board.fen()
        socket.send(JSON.stringify({
            type: REJOIN,
            board: gameState,
            color: socket.userID === activeGame.player1Id ? "white" : "black"
        }))
    }
}

module.exports = {
    GameManager,
};
