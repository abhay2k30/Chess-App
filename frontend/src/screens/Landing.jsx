import { useNavigate } from "react-router-dom";
import chessboard from "../assets/chessboard_1768166350728.gif";
import { Button } from "../components/Button";

export const Landing = () => {
  const navigate = useNavigate();
  return (
    <div className=" bg-[#2b2a28] flex min-h-screen items-center justify-center px-4">
      {/* Section */}
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl">
        {/* Block 1 */}
        <div className="flex flex-col items-center justify-center gap- flex-1">
          <img className="w-72 md:w-96 lg:w-120" src={chessboard} alt="chess-board-gif">
          </img>
        </div>
    
        {/* Block 2 */}
        <div className="flex flex-col items-center justify-center gap-6 flex-1">
          <h1 className="text-4xl font-bold text-white">Simple chess App</h1>
          <Button onClick={() => {
            navigate("/game")
          }}>Play</Button>
        </div>
      </div>
    </div>
  );
}