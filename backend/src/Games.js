const { Chess } = require("chess.js");
const { INIT_GAME, MOVE, GAME_OVER } = require("./Messages");

class Game {
    constructor(player1, player2) {
        this.player1 = player1;
        this.player2 = player2;
        this.board = new Chess();
        this.startTime = new Date();
        this.moveCount = 0;
        this.gameOver = false;

        this.player1.send(
            JSON.stringify({
                type: INIT_GAME,
                payload: {
                    color: "white",
                },
            }),
        );
        this.player2.send(
            JSON.stringify({
                type: INIT_GAME,
                payload: {
                    color: "black",
                },
            }),
        );
    }
    endgame(socket) {
        this.gameOver = true
        // check winner and sed to both parites
        const winner = this.player1 === socket ? this.player2 : this.player1
        winner.send(JSON.stringify({
            type : GAME_OVER,
            winner : winner,
            reason : "opponent resigned or left"
        }))
    }

    makeMove(socket, move) {
        if (this.gameOver) {
            return
        }
        // turn enforcement
        if (this.moveCount % 2 === 0 && socket !== this.player1) {
            return;
        }
        if (this.moveCount % 2 === 1 && socket !== this.player2) {
            return;
        }
        if (this.gameOver) {
            return;
        }

        try {
            this.board.move(move);
        } catch (e) {
            console.log(e);
            return;
        }

        if (this.board.isGameOver()) {
            // Send the game over message to both players
            const winner = this.board.turn() === "w" ? "black" : "white";
            this.gameOver = true;
            this.player1.send(
                JSON.stringify({
                    type: GAME_OVER,
                    payload: { winner },
                }),
            );
            this.player2.send(
                JSON.stringify({
                    type: GAME_OVER,
                    payload: { winner },
                }),
            );
            return;
        }

        this.player2.send(
            JSON.stringify({
                type: MOVE,
                payload: move,
                board: this.board.fen(),
            }),
        );
        this.player1.send(
            JSON.stringify({
                type: MOVE,
                payload: move,
                board: this.board.fen(),
            }),
        );
        this.moveCount++;
    }
}

module.exports = { Game };
