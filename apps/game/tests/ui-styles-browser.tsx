// Manual Vite fixture: real reusable UI components, fictional state, no Auth/API calls.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ActionButton, AvatarPreview, ChoiceCard, Heading, Screen } from '../src/components/onboarding-ui';
import { DialogueMessage } from '../src/gameplay/DialogueMessage';
import { playerPortrait } from '../src/gameplay/portraits';
import '../src/styles.css';

function StylingFixture() {
  const [selected, setSelected] = useState(false);
  return <div className="app-shell h-dvh flex flex-col overflow-hidden">
    <Screen>
      <Heading title="UI verification" subtitle="Fictional preview · No account or saved data changes." />
      <form className="flex flex-col gap-4" onSubmit={event => event.preventDefault()}>
        <label>Email<input type="email" defaultValue="preview@example.com" /></label>
        <label>Invalid name<input aria-invalid="true" defaultValue="Preview" aria-describedby="preview-error" /></label>
        <p id="preview-error" role="alert" className="text-[#a43f34] text-[15px] leading-[1.4]">Preview error state</p>
        <ActionButton label="Primary action" onClick={() => setSelected(true)} />
        <ActionButton label="Secondary action" secondary onClick={() => setSelected(false)} />
        <ActionButton label="Disabled action" disabled onClick={() => {}} />
      </form>
      <ChoiceCard title="Preview avatar" subtitle="Select to verify the selected card state." selected={selected} onClick={() => setSelected(!selected)}><AvatarPreview color="#426f61" /></ChoiceCard>
      <AvatarPreview color="#426f61" large />
      <DialogueMessage name="Preview learner" portrait={playerPortrait} text="Fictional player message" player />
      <DialogueMessage name="Preview NPC" portrait={playerPortrait} text="Fictional NPC message" />
    </Screen>
  </div>;
}
const root = document.getElementById('root');
if (!root) throw new Error('UI fixture root is missing');
createRoot(root).render(<StylingFixture />);
