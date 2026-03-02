import { Button } from "../components/Button";
import { Chessboard } from "react-chessboard";
import { useSocket } from "../hooks/websocketHook";
import { useEffect, useState } from "react";
import messages from "../helpers/messages";
import MovesCard from "../components/MoveCard";

export const Game = () => {
  const socket = useSocket(null);
  const [running, setRunning] = useState(false);
  const [chessPosition, setChessPosition] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [ move , setMove ] = useState([])
  useEffect(() => {
    if (!socket) {
      return;
    }
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log(message)
      switch (message.type) {
        case messages.INIT_GAME:
          setRunning(true);
          break;
        case messages.MOVE:
          setChessPosition(message.board);
          setChessPosition(message.board);
          setMove(prev => [...prev, message.payload]);
          break;
        case messages.GAME_OVER:
          setRunning(false);
          break;
      }
    };
  },[socket]);
  
  return (
    <div className=" bg-[#2b2a28] flex min-h-screen items-center justify-center px-4">
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl">
        <div className="flex flex-col items-center justify-center gap- flex-1">
          <Chessboard options={{ position: chessPosition }}></Chessboard>
        </div>
        {!running ? (
          <Button onClick={() => socket?.send(JSON.stringify({ type: messages.INIT_GAME }))}>
            Play
          </Button>
        ) : (
          <MovesCard moves={move} players={{ white: "You", black: "Opponent" }} />
        )}
      </div>
    </div>
  );
};
