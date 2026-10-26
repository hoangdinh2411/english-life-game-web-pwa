import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { IdCardApplicationSummary, PlayerGender } from '@life-abroad/shared';
import { GameButton } from '../../gameplay/GameButton';
import { playerPortraitPresentation } from '../../gameplay/portraits';
import { prepareIdPhoto } from './photo-processing';

type Phase = 'choose' | 'preview' | 'review' | 'issuing' | 'issued';

export function useIdCardPhotoFlow({ application, gender, send, issue }: {
  application: IdCardApplicationSummary | undefined;
  gender?: PlayerGender | undefined;
  send: (text: string) => Promise<boolean>;
  issue: (photo: Blob | null, key: string) => Promise<void>;
}): { actions?: ReactNode; composerHidden: boolean; send: (text: string) => Promise<boolean> } {
  const [phase, setPhase] = useState<Phase>('choose');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoLabel, setPhotoLabel] = useState<'uploaded photo' | 'character picture'>('character picture');
  const [error, setError] = useState('');
  const [confirmationSaved, setConfirmationSaved] = useState(false);
  const key = useRef(crypto.randomUUID());
  const upload = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const portrait = playerPortraitPresentation(gender);
  const clearPreview = useCallback(() => {
    setPreview(current => { if (current) URL.revokeObjectURL(current); return null; });
    setPhoto(null); setError(''); setConfirmationSaved(false); setPhase('choose'); key.current = crypto.randomUUID();
  }, []);
  useEffect(() => clearPreview, [clearPreview]);
  useEffect(() => { if (!application) clearPreview(); }, [application, clearPreview]);

  const choose = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setError('');
    try {
      const prepared = await prepareIdPhoto(file);
      setPreview(current => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(prepared); });
      setPhoto(prepared); setPhotoLabel('uploaded photo'); setPhase('preview');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Choose another photo.'); }
  };
  const openCamera = async (): Promise<void> => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      stream.getTracks().forEach(track => track.stop()); camera.current?.click();
    } catch {
      setError('Camera permission was denied. Choose a photo from your device instead.'); upload.current?.click();
    }
  };
  const wrappedSend = async (text: string): Promise<boolean> => {
    const normalized = text.trim().toLowerCase();
    if (phase === 'review' && /^(?:yes|yes please|yes issue my card|correct|that is correct)$/.test(normalized)) {
      if (!confirmationSaved) {
        const sent = await send(text); if (!sent) return false;
        setConfirmationSaved(true);
      }
      setPhase('issuing'); setError('');
      try { await issue(photo, key.current); setPhase('issued'); return true; }
      catch (failure) { setPhase('review'); setError(failure instanceof Error ? failure.message : 'ID card issue failed. Try again.'); return false; }
    }
    if (phase === 'review' && /^(?:no|nope|not correct|that is wrong)$/.test(normalized)) clearPreview();
    return send(text);
  };
  if (!application) return { composerHidden: false, send: wrappedSend };
  if (phase === 'issued') return { composerHidden: true, send: wrappedSend,
    actions: <p role="status" className="text-[var(--color-success)]">Your ID card has been issued.</p> };
  const readback = `Name: ${application.name}. Date of birth: ${application.dateOfBirth}. Address: ${application.address ?? 'Not provided'}. Gender: ${application.gender}. Where you come from: ${application.origin}. Photo: ${photoLabel}. Is this correct?`;
  return { send: wrappedSend, composerHidden: phase !== 'review', actions: <section aria-label="ID card photo" className="flex flex-col gap-2">
    <input ref={upload} className="sr-only" type="file" accept="image/*" onChange={event => void choose(event.target.files?.[0])} />
    <input ref={camera} className="sr-only" type="file" accept="image/*" capture="user" onChange={event => void choose(event.target.files?.[0])} />
    {phase === 'choose' ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <GameButton label="Upload photo" onClick={() => upload.current?.click()} />
      <GameButton label="Take photo" onClick={() => void openCamera()} />
      <GameButton label="Use my character picture" onClick={() => { setPhoto(null); setPhotoLabel('character picture'); setPhase('review'); }} />
    </div> : null}
    {phase === 'preview' && preview ? <><img src={preview} alt="ID card photo preview" className="mx-auto max-h-48 rounded-xl object-contain" />
      <div className="flex flex-wrap gap-2"><GameButton label="Use this" onClick={() => setPhase('review')} />
        <GameButton label="Choose another" onClick={clearPreview} /></div></> : null}
    {phase === 'review' ? <><div className="flex gap-2 rounded-xl bg-[var(--color-cream-muted)] p-2">
      {preview ? <img src={preview} alt="Selected ID card photo" className="size-20 rounded-lg object-cover" />
        : <span role="img" aria-label="Character picture" className="size-20 rounded-lg bg-cover bg-left-top" style={{ backgroundImage: `url(${portrait.portrait})` }} />}
      <p className="text-sm leading-5">{readback}</p></div><GameButton label={confirmationSaved ? 'Retry issuing my card' : 'Yes, issue my card'} onClick={() => void wrappedSend('Yes, issue my card')} /></> : null}
    {phase === 'issuing' ? <p role="status">Issuing your ID card…</p> : null}
    {error ? <p role="alert" className="text-[var(--color-danger)]">{error}</p> : null}
  </section> };
}
