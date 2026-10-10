import { useEffect, useRef, type PropsWithChildren } from 'react';
export function DialogueFrame({ children }: PropsWithChildren) {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = frame.current;
    element?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !element) return;
      const controls = Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled), a[href]'));
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); element.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    element?.addEventListener('keydown', trap);
    return () => { element?.removeEventListener('keydown', trap); previous?.focus(); };
  }, []);
  return <div ref={frame} role="dialog" aria-modal="true" aria-label="Station dialogue" tabIndex={-1} className="dialogue-frame"><div className="dialogue-content">{children}</div></div>;
}
