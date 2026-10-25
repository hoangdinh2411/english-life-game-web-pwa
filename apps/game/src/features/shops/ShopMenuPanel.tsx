import { useCallback, useEffect, useState } from 'react';
import type { ShopItem, ShopOrder } from '@life-abroad/shared';
import { loadCatalog, loadShopOrders } from '../life/life-api';
import { useSession } from '../../session/session-provider';

const placeholderImage = '/images/shops/item-placeholder.svg';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not load this information. Try again.';
}

export function ShopMenuPanel({ refreshKey = 0, showMenu = false, showOrders = false }: {
  refreshKey?: number; showMenu?: boolean; showOrders?: boolean;
}) {
  const { runAuthenticated: run } = useSession();
  const [catalog, setCatalog] = useState<ShopItem[]>([]);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [ordersError, setOrdersError] = useState('');

  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try { setCatalog(await run(loadCatalog)); setCatalogError(''); }
    catch (error: unknown) { setCatalogError(errorText(error)); }
    finally { setCatalogLoading(false); }
  }, [run]);

  const refreshOrders = useCallback(async () => {
    setOrdersLoading(true);
    try { setOrders(await run(loadShopOrders)); setOrdersError(''); }
    catch (error: unknown) { setOrdersError(errorText(error)); }
    finally { setOrdersLoading(false); }
  }, [run]);

  useEffect(() => { if (showMenu) void refreshCatalog(); }, [refreshCatalog, showMenu]);
  useEffect(() => { if (showOrders) void refreshOrders(); }, [refreshOrders, refreshKey, showOrders]);

  const cafeItems = catalog.filter(item => item.shop === 'cafe');
  const drinks = cafeItems.filter(item => item.kind === 'drink');
  const food = cafeItems.filter(item => item.kind === 'food');
  const renderItems = (items: ShopItem[], label: string) => items.length ? <section aria-label={label} className="mb-2 last:mb-0">
    <h4 className="mb-1 mt-0 text-xs font-semibold">{label}</h4>
    <ul aria-label={`${label} items`} className="m-0 grid min-w-0 grid-cols-1 gap-1.5 p-0 [list-style:none] [@media(min-width:360px)]:grid-cols-2 [@media(min-width:700px)]:grid-cols-3">
      {items.map(item => <li key={item.id}>
        <article aria-label={`${item.name}, $${item.price}`} className="flex min-h-[72px] min-w-0 items-center gap-2 rounded-lg border border-[var(--color-menu-border)] bg-card/80 p-1.5">
          <img src={item.image ?? placeholderImage} alt={`${item.name} illustration`} loading="lazy" width="52" height="52"
            className="h-[52px] w-[52px] shrink-0 rounded-md object-cover"
            onError={event => {
              const image = event.currentTarget;
              if (image.dataset.placeholderApplied) return;
              image.dataset.placeholderApplied = 'true';
              image.src = placeholderImage;
            }} />
          <span className="flex min-w-0 flex-col gap-0.5 text-xs leading-tight">
            <strong className="break-words">{item.name}</strong>
            <span className="font-bold">${item.price}</span>
          </span>
        </article>
      </li>)}
    </ul>
  </section> : null;
  if (!showMenu && !showOrders) return null;
  return <section aria-label="Café menu and recent orders" className="shop-menu-panel min-w-0 rounded-xl bg-[var(--color-shop-surface)] p-2.5 text-[var(--color-shop-text)]">
    {showMenu ? <>
      <h3 className="m-0 mb-1 text-sm font-bold">Café menu</h3>
      {catalogLoading ? <p role="status" className="m-0 text-xs">Loading menu…</p> : null}
      {catalogError ? <div role="alert" className="flex flex-wrap items-center gap-2 text-xs">
        <span>{catalogError}</span>
        <button type="button" className="min-h-11 rounded-lg border border-[var(--color-gold-border)] px-3 font-semibold" onClick={() => void refreshCatalog()}>Retry menu</button>
      </div> : null}
      {!catalogLoading && !catalogError && !cafeItems.length ? <p className="m-0 text-xs">The café menu is not available yet.</p> : null}
      {cafeItems.length ? <div className="max-h-48 min-w-0 overflow-auto">
        {renderItems(drinks, 'Drinks')}
        {renderItems(food, 'Food')}
      </div> : null}
    </> : null}

    {showOrders ? <>
      <h3 className={`mb-1 text-sm font-bold ${showMenu ? 'mt-2 border-t border-[var(--color-menu-border)] pt-2' : 'm-0'}`}>Recent orders</h3>
      {ordersLoading ? <p role="status" className="m-0 text-xs">Loading your orders…</p> : null}
      {ordersError ? <div role="alert" className="flex flex-wrap items-center gap-2 text-xs">
        <span>{ordersError}</span>
        <button type="button" className="min-h-11 rounded-lg border border-[var(--color-gold-border)] px-3 font-semibold" onClick={() => void refreshOrders()}>Retry orders</button>
      </div> : null}
      {!ordersLoading && !ordersError && !orders.length ? <p className="m-0 text-xs">No café orders yet.</p> : null}
      {orders.length ? <ol aria-label="Your recent café orders" className="m-0 flex max-h-20 flex-col gap-1 overflow-auto p-0 text-xs [list-style:none]">
      {orders.slice(0, 3).map(order => <li key={order.id} className="flex min-w-0 flex-wrap justify-between gap-x-2">
        <span className="min-w-0 break-words">{order.items.map(item => `${item.quantity} × ${item.name}`).join(', ')}</span>
        <strong>${order.total}</strong>
      </li>)}
      </ol> : null}
    </> : null}
  </section>;
}
