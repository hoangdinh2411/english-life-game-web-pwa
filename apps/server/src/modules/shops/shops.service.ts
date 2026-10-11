import { Injectable } from '@nestjs/common';
import { shopCatalogSchema, shopSchema, type Shop, type ShopItem } from '@life-abroad/shared';
import { DatabaseService } from '../../infrastructure/database/database.service';

@Injectable()
export class ShopsService {
  constructor(private readonly database: DatabaseService) {}

  async listItems(shop: Shop): Promise<ShopItem[]> {
    const validatedShop = shopSchema.parse(shop);
    const result = await this.database.query<ShopItem>(
      'SELECT id,name,kind,price,shop FROM public.shop_items WHERE shop=$1 ORDER BY id', [validatedShop]);
    return shopCatalogSchema.parse(result.rows);
  }
}
