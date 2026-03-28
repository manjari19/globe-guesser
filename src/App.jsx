import { useState, useEffect, useRef, useCallback } from 'react';
import GlobeComponent from './components/GlobeComponent';
import { COUNTRIES, normalizeGuess } from './countries';
import './App.css';

const GAME_STATES = {
  IDLE: 'idle',
  SPINNING: 'spinning',
  LANDED: 'landed',
  GUESSING: 'guessing',
  CORRECT: 'correct',
  WRONG: 'wrong',
  REVEALED: 'revealed',
};

export default function App() {
  const [gameState, setGameState] = useState(GAME_STATES.IDLE);
  const [targetCountry, setTargetCountry] = useState(null);
  const [guess, setGuess] = useState('');
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [streak, setStreak] = useState(0);
  const [message, setMessage] = useState('');
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [lightMode, setLightMode] = useState(false);

  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Check speech recognition support
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  const pickRandomCountry = useCallback(() => {
    const idx = Math.floor(Math.random() * COUNTRIES.length);
    return COUNTRIES[idx];
  }, []);

  const startSpin = useCallback(() => {
    const country = pickRandomCountry();

    setTargetCountry(country);   // set immediately so app + globe use same country
    setGuess('');
    setLiveTranscript('');
    setShowHint(false);
    setMessage('');
    setGameState(GAME_STATES.SPINNING);
  }, [pickRandomCountry]);

  const handleLanded = useCallback(() => {
    setGameState(GAME_STATES.GUESSING);
    setRoundsPlayed(r => r + 1);
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const submitGuess = useCallback((guessText) => {
    const g = (guessText || guess).trim();
    if (!g || !targetCountry) return;

    const correct = normalizeGuess(g, targetCountry.name);

    if (correct) {
      setScore(s => ({ ...s, correct: s.correct + 1 }));
      setStreak(s => s + 1);
      setMessage(getCorrectMessage(streak + 1));
      setGameState(GAME_STATES.CORRECT);
    } else {
      setScore(s => ({ ...s, wrong: s.wrong + 1 }));
      setStreak(0);
      setMessage('');
      setGameState(GAME_STATES.WRONG);
    }
  }, [guess, targetCountry, streak]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') submitGuess();
  }, [submitGuess]);

  // Speech recognition
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      setLiveTranscript('');
    };

    recognition.onresult = (event) => {
      const results = event.results[event.results.length - 1];
      const transcript = results[0].transcript;
      setLiveTranscript(transcript);

      if (results.isFinal) {
        setGuess(transcript);
        submitGuess(transcript);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setLiveTranscript('');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [submitGuess]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const reveal = () => setGameState(GAME_STATES.REVEALED);

  const isSpinning = gameState === GAME_STATES.SPINNING;
  const isGuessing = gameState === GAME_STATES.GUESSING;
  const isDone = [GAME_STATES.CORRECT, GAME_STATES.WRONG, GAME_STATES.REVEALED].includes(gameState);

  return (
    <div className={`app ${lightMode ? 'light-mode' : ''}`}>
      {/* Globe fills the background */}
      <div className="globe-bg">
        <GlobeComponent
          isSpinning={isSpinning}
          targetCountry={targetCountry}
          onLanded={handleLanded}
          lightMode={lightMode}
        />
      </div>

      {/* Vignette overlay */}
      <div className="vignette" />

      {/* Header */}
      <header className="header">
        <div className="logo">
          <span className="logo-icon">🌍</span>
          <span className="logo-text">GLOBE GUESSER</span>
        </div>
        <div className="stats">
          {roundsPlayed > 0 && (
            <>
              <div className="stat correct-stat">
                <span className="stat-num">{score.correct}</span>
                <span className="stat-label">correct</span>
              </div>
              <div className="stat-divider" />
              <div className="stat wrong-stat">
                <span className="stat-num">{score.wrong}</span>
                <span className="stat-label">wrong</span>
              </div>
              {streak >= 2 && (
                <>
                  <div className="stat-divider" />
                  <div className="stat streak-stat">
                    <span className="stat-num">🔥 {streak}</span>
                    <span className="stat-label">streak</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <button 
          className="btn-theme-toggle" 
          onClick={() => setLightMode(!lightMode)}
          title={lightMode ? 'Dark mode' : 'Light mode'}
        >
          {lightMode ? '🌙' : '☀️'}
        </button>
      </header>

      {/* Main UI Panel */}
      <main className="main-panel">

        {/* IDLE */}
        {gameState === GAME_STATES.IDLE && (
          <div className="card intro-card">
            <p className="intro-sub">The globe will spin and land on a random country.</p>
            <p className="intro-sub">Can you name it?</p>
            <button className="btn-primary" onClick={startSpin}>
              <span className="btn-icon">▶</span>
              Spin the Globe
            </button>
          </div>
        )}

        {/* SPINNING */}
        {gameState === GAME_STATES.SPINNING && (
          <div className="card spin-card">
            <div className="pulse-ring" />
            <p className="spinning-text">Spinning...</p>
            <p className="spinning-sub">Destination unknown</p>
          </div>
        )}

        {/* GUESSING */}
        {gameState === GAME_STATES.GUESSING && (
          <div className="card guess-card">
            <p className="guess-prompt">Which country is this?</p>

            <div className="input-row">
              <input
                ref={inputRef}
                type="text"
                className="guess-input"
                placeholder="Type your answer..."
                value={isListening ? liveTranscript : guess}
                onChange={e => setGuess(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isListening}
              />
              <button
                className="btn-submit"
                onClick={() => submitGuess()}
                disabled={isListening}
              >
                →
              </button>
            </div>

            <div className="action-row">
              {speechSupported && (
                <button
                  className={`btn-mic ${isListening ? 'listening' : ''}`}
                  onClick={isListening ? stopListening : startListening}
                >
                  {isListening ? (
                    <>
                      <span className="mic-dot" />
                      Listening...
                    </>
                  ) : (
                    <>
                      🎤 Speak answer
                    </>
                  )}
                </button>
              )}
              <button className="btn-ghost" onClick={reveal}>
                Give up
              </button>
            </div>

            {!showHint && (
              <button className="btn-hint" onClick={() => setShowHint(true)}>
                Show hint
              </button>
            )}
            {showHint && targetCountry && (
              <div className="hint-box">
                Starts with: <strong>{targetCountry.name[0]}</strong>
                {' · '}{targetCountry.name.length} letters
              </div>
            )}
          </div>
        )}

        {/* CORRECT */}
        {gameState === GAME_STATES.CORRECT && (
          <div className="card result-card correct-card">
            <div className="result-icon">✓</div>
            <p className="result-title">Correct!</p>
            <p className="result-country">{targetCountry?.name}</p>
            {message && <p className="result-streak">{message}</p>}
            <button className="btn-primary" onClick={startSpin}>
              Next Country →
            </button>
          </div>
        )}

        {/* WRONG */}
        {gameState === GAME_STATES.WRONG && (
          <div className="card result-card wrong-card">
            <div className="result-icon wrong-icon">✗</div>
            <p className="result-title">Not quite...</p>
            <p className="result-country">{targetCountry?.name}</p>
            <p className="result-guess">You said: "{guess || liveTranscript}"</p>
            <button className="btn-primary" onClick={startSpin}>
              Try Another →
            </button>
          </div>
        )}

        {/* REVEALED */}
        {gameState === GAME_STATES.REVEALED && (
          <div className="card result-card revealed-card">
            <div className="result-icon reveal-icon">👁</div>
            <p className="result-title">Revealed</p>
            <p className="result-country">{targetCountry?.name}</p>
            <button className="btn-primary" onClick={startSpin}>
              Try Another →
            </button>
          </div>
        )}
      </main>

      {/* Ambient orb effects */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
    </div>
  );
}

function getCorrectMessage(streak) {
  if (streak === 2) return '2 in a row! 🌟';
  if (streak === 3) return 'Hat trick! 🎩';
  if (streak === 5) return 'On fire! 🔥';
  if (streak === 7) return 'Geography genius! 🧠';
  if (streak >= 10) return `${streak} in a row! 🚀`;
  return '';
}
