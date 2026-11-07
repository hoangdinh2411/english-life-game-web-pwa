export function ConversationOpeningIndicator({ npcName, portrait }: {
  npcName: string;
  portrait: string;
}) {
  return <div
    role="status"
    aria-label={`${npcName} is about to speak.`}
    className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-3"
  >
    <div className="flex items-center gap-2 rounded-full border border-border bg-paper px-3 py-2 shadow-lg">
      <span
        aria-hidden="true"
        className="h-11 w-11 rounded-full bg-[var(--color-portrait-placeholder)]"
        style={{
          backgroundImage: `url(${portrait})`,
          backgroundPosition: '0% 0%',
          backgroundSize: '300% 100%',
        }}
      />
      <span aria-hidden="true" className="flex h-6 items-end gap-1 px-1">
        {[0, 1, 2].map(index => <span
          key={index}
          className="h-2 w-2 rounded-full bg-[var(--color-green-strong)] animate-bounce [@media(prefers-reduced-motion:reduce)]:animate-none"
          style={{ animationDelay: `${index * 120}ms` }}
        />)}
      </span>
    </div>
  </div>;
}
