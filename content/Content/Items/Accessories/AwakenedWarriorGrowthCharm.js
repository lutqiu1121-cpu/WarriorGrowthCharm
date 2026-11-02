/**
 * 觉醒款：战士成长饰品·觉醒。
 *
 * 由基础款 + 神圣锭 + 三魂合成 —— 这就是"升级"：
 *  - 材料被配方消耗（神圣锭只有机械三王掉落，所以材料本身即天然前置）；
 *  - 升级后额外 +2% 减伤 / +5% 伤害 / +5 防御，并解锁闪避与吸血；
 *  - 已升级状态 = 身上戴的是这一件，不需要额外的存档标记。
 */

import { CONFIG } from '../../../Common/Config.js';

const { ItemID, TileID } = Terraria.ID;

/** 取常量，取不到时回退到原版数字 ID（防止不同运行时版本字段名差异） */
function idOf(name, fallback) {
  const v = ItemID[name];
  return typeof v === 'number' ? v : fallback;
}

export class AwakenedWarriorGrowthCharm extends ModItem {
  SetDefaults() {
    this.Item.width = 32;
    this.Item.height = 32;
    this.Item.accessory = true;
    this.Item.rare = 8; // 紫色
    this.Item.value = Terraria.Item.buyPrice(0, 20, 0, 0);

    this.DisplayName = '战士成长饰品·觉醒';
    this.Tooltip = [
      '随 Boss 进度成长：每击败一个 Boss +1 防御 / +1% 伤害',
      '觉醒额外：+2% 减伤 / +5 伤害 / +5 防御',
      `闪避上限 ${(CONFIG.dodge.hardCap * 100).toFixed(0)}%（受伤前判定，命中则取消本次伤害）`,
      `吸血：命中回复实际伤害的 ${(CONFIG.lifesteal.percentOfActualDamage * 100).toFixed(0)}%，冷却 ${CONFIG.lifesteal.cooldownMs}ms`,
    ].join('\n');
  }

  AddRecipes() {
    const recipe = this.CreateRecipe();
    // 消耗基础款
    recipe.AddIngredient(ModContent.ItemType('WarriorGrowthCharm'), 1);
    // 神圣锭 + 三魂（数量在 Config.upgrade.materials 里）
    for (const m of CONFIG.upgrade.materials) {
      const amount = m.amount;
      if (m.key === 'hallowedBar') recipe.AddIngredient(idOf('HallowedBar', 122), amount);
      if (m.key === 'soulOfMight') recipe.AddIngredient(idOf('SoulofMight', 524), amount);
      if (m.key === 'soulOfSight') recipe.AddIngredient(idOf('SoulofSight', 523), amount);
      if (m.key === 'soulOfFright') recipe.AddIngredient(idOf('SoulofFright', 525), amount);
    }
    recipe.AddTile(TileID.MythrilAnvil).Register();
  }
}

export default AwakenedWarriorGrowthCharm;