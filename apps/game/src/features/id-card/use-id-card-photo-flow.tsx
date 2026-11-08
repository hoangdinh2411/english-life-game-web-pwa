import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { isIdCardConfirmation, type IdCardApplicationSummary, type PlayerGender } from '@life-abroad/shared';
import { GameButton } from '../../gameplay/GameButton';
import { playerPortraitPresentation } from '../../gameplay/portraits';
import { prepareIdPhoto } from './photo-processing';
import { IdCardCameraCapture } from './IdCardCameraCapture';

type Phase = 'choose' | 'camera' | 'preview' | 'reviewing' | 'review' | 'issuing' | 'issued';

export function useIdCardPhotoFlow({ application, gender, send, waitForAcknowledgement, issue }: {
  application: IdCardApplicationSummary | undefined;
  gender?: PlayerGender | undefined;
  send: (text: string, options?: { stream?: boolean }) => Promise<boolean>;
  waitForAcknowledgement: () => Promise<string | undefined>;
  issue: (photo: Blob | null, key: string) => Promise<void>;
}): { actions?: ReactNode; composerHidden: boolean; issuingMessageId?: string; reviewPhoto?: ReactNode; send: (text: string) => Promise<boolean> } {
  const [phase, setPhase] = useState<Phase>('choose');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirmationSaved, setConfirmationSaved] = useState(false);
  const [issuingMessageId, setIssuingMessageId] = useState<string>();
  const key = useRef(crypto.randomUUID());
  const upload = useRef<HTMLInputElement>(null);
  const portrait = playerPortraitPresentation(gender);
  const clearPreview = useCallback(() => {
    setPreview(current => { if (current) URL.revokeObjectURL(current); return null; });
    if (upload.current) upload.current.value = '';
    setPhoto(null); setError(''); setConfirmationSaved(false); setPhase('choose'); key.current = crypto.randomUUID();
  }, []);
  useEffect(() => clearPreview, [clearPreview]);
  const applicationStep = application?.step;
  useEffect(() => {
    if (!applicationStep || applicationStep === 'photo') clearPreview();
  }, [applicationStep, clearPreview]);

  const choose = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setError('');
    try {
      const prepared = await prepareIdPhoto(file);
      setPreview(current => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(prepared); });
      setPhoto(prepared); setPhase('preview');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Choose another photo.'); }
  };
  const finishIssue = async (): Promise<boolean> => {
    setPhase('issuing'); setError('');
    try {
      await issue(photo, key.current);
      setPreview(current => { if (current) URL.revokeObjectURL(current); return null; });
      setPhoto(null); setPhase('issued'); return true;
    } catch (failure) {
      setPhase('review'); setError(failure instanceof Error ? failure.message : 'ID card update failed. Try again.'); return false;
    }
  };
  const review = async (label: 'uploaded photo' | 'character picture'): Promise<void> => {
    const previousPhase = phase;
    setPhase('reviewing');
    const sent = await send(label === 'uploaded photo' ? 'Use this photo' : 'Use my character picture',
      application?.mode === 'edit' ? { stream: false } : undefined);
    if (!sent) { setPhase(previousPhase); return; }
    if (application?.mode === 'edit') {
      setIssuingMessageId(await waitForAcknowledgement());
      await finishIssue();
      return;
    }
    setPhase('review');
  };
  const wrappedSend = async (text: string): Promise<boolean> => {
    if (phase === 'review' && isIdCardConfirmation(text)) {
      if (!confirmationSaved) {
        const sent = await send(text, { stream: false }); if (!sent) return false;
        setConfirmationSaved(true);
        setIssuingMessageId(await waitForAcknowledgement());
      }
      return finishIssue();
    }
    return send(text);
  };
  if (!application) return { composerHidden: false, send: wrappedSend,
    ...(phase === 'issuing' && issuingMessageId ? { issuingMessageId } : {}) };
  if (phase === 'issued') return { composerHidden: true, send: wrappedSend };
  const reviewPhoto = phase === 'review' || phase === 'reviewing' ? preview ? (
    <img src={preview} alt="Uploaded ID card photo preview" className="h-32 w-24 rounded-lg object-cover" />
  ) : (
    <span role="img" aria-label="Character picture preview" className="block h-32 w-24 rounded-lg bg-cover"
      style={{ backgroundImage: `url(${portrait.portrait})`,
        ...(portrait.portraitGrid ? {
          backgroundSize: `${portrait.portraitGrid.columns}00% ${portrait.portraitGrid.rows}00%`,
        } : {}),
        backgroundPosition: portrait.portraitPosition }} />
  ) : undefined;
  return { send: wrappedSend, composerHidden: phase !== 'review',
    ...(phase === 'issuing' && issuingMessageId ? { issuingMessageId } : {}),
    ...(reviewPhoto ? { reviewPhoto } : {}),
    actions: <section aria-label="ID card photo" className="flex flex-col gap-2">
    <input ref={upload} className="sr-only" type="file" accept="image/*" onChange={event => void choose(event.target.files?.[0])} />
    {phase === 'choose' ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <GameButton label="Upload photo" onClick={() => upload.current?.click()} />
      <GameButton label="Take photo" onClick={() => { setError(''); setPhase('camera'); }} />
      <GameButton label="Use my character picture" onClick={() => { setPhoto(null); void review('character picture'); }} />
    </div> : null}
    {phase === 'camera' ? <IdCardCameraCapture onCapture={choose} onCancel={clearPreview} /> : null}
    {phase === 'preview' && preview ? <><img src={preview} alt="ID card photo preview" className="mx-auto max-h-48 rounded-xl object-contain" />
      <div className="flex flex-wrap gap-2"><GameButton label="Use this" onClick={() => void review('uploaded photo')} />
        <GameButton label="Choose another" onClick={clearPreview} /></div></> : null}
    {error ? <p role="alert" className="text-[var(--color-danger)]">{error}</p> : null}
  </section> };
}
