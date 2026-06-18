import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import CrosswordleGame from "./components/CrosswordleGame";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CrosswordleGame />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;


