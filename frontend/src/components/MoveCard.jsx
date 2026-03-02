import { useEffect, useRef } from "react";

const MovesCard = ({ moves = [], players = { white: "Player 1", black: "Player 2" } }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves]);

  // Group moves into pairs [[w1, b1], [w2, b2], ...]
  const movePairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push([moves[i], moves[i + 1] ?? null]);
  }

  const isWhiteTurn = moves.length % 2 === 0;

  return (
    <div className="w-56 bg-[#262421] rounded-xl border border-[#3d3a37] flex flex-col overflow-hidden shadow-2xl">

      {/* Header - Players */}
      <div className="bg-[#1e1c1a] px-4 py-3 border-b border-[#3d3a37]">
        {/* Black player */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 rounded-sm bg-[#1a1a1a] border-2 border-[#555] flex-shrink-0" />
          <span className="text-[#d9d7d5] text-sm font-semibold truncate">{players.black}</span>
          <span className="text-[#7c7875] text-xs ml-auto">Black</span>
        </div>
        <div className="text-center text-[#7c7875] text-xs italic my-1">vs</div>
        {/* White player */}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-[#f0d9b5] border-2 border-[#b58863] flex-shrink-0" />
          <span className="text-[#d9d7d5] text-sm font-semibold truncate">{players.white}</span>
          <span className="text-[#7c7875] text-xs ml-auto">White</span>
        </div>
      </div>

      {/* Moves List */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-[200px] max-h-[340px] py-1"
        style={{ scrollbarColor: "#3d3a37 transparent", scrollbarWidth: "thin" }}
      >
        {movePairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-10 gap-2">
            <span className="text-4xl opacity-20">♟</span>
            <p className="text-[#7c7875] text-xs italic">No moves yet</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {movePairs.map(([white, black], idx) => (
                <tr
                  key={idx}
                  className={idx % 2 === 0 ? "bg-white/[0.02]" : "bg-transparent"}
                >
                  <td className="text-[#7c7875] text-xs pl-4 pr-2 py-1 w-8 select-none">
                    {idx + 1}.
                  </td>
                  <td className="py-1 w-20">
                    <span className="text-[#e8e4e0] text-sm font-medium px-2 py-0.5 rounded hover:bg-white/10 cursor-default transition-colors">
                      {white}
                    </span>
                  </td>
                  <td className="py-1 w-20">
                    {black && (
                      <span className="text-[#b8b4b0] text-sm font-medium px-2 py-0.5 rounded hover:bg-white/10 cursor-default transition-colors">
                        {black}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer - Turn indicator */}
      <div className="bg-[#1e1c1a] px-4 py-2.5 border-t border-[#3d3a37] flex items-center justify-between">
        <span className="text-[#7c7875] text-xs">
          {moves.length} move{moves.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              isWhiteTurn
                ? "bg-[#f0d9b5] border-2 border-[#b58863]"
                : "bg-[#1a1a1a] border-2 border-[#888]"
            }`}
          />
          <span className="text-[#a8a4a0] text-xs">
            {isWhiteTurn ? "White" : "Black"} to move
          </span>
        </div>
      </div>
    </div>
  );
};

export default MovesCard;