import type { TutorialDialogueProps } from '../types/ui/gameplay';
import { DialogueFrame } from './DialogueFrame';
import { DialogueMessage } from './DialogueMessage';
import { GameButton } from './GameButton';
import { npcPortraits } from './portraits';
import { useNarration } from '../speech/use-narration';
import { tutorialText } from '../speech/tutorial-text';
import { npcVoice } from '../speech/npc-voice';
export function TutorialDialogue({ playerName, sound, onClose }: TutorialDialogueProps) {
  const voice = useNarration(tutorialText, sound, tutorialText, npcVoice.npc_station_information);
  const close = () => { voice.stop(); onClose(); };
  return <DialogueFrame>
    <div className="dialogue-header"><h2>Welcome, {playerName}</h2><GameButton label="Skip tutorial" onClick={close} /></div>
    <div className="tutorial-copy"><DialogueMessage name="Receptionist · Welcome to Maplewood!" portrait={npcPortraits.npc_station_information} text={tutorialText} onReplay={() => voice.listen(tutorialText)} replayDisabled={!sound || !voice.supported} /></div>
    {voice.error ? <p role="status" className="hint">{voice.error}</p> : null}
    <GameButton label="Let’s explore" onClick={close} />
  </DialogueFrame>;
}
