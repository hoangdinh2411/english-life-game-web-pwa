import {
  lifeStateSchema,
  shopCatalogSchema,
  shopOrderListSchema,
  type CustomizeRequest,
  type PurchaseRequest,
} from '@life-abroad/shared';
import { request } from '../../api/client';
export const loadLife = async (token: string) => lifeStateSchema.parse(await request('life', undefined, token));
export const loadCatalog = async (token: string) => shopCatalogSchema.parse(await request('life/catalog', undefined, token));
export const loadShopOrders = async (token: string) =>
  shopOrderListSchema.parse(await request('life/orders', undefined, token));
export type LifeAction = { path: 'sleep'; body: { key: string } } | { path: 'purchase'; body: PurchaseRequest } | { path: 'appearance'; body: CustomizeRequest };
export const performLifeAction = async (token: string, action: LifeAction) => lifeStateSchema.parse(await request(`life/${action.path}`, action.body, token));
