const { Chess } = require('chess.js')
const chess = new Chess()
try {
  chess.move({ from: 'e2', to: 'e4', promotion: 'q' })
  console.log("Success:", chess.fen())
} catch (e) {
  console.log("Error:", e.message)
}
