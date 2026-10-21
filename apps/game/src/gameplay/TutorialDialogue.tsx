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
  return <DialogueFrame soundControl>
    <div className="dialogue-header flex items-center justify-between gap-2 [&_h2]:min-w-0 [&_h2]:[overflow-wrap:anywhere] [&_button]:shrink-0"><h2>Welcome, {playerName}</h2><GameButton label="Skip tutorial" onClick={close} /></div>
    <div className="tutorial-copy max-h-[300px] overflow-auto"><DialogueMessage name="Ruth · Welcome to Sweden!" portrait={npcPortraits.npc_station_information} text={tutorialText} onReplay={() => voice.listen(tutorialText)} replayVisible={sound && voice.supported} replayDisabled={!sound || !voice.supported} /></div>
    {voice.error ? <p role="status" className="hint text-muted text-[13px] leading-[1.4]">{voice.error}</p> : null}
    <GameButton label="Let’s explore" onClick={close} />
  </DialogueFrame>;
}
