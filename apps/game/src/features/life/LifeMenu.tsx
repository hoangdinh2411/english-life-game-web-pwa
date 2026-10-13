import { useState } from "react";
import { isVenueOpen } from "@life-abroad/shared";
import type { LifeControls } from "./useLife";
export function LifeMenu({
  life,
  online,
}: {
  life: LifeControls;
  online: boolean;
}) {
  const [drink, setDrink] = useState("");
  const [food, setFood] = useState("");
  const state = life.state;
  const disabled = !online || life.pending || Boolean(life.retry) || !state;
  const open = life.time ? isVenueOpen("store", life.time) : false;
  const formattedTime = life.time ? new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC", weekday: "long", hour: "2-digit", minute: "2-digit",
  }).format(life.time) : "Loading";
  const selected = life.catalog.filter(
    (item) => item.id === drink || item.id === food,
  );
  const purchase = (itemIds: string[]) =>
    void life.act({
      path: "purchase",
      body: { key: crypto.randomUUID(), itemIds },
    });
  return (
    <section
      className="life-menu flex flex-col gap-2.5 min-w-0 [&_h3]:m-0 [&_p]:m-0 [&_label]:flex [&_label]:flex-col [&_label]:gap-1 [&_select]:min-h-11 [&_select]:w-full [&_select]:max-w-full [&_select]:p-2 [&_select]:[font:inherit] [&_select]:whitespace-normal [&_button]:min-h-11 [&_button]:w-full [&_button]:max-w-full [&_button]:p-2 [&_button]:[font:inherit] [&_button]:whitespace-normal"
      aria-label="Saved life and shops"
    >
      <h3>Daily life</h3>
      {!online ? (
        <p role="status">
          Offline. Reconnect to sleep, shop, or change your appearance.
        </p>
      ) : null}
      {life.error ? <p role="alert">{life.error}</p> : null}
      {!state ? (
        <p role="status">Loading saved life…</p>
      ) : (
        <>
          <p>
            Energy: {state.energy}% · Balance: ${state.coins}
          </p>
          <p>
            Game time: {formattedTime}
          </p>
          <h3>Café</h3>
          <label>
            Drink (+20 points)
            <select
              disabled={disabled || !open}
              value={drink}
              onChange={(event) => setDrink(event.target.value)}
            >
              <option value="">No drink</option>
              {life.catalog
                .filter((item) => item.kind === "drink")
                .map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name} · ${item.price}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Food or snack (+50 points)
            <select
              disabled={disabled || !open}
              value={food}
              onChange={(event) => setFood(event.target.value)}
            >
              <option value="">No food</option>
              {life.catalog
                .filter((item) => item.kind === "food")
                .map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name} · ${item.price}
                  </option>
                ))}
            </select>
          </label>
          <p>
            Total: ${selected.reduce((sum, item) => sum + item.price, 0)} ·
            Restore {drink && food ? 80 : food ? 50 : drink ? 20 : 0} points
            (maximum 100%). Consumed immediately.
          </p>
          <button
            disabled={
              disabled ||
              !open ||
              !selected.length ||
              selected.reduce((sum, item) => sum + item.price, 0) > state.coins
            }
            onClick={() => purchase(selected.map((item) => item.id))}
          >
            Buy and consume
          </button>
          <h3>Clothes shop</h3>
          <p>Choose a shirt in a conversation with the clothes seller.</p>
        </>
      )}
      {life.retry ? (
        <>
          <p>
            The previous action may have been saved. Retry checks the same
            purchase or change without charging twice.
          </p>
          <button
            disabled={!online || life.pending}
            onClick={() => {
              if (life.retry) void life.act(life.retry);
            }}
          >
            Retry previous action
          </button>
        </>
      ) : null}
      <button
        disabled={!online || life.pending}
        onClick={() => void life.reload()}
      >
        Refresh saved life
      </button>
      {life.pending ? <p role="status">Saving…</p> : null}
    </section>
  );
}
