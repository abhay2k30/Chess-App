const { Game } = require("./Games");
const { INIT_GAME, MOVE, RESIGN } = require("./Messages");

class GameManager {
    constructor() {
        this.games = [];
        this.pendingUser = null;
        this.users = [];
    }

    addUser(socket) {
        this.users.push(socket);
        this.addHandler(socket);
    }
    
    handleresign(socket) {
        const game = this.games.find(
            (game) => game.player1 === socket || game.player2 === socket,
        );
        if (game) {
            game.endgame(socket)
        }
        this.removeUser(socket)
    }

    // TODO : very heay code repition , fix later.
    removeUser(socket) {
        this.users = this.users.filter((user) => user !== socket);
        // Find the game the user was in and remove it
        this.games = this.games.filter(
            (game) => game.player1 !== socket && game.player2 !== socket,
        );
    }

    addHandler(socket) {
        socket.on("message", (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === INIT_GAME) {
                if (this.pendingUser) {
                    const game = new Game(this.pendingUser, socket);
                    this.games.push(game);
                    this.pendingUser = null;
                } else {
                    this.pendingUser = socket;
                }
            }

            const game = this.games.find(
                (game) => game.player1 === socket || game.player2 === socket,
            );

            if (message.type === MOVE) {
                if (game) {
                    game.makeMove(socket, message.move);
                }
            }
        });
    }
}

module.exports = {
    GameManager,
};
