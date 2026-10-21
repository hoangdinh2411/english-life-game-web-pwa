export interface GameMenuCanvasStateInput {
  menuOpen: boolean;
  worldBlockerOpen: boolean;
}

export interface GameMenuCanvasState {
  playerInputPaused: boolean;
  worldPaused: boolean;
}

export function gameMenuCanvasState({
  menuOpen,
  worldBlockerOpen,
}: GameMenuCanvasStateInput): GameMenuCanvasState {
  return {
    playerInputPaused: menuOpen || worldBlockerOpen,
    worldPaused: worldBlockerOpen,
  };
}
