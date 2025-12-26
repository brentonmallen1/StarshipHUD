import { useState } from 'react';
import './MiniGameOverlay.css';

interface MiniGameDefinition {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit?: number;
}

interface Props {
  game: MiniGameDefinition;
  onComplete: (success: boolean, score?: number) => void;
  onCancel: () => void;
}

/**
 * Mini-Game Launcher Overlay
 *
 * Displays interactive mini-games for task outcomes.
 * Examples: hacking sequences, reactor calibration, navigation puzzles, etc.
 */
export function MiniGameOverlay({ game, onComplete, onCancel }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeRemaining] = useState(game.timeLimit || 0);

  const handleStart = () => {
    setIsPlaying(true);
    // TODO: Implement actual mini-game logic
    // For now, this is a framework/placeholder
  };

  const handleSuccess = () => {
    setIsPlaying(false);
    onComplete(true, 100);
  };

  const handleFailure = () => {
    setIsPlaying(false);
    onComplete(false, 0);
  };

  return (
    <div className="minigame-overlay" onClick={onCancel}>
      <div className="minigame-container" onClick={(e) => e.stopPropagation()}>
        {!isPlaying ? (
          // Pre-game briefing
          <div className="minigame-briefing">
            <div className="minigame-header">
              <h2 className="minigame-title">{game.name}</h2>
              <button className="minigame-close" onClick={onCancel}>
                ×
              </button>
            </div>

            <div className="minigame-body">
              <p className="minigame-description">{game.description}</p>

              <div className="minigame-meta">
                <div className="meta-item">
                  <span className="meta-label">Difficulty:</span>
                  <span className={`meta-value difficulty-${game.difficulty}`}>
                    {game.difficulty.toUpperCase()}
                  </span>
                </div>
                {game.timeLimit && (
                  <div className="meta-item">
                    <span className="meta-label">Time Limit:</span>
                    <span className="meta-value">{game.timeLimit}s</span>
                  </div>
                )}
              </div>

              <div className="minigame-placeholder">
                <div className="placeholder-icon">🎮</div>
                <p className="placeholder-text">
                  Mini-game implementation coming soon
                </p>
                <p className="placeholder-hint">
                  This framework supports interactive tasks like:
                  <br />
                  Hacking sequences • Reactor calibration • Navigation puzzles
                  <br />
                  Resource allocation • Pattern matching • Timing challenges
                </p>
              </div>
            </div>

            <div className="minigame-footer">
              <button className="btn" onClick={onCancel}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleStart}>
                Begin Task
              </button>
            </div>
          </div>
        ) : (
          // Active mini-game (placeholder)
          <div className="minigame-active">
            <div className="minigame-header">
              <h2 className="minigame-title">{game.name}</h2>
              {game.timeLimit && (
                <div className="minigame-timer">{timeRemaining}s</div>
              )}
            </div>

            <div className="minigame-canvas">
              <p>Mini-game canvas area</p>
              <p>(Implementation specific to each game type)</p>
            </div>

            <div className="minigame-footer">
              <button className="btn btn-danger" onClick={handleFailure}>
                Abort (Debug)
              </button>
              <button className="btn btn-primary" onClick={handleSuccess}>
                Complete (Debug)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
