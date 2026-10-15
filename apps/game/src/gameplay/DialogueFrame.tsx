import { useEffect, useRef, type PropsWithChildren } from 'react';
import { Settings } from '../features/hud/Settings';
export function DialogueFrame({ children, ariaLabel = 'Station dialogue', onClose, soundControl = false }: PropsWithChildren<{ ariaLabel?: string; onClose?: () => void; soundControl?: boolean }>) {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = frame.current;
    element?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !element) return;
      const controls = Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')).filter(control => control.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); element.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    element?.addEventListener('keydown', trap);
    return () => { element?.removeEventListener('keydown', trap); previous?.focus(); };
  }, [onClose]);
  return <div ref={frame} role="dialog" aria-modal="true" aria-label={ariaLabel} tabIndex={-1} className="dialogue-frame absolute z-[2] [bottom:max(8px,_env(safe-area-inset-bottom))] [left:50%] [transform:translateX(-50%)] w-[min(720px,_calc(100%_-_16px))] max-h-[calc(100%_-_64px)] bg-dialogue [border:2px_solid_#aa8b57] rounded-[18px] p-[18px] [box-shadow:0_6px_16px_#0004] overflow-auto [@media(max-width:699px)]:p-3 [@media(max-height:480px)]:max-h-[calc(100%_-_16px)]"><div className="dialogue-content flex flex-col gap-2.5">{soundControl ? <Settings compact /> : null}{children}</div></div>;
}
