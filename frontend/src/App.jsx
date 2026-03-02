import './App.css'
import { Landing } from './screens/Landing.jsx';
import { Game } from './screens/Game.jsx';
import { BrowserRouter, Route, Routes } from "react-router-dom";
function App() {
  return (
    <>
      <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing/>} />
            <Route path="/game" element={<Game/>} />
          </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
