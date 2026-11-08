import { useEffect, useRef, useState } from 'react';
import { GameButton } from '../../gameplay/GameButton';

export function IdCardCameraCapture({ onCapture, onCancel }: {
  onCapture: (file: File) => Promise<void>;
  onCancel: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not available in this browser.');
      return () => { disposed = true; };
    }
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then(value => {
        if (disposed) { value.getTracks().forEach(track => track.stop()); return; }
        stream.current = value;
        if (video.current) video.current.srcObject = value;
      })
      .catch(() => { if (!disposed) setError('Camera access failed. Check your browser permission and try again.'); });
    return () => {
      disposed = true;
      stream.current?.getTracks().forEach(track => track.stop());
      stream.current = null;
    };
  }, []);

  const capture = async (): Promise<void> => {
    const source = video.current;
    if (!source || source.videoWidth === 0 || source.videoHeight === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
    canvas.getContext('2d')?.drawImage(source, 0, 0);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) { setError('The photo could not be captured. Please try again.'); return; }
    await onCapture(new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' }));
  };

  return (
    <section aria-label="Camera" className="grid gap-2">
      <video ref={video} autoPlay muted playsInline onCanPlay={() => setReady(true)}
        className="max-h-52 w-full rounded-xl bg-[var(--color-portrait-placeholder)] object-contain" />
      {error ? <p role="alert" className="text-[var(--color-danger)]">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <GameButton label="Capture photo" disabled={!ready || Boolean(error)} onClick={() => void capture()} />
        <GameButton label="Cancel camera" onClick={onCancel} />
      </div>
    </section>
  );
}
