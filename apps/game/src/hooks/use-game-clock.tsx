import { useEffect, useState } from "react";

export default function useGameClock(rate: number) {
  const [startedAt] = useState(() => performance.now());
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(performance.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return new Date(
    Date.parse("2000-01-01T08:00:00.000Z") + (now - startedAt) * rate,
  );
}
