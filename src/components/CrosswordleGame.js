import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './CrosswordleGame.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CrosswordleGame = () => {
  const [gameId, setGameId] = useState(null);
  const [wordsLayout, setWordsLayout] = useState([]);
  const [gridSize] = useState(7);
  const [gridLetters, setGridLetters] = useState({});
  const [cellColors, setCellColors] = useState({});
  const [selectedWord, setSelectedWord] = useState(null); // Which word is selected (0, 1, or 2)
  const [positionInWord, setPositionInWord] = useState(0); // Position within selected word (0-4)
  const [attemptsLeft, setAttemptsLeft] = useState(6);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [correctWords, setCorrectWords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState([]);

  useEffect(() => {
    startNewGame();
  }, []);

  const startNewGame = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/game/new`);
      setGameId(response.data.game_id);
      setWordsLayout(response.data.words_layout);
      
      // Reveal intersection letters as hints
      const initialLetters = {};
      const initialColors = {};
      if (response.data.intersection_hints) {
        response.data.intersection_hints.forEach(hint => {
          const cellKey = `${hint.row},${hint.col}`;
          initialLetters[cellKey] = hint.letter;
          initialColors[cellKey] = 'correct';  // Show as green (locked)
        });
      }
      
      setGridLetters(initialLetters);
      setCellColors(initialColors);
      setSelectedWord(null);
      setPositionInWord(0);
      setAttempts([]);
      setAttemptsLeft(6);
      setGameOver(false);
      setWon(false);
      setCorrectWords(null);
    } catch (error) {
      console.error('Error starting new game:', error);
      alert('Yeni oyun başlatılamadı. Lütfen tekrar deneyin.');
    }
    setLoading(false);
  };

  const getWordForCell = (row, col) => {
    // Find which word this cell belongs to
    for (let i = 0; i < wordsLayout.length; i++) {
      const layout = wordsLayout[i];
      if (layout.direction === 'horizontal') {
        if (layout.row === row && col >= layout.col && col < layout.col + 5) {
          return i;
        }
      } else {
        if (layout.col === col && row >= layout.row && row < layout.row + 5) {
          return i;
        }
      }
    }
    return null;
  };

  const getPositionInWord = (wordIndex, row, col) => {
    const layout = wordsLayout[wordIndex];
    if (layout.direction === 'horizontal') {
      return col - layout.col;
    } else {
      return row - layout.row;
    }
  };

  const getCellForWordPosition = (wordIndex, position) => {
    const layout = wordsLayout[wordIndex];
    if (layout.direction === 'horizontal') {
      return { row: layout.row, col: layout.col + position };
    } else {
      return { row: layout.row + position, col: layout.col };
    }
  };

  const handleCellClick = (row, col) => {
    if (gameOver) return;
    
    const wordIndex = getWordForCell(row, col);
    if (wordIndex === null) return;
    
    const position = getPositionInWord(wordIndex, row, col);
    setSelectedWord(wordIndex);
    setPositionInWord(position);
  };

  const handleKeyPress = (e) => {
    if (selectedWord === null || gameOver) return;

    const key = e.key.toUpperCase();

    if (key === 'BACKSPACE' || key === 'DELETE') {
      // Delete current cell and move backwards
      const currentCell = getCellForWordPosition(selectedWord, positionInWord);
      const cellKey = `${currentCell.row},${currentCell.col}`;
      
      // Don't allow deleting green (correct) cells
      if (cellColors[cellKey] === 'correct') {
        return;
      }
      
      const newGridLetters = { ...gridLetters };
      if (newGridLetters[cellKey]) {
        // If current cell has a letter, delete it
        delete newGridLetters[cellKey];
        setGridLetters(newGridLetters);
      } else if (positionInWord > 0) {
        // If current cell is empty, move back and delete previous
        const newPosition = positionInWord - 1;
        const prevCell = getCellForWordPosition(selectedWord, newPosition);
        const prevCellKey = `${prevCell.row},${prevCell.col}`;
        
        // Don't delete if previous cell is green
        if (cellColors[prevCellKey] !== 'correct') {
          delete newGridLetters[prevCellKey];
          setGridLetters(newGridLetters);
          setPositionInWord(newPosition);
        }
      }
      return;
    }

    // Allow Turkish and English letters (including ğ, ü, ö, ı, ş, ç)
    const turkishLetters = /^[A-ZÇĞİÖŞÜ]$/;
    if (turkishLetters.test(key)) {
      const currentCell = getCellForWordPosition(selectedWord, positionInWord);
      const cellKey = `${currentCell.row},${currentCell.col}`;
      
      // Don't allow overwriting green (correct) cells
      if (cellColors[cellKey] === 'correct') {
        // Just move to next position
        if (positionInWord < 4) {
          setPositionInWord(positionInWord + 1);
        }
        return;
      }
      
      const newGridLetters = { ...gridLetters };
      newGridLetters[cellKey] = key;
      setGridLetters(newGridLetters);

      // Move to next position within the same word
      if (positionInWord < 4) {
        setPositionInWord(positionInWord + 1);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedWord, positionInWord, gridLetters, gameOver]);

  const validateGrid = async () => {
    console.log("=== VALIDATE GRID CALLED ===");
    console.log("Current gridLetters:", gridLetters);
    console.log("Current cellColors:", cellColors);
    
    // Check if all active cells are filled
    let allFilled = true;
    wordsLayout.forEach(layout => {
      for (let i = 0; i < 5; i++) {
        const row = layout.direction === 'horizontal' ? layout.row : layout.row + i;
        const col = layout.direction === 'horizontal' ? layout.col + i : layout.col;
        const cellKey = `${row},${col}`;
        if (!gridLetters[cellKey]) {
          allFilled = false;
        }
      }
    });

    if (!allFilled) {
      alert('Lütfen tüm kutuları doldurun!');
      return;
    }

    setLoading(true);
    console.log("Starting validation...");
    
    try {
      // First update grid on backend
      console.log("Sending cell data to backend...");
      for (const [cellKey, letter] of Object.entries(gridLetters)) {
        const [row, col] = cellKey.split(',').map(Number);
        await axios.post(`${API}/game/cell`, {
          game_id: gameId,
          row: row,
          col: col,
          letter: letter
        });
      }
      console.log("Cell data sent successfully");
      
      // Now validate
      console.log("Calling validate API...");
      const response = await axios.post(`${API}/game/validate?game_id=${gameId}`);
      console.log("Validate response:", response.data);

      // Update cell colors based on feedback
      const newColors = {};
      response.data.cells_feedback.forEach(cell => {
        const cellKey = `${cell.row},${cell.col}`;
        newColors[cellKey] = cell.status;
      });
      console.log("New colors to apply:", newColors);

      // Add to attempts history with ALL colors (green, yellow, turquoise, gray)
      setAttempts([...attempts, { gridLetters: { ...gridLetters }, cellColors: { ...newColors } }]);

      // For the grid: only keep GREEN (correct) colors, remove others
      const gridColors = {};
      response.data.cells_feedback.forEach(cell => {
        const cellKey = `${cell.row},${cell.col}`;
        if (cell.status === 'correct') {
          gridColors[cellKey] = 'correct';  // Only keep green
        }
      });
      setCellColors(gridColors);
      console.log("Grid colors (only green) applied:", gridColors);

      setAttemptsLeft(6 - response.data.attempts_used);
      setGameOver(response.data.game_over);
      setWon(response.data.won);

      if (response.data.correct_words) {
        setCorrectWords(response.data.correct_words);
      }

      console.log("Game state updated. Game over?", response.data.game_over);

      // Clear non-green letters from grid for next attempt
      if (!response.data.game_over) {
        // Keep only the green (correct) letters on grid
        const newGridLetters = {};
        response.data.cells_feedback.forEach(cell => {
          const cellKey = `${cell.row},${cell.col}`;
          if (cell.status === 'correct') {
            newGridLetters[cellKey] = gridLetters[cellKey];  // Keep green letters
          }
        });
        setGridLetters(newGridLetters);
        setSelectedWord(null);
        setPositionInWord(0);
      }
    } catch (error) {
      console.error('Error validating grid:', error);
      console.error('Error details:', error.response?.data);
      alert('Doğrulama başarısız. Lütfen tekrar deneyin.');
    }
    setLoading(false);
    console.log("=== VALIDATE GRID FINISHED ===");
  };

  const renderGrid = () => {
    const grid = [];
    for (let row = 0; row < gridSize; row++) {
      const rowCells = [];
      for (let col = 0; col < gridSize; col++) {
        const wordIndex = getWordForCell(row, col);
        const isActive = wordIndex !== null;
        const cellKey = `${row},${col}`;
        const letter = gridLetters[cellKey] || '';
        const color = cellColors[cellKey] || '';
        
        // Check if this cell is part of the selected word
        const isInSelectedWord = selectedWord !== null && wordIndex === selectedWord;
        
        // Check if this is the current typing position
        const isCurrentPosition = isInSelectedWord && 
          positionInWord === getPositionInWord(wordIndex, row, col);

        let cellClass = 'grid-cell';
        if (isActive) cellClass += ' active';
        if (!isActive) cellClass += ' inactive';
        if (isInSelectedWord) cellClass += ' word-selected';  // Purple highlight for entire word
        if (isCurrentPosition) cellClass += ' current-position';  // Extra highlight for current cell
        if (color === 'correct') cellClass += ' correct';
        if (color === 'present') cellClass += ' present';
        if (color === 'absent') cellClass += ' absent';
        if (color === 'other_word') cellClass += ' other_word';

        rowCells.push(
          <div
            key={`${row}-${col}`}
            className={cellClass}
            onClick={() => handleCellClick(row, col)}
            data-testid={`cell-${row}-${col}`}
          >
            {letter}
          </div>
        );
      }
      grid.push(
        <div key={row} className="grid-row">
          {rowCells}
        </div>
      );
    }
    return <div className="game-grid">{grid}</div>;
  };

  return (
    <div className="crosswordle-container">
      <div className="game-header">
        <h1 className="game-title">🧩 Crosswordle</h1>
        <p className="game-subtitle">Kelime Zincirini Çöz</p>
        <div className="game-info">
          <span className="attempts-left">Kalan Deneme: {attemptsLeft}/6</span>
        </div>
      </div>

      <div className="game-content-wrapper">
        <div className="left-panel">
          {renderGrid()}

          {!gameOver && (
            <div className="input-section">
              <h3>Harfleri doğrudan ızgaraya yazın:</h3>
              <p className="instruction">Bir kutuya tıklayın ve yazmaya başlayın. Silmek için Backspace kullanın.</p>
              <button
                onClick={validateGrid}
                disabled={loading}
                className="submit-button"
                data-testid="validate-button"
              >
                {loading ? 'Kontrol Ediliyor...' : 'Kontrol Et'}
              </button>
            </div>
          )}
        </div>

        <div className="right-panel">
          <div className="attempts-history">
            <h3>Deneme Geçmişi:</h3>
            {attempts.map((attempt, idx) => (
              <div key={idx} className="attempt-item">
                <div className="attempt-number">Deneme {idx + 1}</div>
                <div className="attempt-grid-mini">
                  {wordsLayout.map((layout, widx) => (
                    <div key={widx} className="mini-word">
                      {[...Array(5)].map((_, i) => {
                        const row = layout.direction === 'horizontal' ? layout.row : layout.row + i;
                        const col = layout.direction === 'horizontal' ? layout.col + i : layout.col;
                        const cellKey = `${row},${col}`;
                        const letter = attempt.gridLetters[cellKey] || '';
                        const color = attempt.cellColors[cellKey] || '';
                        let cellClass = 'mini-cell';
                        if (color === 'correct') cellClass += ' correct';
                        if (color === 'present') cellClass += ' present';
                        if (color === 'absent') cellClass += ' absent';
                        if (color === 'other_word') cellClass += ' other_word';
                        return (
                          <span key={i} className={cellClass}>
                            {letter}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {gameOver && (
        <div className="game-over-modal" data-testid="game-over-modal">
          <div className="modal-content">
            <h2 className={won ? 'win' : 'lose'}>
              {won ? '🎉 Tebrikler!' : '😔 Oyun Bitti'}
            </h2>
            <p>
              {won
                ? `Tüm kelimeleri ${6 - attemptsLeft} denemede buldunuz!`
                : 'Denemeleriniz bitti.'}
            </p>
            {correctWords && (
              <div className="correct-words">
                <h3>Doğru kelimeler:</h3>
                {correctWords.map((word, idx) => (
                  <div key={idx}>
                    Kelime {idx + 1}: <strong>{word}</strong>
                  </div>
                ))}
              </div>
            )}
            <button onClick={startNewGame} className="new-game-button" data-testid="new-game-button">
              Yeni Oyun
            </button>
          </div>
        </div>
      )}

      <div className="game-rules">
        <h3>📖 Nasıl Oynanır:</h3>
        <ul>
          <li><strong>Amaç:</strong> 6 denemede 3 kelimeyi de bul</li>
          <li><strong>Her deneme:</strong> Izgaraya harfleri doğrudan yaz</li>
          <li><strong>Geri bildirim:</strong>
            <span className="feedback-box correct">Yeşil</span> = Doğru konum,
            <span className="feedback-box present">Sarı</span> = Yanlış konum,
            <span className="feedback-box other_word">Turkuaz</span> = Başka kelimede,
            <span className="feedback-box absent">Gri</span> = Kelimede yok
          </li>
          <li><strong>Strateji:</strong> Kelimeler kesişiyor! Ortak harfler ipucu verir.</li>
        </ul>
      </div>
    </div>
  );
};

export default CrosswordleGame;

