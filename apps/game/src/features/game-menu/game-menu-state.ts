export interface GameMenuCanvasStateInput {
  inputOverlayOpen: boolean;
  worldBlockerOpen: boolean;
}

export interface GameMenuCanvasState {
  playerInputPaused: boolean;
  worldPaused: boolean;
}

export function gameMenuCanvasState({
  inputOverlayOpen,
  worldBlockerOpen,
}: GameMenuCanvasStateInput): GameMenuCanvasState {
  return {
    playerInputPaused: inputOverlayOpen || worldBlockerOpen,
    worldPaused: worldBlockerOpen,
  };
}
