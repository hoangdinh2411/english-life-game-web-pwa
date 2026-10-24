import type { WorldClockReading } from '../../modules/world-clock/world-clock.service';

export class MutableWorldClock {
  private gameTimeUtc = new Date('2026-10-12T10:00:00.000Z');

  setGameTime(value: string): void {
    this.gameTimeUtc = new Date(value);
  }

  async read(): Promise<WorldClockReading> {
    const serverTimeUtc = new Date('2026-10-12T00:00:00.000Z');
    const gameTimeUtc = new Date(this.gameTimeUtc);
    const publicSnapshot = { gameTimeUtc: gameTimeUtc.toISOString(), timeZone: 'UTC', clockRate: 6 };
    return { gameTimeUtc, serverTimeUtc, timeZone: 'UTC', clockRate: 6, public: publicSnapshot };
  }

  async snapshot(): Promise<WorldClockReading['public']> {
    return (await this.read()).public;
  }
}
