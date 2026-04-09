const { Chess } = require('chess.js');
const chess = new Chess();
try {
  chess.move({ from: 'e2', to: 'e4', promotion: 'q' });
  console.log("SUCCESS");
} catch (e) {
  console.log("ERROR", e.message);
}
