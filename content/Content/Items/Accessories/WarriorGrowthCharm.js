/**
 * 基础款：战士成长饰品。
 *
 * 属性由 Common/Players/WarriorGrowthPlayer.js 按"Boss 进度"实时计算，
 * 物品本身只负责：占一个饰品栏、显示说明、提供获取与升级配方。
 */

import { CONFIG } from '../../../Common/Config.js';

const { ItemID, TileID } = Terraria.ID;

export class WarriorGrowthCharm extends ModItem {
  SetDefaults() {
    this.Item.width = 32;
    this.Item.height = 32;
    this.Item.accessory = true;
    this.Item.rare = 3; // 橙色
    this.Item.value = Terraria.Item.buyPrice(0, 5, 0, 0);

    this.DisplayName = '战士成长饰品';
    this.Tooltip = [
      '随 Boss 进度成长：每击败一个 Boss +1 防御 / +1% 伤害',
      '基础：1% 减伤 / 4 防御 / 4% 伤害',
      `击败机械三王后，用 ${CONFIG.upgrade.materials[0].amount} 神圣锭 + 三魂各 ${CONFIG.upgrade.materials[1].amount} 升级`,
      '升级后解锁闪避与吸血',
    ].join('\n');
  }

  AddRecipes() {
    // 获取配方（待平衡）：12 铁/铅锭 + 1 生命水晶，铁砧制作
    this.CreateRecipe()
      .AddRecipeGroup('IronBar', 12)
      .AddIngredient(ItemID.LifeCrystal, 1)
      .AddTile(TileID.Anvils)
      .Register();
  }
}

export default WarriorGrowthCharm;