import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard, defaultPieces } from 'react-chessboard';
import { v4 as uuidv4 } from 'uuid';

// localStorage keys scoped per guest
function getStorageKey(guestId, suffix) {
  return `chess_${guestId}_${suffix}`;
}

// Detect if a move from→to is a pawn promotion
function isPromotionMove(chess, from, to) {
  const piece = chess.get(from);
  if (!piece || piece.type !== 'p') return false;
  return (piece.color === 'w' && to[1] === '8') ||
         (piece.color === 'b' && to[1] === '1');
}

// Given a target square and board orientation, compute the column index (0-7, left to right)
function fileToColIndex(file, orientation) {
  const files = ['a','b','c','d','e','f','g','h'];
  const idx = files.indexOf(file);
  return orientation === 'white' ? idx : 7 - idx;
}

// ── Promotion Dialog ──────────────────────────────────────────────────────────
// Renders 4 piece choices stacked vertically over the promotion square on the board.
// squareSize: pixel size of one square on the current board
// targetSquare: e.g. "e8"
// playerColor: 'white' | 'black'
// onChoose(piece): called with 'q'|'r'|'b'|'n'
// onCancel(): called when clicking the dimmed backdrop
function PromotionDialog({ targetSquare, playerColor, squareSize, onChoose, onCancel }) {
  const colorPrefix = playerColor === 'white' ? 'w' : 'b';
  const pieces = ['Q', 'R', 'B', 'N']; // top to bottom
  const file = targetSquare[0];
  const colIndex = fileToColIndex(file, playerColor);

  // Promotion always appears at the top of the board (rank 8 for white, rank 1 for black)
  const left = colIndex * squareSize;
  const top = 0;

  // Offset so the dialog stays within horizontal board bounds
  const dialogWidth = squareSize;
  const dialogHeight = squareSize * 4;

  return (
    <>
      {/* Backdrop — clicking cancels */}
      <div
        onClick={onCancel}
        style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'rgba(0,0,0,0.35)',
        }}
      />
      {/* Piece selector */}
      <div
        style={{
          position: 'absolute',
          top,
          left: Math.min(left, squareSize * 8 - dialogWidth),
          width: dialogWidth,
          height: dialogHeight,
          zIndex: 11,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
        }}
      >
        {pieces.map((p) => {
          const key = `${colorPrefix}${p}`;
          const PieceSvg = defaultPieces[key];
          const pieceVal = p.toLowerCase();
          return (
            <button
              key={p}
              onClick={(e) => { e.stopPropagation(); onChoose(pieceVal); }}
              title={{ Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight' }[p]}
              style={{
                width: squareSize,
                height: squareSize,
                background: '#2a2a2a',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.1s',
                boxSizing: 'border-box',
                borderBottom: '1px solid #3e3c39',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#629924'}
              onMouseLeave={e => e.currentTarget.style.background = '#2a2a2a'}
            >
              {PieceSvg ? (
                <PieceSvg svgStyle={{ width: '100%', height: '100%' }} />
              ) : (
                <span style={{ color: '#fff', fontSize: squareSize * 0.5 }}>
                  {p}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const guestId = useRef((() => {
    let id = localStorage.getItem('guestId');
    if (!id) { id = uuidv4(); localStorage.setItem('guestId', id); }
    return id;
  })());

  const [socket, setSocket] = useState(null);
  const [gameStatus, setGameStatus] = useState('idle');
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(() => chess.fen());
  const [playerColor, setPlayerColor] = useState('white');
  const [winner, setWinner] = useState(null);
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [moveHistory, setMoveHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(getStorageKey(localStorage.getItem('guestId') || '', 'moves'));
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [squareStyles, setSquareStyles] = useState({});

  // Promotion state: null or { from, to }
  const [promotionPending, setPromotionPending] = useState(null);

  // Board container ref — used to measure square size for dialog positioning
  const boardContainerRef = useRef(null);
  const [squareSize, setSquareSize] = useState(70); // default fallback

  const socketRef = useRef(null);
  const moveListRef = useRef(null);

  // Measure square size whenever window resizes
  useEffect(() => {
    const measure = () => {
      if (boardContainerRef.current) {
        const boardWidth = boardContainerRef.current.offsetWidth;
        setSquareSize(boardWidth / 8);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [gameStatus]); // re-measure when entering game

  // Save move history on every change
  useEffect(() => {
    localStorage.setItem(getStorageKey(guestId.current, 'moves'), JSON.stringify(moveHistory));
  }, [moveHistory]);

  // Auto-scroll move list
  useEffect(() => {
    if (moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
    }
  }, [moveHistory]);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // ── WebSocket ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = guestId.current;
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
    const ws = new WebSocket(`${wsUrl}?guestId=${id}`);
    socketRef.current = ws;
    ws.onopen = () => setSocket(ws);
    ws.onclose = () => setSocket(null);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WS ←', data);

        switch (data.type) {
          case 'init_game':
            chess.reset();
            setPlayerColor(data.payload.color);
            setGameStatus('playing');
            setWinner(null);
            setDrawOfferReceived(false);
            setSelectedSquare(null);
            setSquareStyles({});
            setPromotionPending(null);
            localStorage.removeItem(getStorageKey(id, 'moves'));
            setMoveHistory([]);
            setFen(chess.fen());
            break;

          case 'rejoin':
            chess.load(data.board);
            setPlayerColor(data.color);
            setGameStatus('playing');
            setWinner(null);
            setDrawOfferReceived(false);
            setSelectedSquare(null);
            setSquareStyles({});
            setPromotionPending(null);
            setFen(chess.fen());
            try {
              const saved = localStorage.getItem(getStorageKey(id, 'moves'));
              setMoveHistory(saved ? JSON.parse(saved) : []);
            } catch { setMoveHistory([]); }
            break;

          case 'move':
            if (data.board) {
              chess.load(data.board);
            } else if (data.move) {
              try { chess.move(data.move); } catch (e) { console.error('bad server move', e); }
            }
            if (data.move?.san) {
              setMoveHistory(prev => [...prev, data.move]);
            }
            setSelectedSquare(null);
            setSquareStyles({});
            setFen(chess.fen());
            break;

          case 'game_over':
            setGameStatus('game_over');
            setWinner(data.winner);
            setDrawOfferReceived(false);
            setSelectedSquare(null);
            setSquareStyles({});
            setPromotionPending(null);
            break;

          case 'draw_offer':
            setDrawOfferReceived(true);
            break;

          case 'draw_response':
            if (!data.accepted) showToast('Draw offer declined.');
            break;

          case 'error':
            showToast(data.message || 'Invalid move');
            break;

          default:
            console.warn('Unknown ws msg:', data.type);
        }
      } catch (e) {
        console.error('WS parse error', e);
      }
    };

    return () => ws.close();
  }, [chess, showToast]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const sendAction = useCallback((msg) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const isMyTurn = useCallback(() => chess.turn() === playerColor[0], [chess, playerColor]);

  const highlightMoves = useCallback((square) => {
    const moves = chess.moves({ square, verbose: true });
    const styles = { [square]: { backgroundColor: 'rgba(20, 85, 30, 0.5)' } };
    moves.forEach((m) => {
      const hasEnemy = !!chess.get(m.to);
      styles[m.to] = hasEnemy
        ? { background: 'radial-gradient(circle, rgba(0,0,0,0) 60%, rgba(20,85,30,0.65) 60%)', borderRadius: '0%' }
        : { background: 'radial-gradient(circle, rgba(20,85,30,0.55) 26%, transparent 26%)', borderRadius: '50%' };
    });
    setSquareStyles(styles);
  }, [chess]);

  // Execute a fully-specified move (with optional promotion piece)
  const executeMoveWithPromotion = useCallback((from, to, promotion = null) => {
    const legal = chess.moves({ verbose: true });
    // For promotion moves, multiple entries exist (one per promotion piece). Find the right one.
    const match = promotion
      ? legal.find(m => m.from === from && m.to === to && m.promotion === promotion)
      : legal.find(m => m.from === from && m.to === to && !m.promotion);

    if (!match) return false;
    try {
      const move = chess.move(match.san);
      setFen(chess.fen());
      setMoveHistory(prev => [...prev, move]);
      setSelectedSquare(null);
      setSquareStyles({});
      sendAction({ type: 'move', move });
      return true;
    } catch (e) {
      console.error('executeMoveWithPromotion error', e);
      return false;
    }
  }, [chess, sendAction]);

  // Core move handler — detects promotions and opens dialog instead
  const makeMove = useCallback((from, to) => {
    if (gameStatus !== 'playing') return false;
    if (!isMyTurn()) return false;

    // Check legality first (ignore promotion type for this check)
    const legal = chess.moves({ verbose: true });
    const anyMatch = legal.find(m => m.from === from && m.to === to);
    if (!anyMatch) return false;

    // Is this a promotion?
    if (isPromotionMove(chess, from, to)) {
      setPromotionPending({ from, to });
      setSelectedSquare(null);
      setSquareStyles({});
      return true; // consume the drop/click — dialog will handle the rest
    }

    return executeMoveWithPromotion(from, to, null);
  }, [chess, gameStatus, isMyTurn, executeMoveWithPromotion]);

  // Called when user picks a piece in the promotion dialog
  const handlePromotionChoice = useCallback((piece) => {
    if (!promotionPending) return;
    executeMoveWithPromotion(promotionPending.from, promotionPending.to, piece);
    setPromotionPending(null);
  }, [promotionPending, executeMoveWithPromotion]);

  const handlePromotionCancel = useCallback(() => {
    setPromotionPending(null);
  }, []);

  // v5: onPieceDrop({ sourceSquare, targetSquare, piece }) → boolean
  const onPieceDrop = useCallback(({ sourceSquare, targetSquare }) => {
    if (!targetSquare) return false;
    return makeMove(sourceSquare, targetSquare);
  }, [makeMove]);

  // v5: onSquareClick({ square, piece }) → void
  const onSquareClick = useCallback(({ square }) => {
    if (gameStatus !== 'playing') return;
    if (!isMyTurn()) return;

    // If promotion dialog is open, close it on board click
    if (promotionPending) {
      setPromotionPending(null);
      return;
    }

    const piece = chess.get(square);

    if (!selectedSquare) {
      if (piece && piece.color === playerColor[0]) {
        setSelectedSquare(square);
        highlightMoves(square);
      }
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      setSquareStyles({});
      return;
    }

    const moved = makeMove(selectedSquare, square);
    if (!moved) {
      if (piece && piece.color === playerColor[0]) {
        setSelectedSquare(square);
        highlightMoves(square);
      } else {
        setSelectedSquare(null);
        setSquareStyles({});
      }
    }
  }, [chess, gameStatus, isMyTurn, selectedSquare, playerColor, promotionPending, makeMove, highlightMoves]);

  // ── Action handlers ─────────────────────────────────────────────────────────
  const handleFindMatch = () => { setGameStatus('searching'); sendAction({ type: 'init_game' }); };
  const handleResign = () => sendAction({ type: 'resign' });
  const handleOfferDraw = () => { sendAction({ type: 'draw_offer' }); showToast('Draw offer sent.'); };
  const handleDrawResponse = (accepted) => { sendAction({ type: 'draw_response', accepted }); setDrawOfferReceived(false); };
  const handleReturnToLobby = () => {
    chess.reset();
    setGameStatus('idle');
    setWinner(null);
    setMoveHistory([]);
    setDrawOfferReceived(false);
    setSelectedSquare(null);
    setSquareStyles({});
    setPromotionPending(null);
    setFen(chess.fen());
    localStorage.removeItem(getStorageKey(guestId.current, 'moves'));
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const isConnected = socket?.readyState === WebSocket.OPEN;
  const myTurn = gameStatus === 'playing' && isMyTurn();
  const opponentColor = playerColor === 'white' ? 'black' : 'white';
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const movePairs = moveHistory.reduce((pairs, move, i) => {
    if (i % 2 === 0) pairs.push([move]);
    else pairs[pairs.length - 1].push(move);
    return pairs;
  }, []);

  // ── Styles ──────────────────────────────────────────────────────────────────
  const btn = (bg, color = '#bababa', borderColor = '#4a4844') => ({
    background: bg, border: `1px solid ${borderColor}`, color,
    fontWeight: 600, fontSize: 13, padding: '9px 0',
    borderRadius: 4, cursor: 'pointer', width: '100%',
  });
  const greenBtn = {
    background: '#629924', border: 'none', color: '#fff',
    fontWeight: 700, fontSize: 15, padding: '13px 0',
    borderRadius: 4, cursor: 'pointer', width: '100%',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#161512', color: '#bababa', fontFamily: "'Noto Sans','Segoe UI',sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ background: '#262421', borderBottom: '1px solid #3e3c39', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48, flexShrink: 0 }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: 2 }}>♟ CHESS</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: isConnected ? '#4caf50' : '#f44336', display: 'inline-block' }} />
          <span style={{ fontSize: 12, color: '#888' }}>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>

      {/* Toast */}
      {toastMessage && (
        <div style={{ position: 'fixed', top: 56, left: '50%', transform: 'translateX(-50%)', background: '#3a3835', color: '#fff', padding: '7px 18px', borderRadius: 4, zIndex: 9999, fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
          {toastMessage}
        </div>
      )}

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>

        {/* IDLE */}
        {gameStatus === 'idle' && (
          <div style={{ background: '#262421', border: '1px solid #3e3c39', borderRadius: 6, padding: '48px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: 52, lineHeight: 1 }}>♟</div>
            <h2 style={{ color: '#fff', margin: 0, fontSize: 22, fontWeight: 700 }}>Play Chess</h2>
            <p style={{ color: '#888', margin: 0, textAlign: 'center', fontSize: 13, lineHeight: 1.6 }}>
              Find a random opponent and play in real time.<br />
              <span style={{ fontSize: 11, color: '#555' }}>Open a second browser / incognito window to test locally.</span>
            </p>
            <button style={greenBtn} onClick={handleFindMatch}>Find Match</button>
          </div>
        )}

        {/* SEARCHING */}
        {gameStatus === 'searching' && (
          <div style={{ background: '#262421', border: '1px solid #3e3c39', borderRadius: 6, padding: '48px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: 36, animation: 'spin 1.2s linear infinite' }}>⟳</div>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            <h2 style={{ color: '#fff', margin: 0, fontSize: 18 }}>Finding opponent…</h2>
          </div>
        )}

        {/* PLAYING / GAME_OVER */}
        {(gameStatus === 'playing' || gameStatus === 'game_over') && (
          <div style={{ display: 'flex', gap: 16, width: '100%', maxWidth: 960, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>

            {/* Board column */}
            <div style={{ flex: '0 0 auto', width: '100%', maxWidth: 560 }}>

              {/* Opponent label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: opponentColor === 'white' ? '#f0d9b5' : '#2a2a2a', border: '1px solid #555', flexShrink: 0 }} />
                <span>Opponent · <strong style={{ color: '#ddd' }}>{cap(opponentColor)}</strong></span>
                {!myTurn && gameStatus === 'playing' && (
                  <span style={{ marginLeft: 'auto', color: '#629924', fontSize: 12 }}>● thinking…</span>
                )}
              </div>

              {/* Board + promotion overlay wrapper */}
              <div
                ref={boardContainerRef}
                style={{ position: 'relative', borderRadius: 3, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
              >
                <Chessboard
                  options={{
                    position: fen,
                    boardOrientation: playerColor,
                    squareStyles,
                    allowDragging: gameStatus === 'playing' && !promotionPending,
                    onPieceDrop,
                    onSquareClick,
                    animationDurationInMs: 150,
                    showAnimations: true,
                  }}
                />
                {/* Promotion Dialog — rendered inside the board container for correct positioning */}
                {promotionPending && (
                  <PromotionDialog
                    targetSquare={promotionPending.to}
                    playerColor={playerColor}
                    squareSize={squareSize}
                    onChoose={handlePromotionChoice}
                    onCancel={handlePromotionCancel}
                  />
                )}
              </div>

              {/* My label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: playerColor === 'white' ? '#f0d9b5' : '#2a2a2a', border: '1px solid #555', flexShrink: 0 }} />
                <span>You · <strong style={{ color: '#ddd' }}>{cap(playerColor)}</strong></span>
                {myTurn && (
                  <span style={{ marginLeft: 'auto', color: '#629924', fontSize: 12 }}>● your turn</span>
                )}
              </div>
            </div>

            {/* Side panel */}
            <div style={{ flex: '1 1 200px', minWidth: 196, maxWidth: 260, display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* Draw offer */}
              {drawOfferReceived && gameStatus === 'playing' && (
                <div style={{ background: '#3c3020', border: '1px solid #5a4830', borderRadius: 4, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ color: '#e2c08d', fontSize: 13, fontWeight: 600 }}>½ &nbsp;Opponent offers a draw</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button style={{ ...btn('#629924', '#fff', 'transparent') }} onClick={() => handleDrawResponse(true)}>Accept</button>
                    <button style={btn('#403d39')} onClick={() => handleDrawResponse(false)}>Decline</button>
                  </div>
                </div>
              )}

              {/* Game over card */}
              {gameStatus === 'game_over' && (
                <div style={{ background: '#262421', border: '1px solid #3e3c39', borderRadius: 4, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>
                    {winner === 'draw' ? '½-½  Draw' : winner ? `${cap(winner)} wins!` : 'Game over'}
                  </div>
                  <button style={greenBtn} onClick={handleReturnToLobby}>New Game</button>
                </div>
              )}

              {/* Move history */}
              <div style={{ background: '#262421', border: '1px solid #3e3c39', borderRadius: 4, display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 200, maxHeight: 460 }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid #3e3c39', color: '#bababa', fontSize: 12, fontWeight: 600, background: '#302e2a', borderRadius: '4px 4px 0 0', flexShrink: 0 }}>
                  Move History
                </div>
                <div ref={moveListRef} style={{ overflowY: 'auto', flex: 1, fontFamily: 'monospace', fontSize: 13 }}>
                  {movePairs.length === 0
                    ? <div style={{ color: '#555', padding: '10px 12px', fontSize: 12 }}>No moves yet.</div>
                    : movePairs.map((pair, idx) => (
                      <div key={idx} style={{ display: 'flex', padding: '3px 12px', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)', gap: 4 }}>
                        <span style={{ color: '#555', width: 26, flexShrink: 0, userSelect: 'none' }}>{idx + 1}.</span>
                        <span style={{ color: '#e8e8e8', width: 66, flexShrink: 0 }}>{pair[0]?.san}</span>
                        <span style={{ color: '#aaa' }}>{pair[1]?.san ?? ''}</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Resign / Draw buttons */}
              {gameStatus === 'playing' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button style={btn('#302e2a')} onClick={handleOfferDraw}>½ Draw</button>
                  <button style={{ ...btn('#302e2a', '#c84b31') }} onClick={handleResign}>🏳 Resign</button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
