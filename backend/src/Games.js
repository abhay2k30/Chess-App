const { Chess, Move } = require("chess.js");
const { INIT_GAME, MOVE, GAME_OVER, ERROR } = require("./Messages");

class Game {
    constructor(socket1,socket2) {
        this.gameID = crypto.randomUUID()
        this.player1Id = socket1.userID
        this.player2Id = socket2.userID
        this.board = new Chess();
        // this.startTime = new Date(); // have't figured out how to implement timer
        this.moveCount = 0;
        this.gameOver = false;
        socket1.send(
            JSON.stringify({
                type: INIT_GAME,
                payload: {
                    color: "white",
                },
            }),
        );
        socket2.send(
            JSON.stringify({
                type: INIT_GAME,
                payload: {
                    color: "black",
                },
            }),
        );
    }
    endgame(userID) {
        this.gameOver = true
        // check winner and send to both parites
        const winner = userID === "draw" ? "draw" : this.player1Id === userID ? "black" : "white";
        return {
            type : GAME_OVER,
            winner : winner
         }
    }

    makeMove(socket, move) {
        if (this.gameOver) {
            return {
                type : ERROR
            }
        }
        // turn enforcement
        if (this.moveCount % 2 === 0 && socket.userID !== this.player1Id) {
            return {
                type : ERROR
            };
        }
        if (this.moveCount % 2 === 1 && socket.userID !== this.player2Id) {
            return {
                type : ERROR
            };
        }

        try {
            this.board.move(move);
        } catch (e) {
            console.log(e);
            return {
                type : ERROR
            };
        }
        this.moveCount++

        if (this.board.isGameOver()) {
            this.gameOver = true;
            const winner = this.board.isDraw() ? "draw" : this.player1Id === socket.userID ? "white" : "black";
            return {
                type : GAME_OVER,
                winner : winner
            };
        }
        return {
            type : MOVE,
            move : move,
            board : this.board.fen()
        };
    }
}

module.exports = { Game };
