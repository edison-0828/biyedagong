import { contacts, record } from './business.js';
import { button, card, money } from './ui.js';

const meals = {
  bun: { name: '热包子', cost: 18, relief: 24 },
  rice: { name: '鸡腿便当', cost: 42, relief: 55 },
  noodles: { name: '牛肉面', cost: 58, relief: 75 },
};
const goods = {
  shoes: { name: '慢跑鞋', cost: 240, detail: '运动时少消耗 5 点体力。' },
  bedding: { name: '舒适床品', cost: 320, detail: '进入下一日时多恢复 15 点体力。' },
};
const stocks = {
  coffee: { name: '街角咖啡', prices: [36, 39, 38, 35, 42, 40, 44] },
  sport: { name: '青禾运动', prices: [52, 49, 54, 57, 50, 55, 53] },
};
const tabs = { contacts: '联系人', stocks: '股票', shopping: '购物', delivery: '外卖' };
const stockPrice = (game, stock) => stock.prices[(game.day - 1) % stock.prices.length];
const line = (label, value) => '<div class="line"><span>' + label + '</span><b>' + value + '</b></div>';

export const restRecovery = game => 45 + (game.items.bedding ? 15 : 0);

export function nextDay(game) {
  game.day++;
  game.energy = Math.min(100, game.energy + restRecovery(game));
}

export function usePhone(game, action, id) {
  let label;
  let amount;
  if (action === 'meal') {
    const meal = meals[id];
    if (!meal || !game.hunger || game.cash < meal.cost) return '';
    game.hunger = Math.max(0, game.hunger - meal.relief);
    label = '外卖 · ' + meal.name;
    amount = -meal.cost;
  } else if (action === 'item') {
    const item = goods[id];
    if (!item || game.items[id] || game.cash < item.cost) return '';
    game.items[id] = true;
    label = '购物 · ' + item.name;
    amount = -item.cost;
  } else if (action === 'buy' || action === 'sell') {
    const stock = stocks[id];
    if (!stock) return '';
    const price = stockPrice(game, stock);
    const holding = game.shares[id] ?? 0;
    const buying = action === 'buy';
    if (buying ? game.cash - price < meals.bun.cost : !holding) return '';
    game.shares[id] = holding + (buying ? 1 : -1);
    label = (buying ? '买入 · ' : '卖出 · ') + stock.name;
    amount = buying ? -price : price;
  } else return '';
  const lines = [];
  record(game, lines, label, amount);
  game.ledger.unshift({ week: game.week, label, lines });
  return label + '已完成。';
}

export function phoneScreen(game, active, locked, socialOpen) {
  const nav = '<div class="phone-apps">' + Object.entries(tabs).map(([id, title]) =>
    '<button type="button" class="btn" data-action="phoneapp-' + id + '" aria-pressed="' + (active === id) + '">' + title + '</button>'
  ).join('') + '</div>';
  let content;
  if (active === 'contacts') {
    content = Object.entries(contacts).map(([id, contact]) => card('<h3>' + contact.label + '</h3>' +
      line('好感', (game.relationships[id] ?? 0) + '/100') +
      (socialOpen ? button('去约见', 'meet-' + id) : ''))).join('');
  } else if (active === 'delivery') {
    content = '<p class="hint">当前饥饿 ' + game.hunger + '/100。</p>' + Object.entries(meals).map(([id, meal]) =>
      card('<h3>' + meal.name + '</h3>' + line('价格 / 降低饥饿', money(meal.cost) + ' / ' + meal.relief) +
        (!locked && game.hunger && game.cash >= meal.cost ? button('点外卖', 'meal-' + id, true) :
          '<p>' + (locked ? '本周结算后可下单。' : game.hunger ? '现金不足。' : '现在不饿。') + '</p>'))).join('');
  } else if (active === 'shopping') {
    content = Object.entries(goods).map(([id, item]) => card('<h3>' + item.name + '</h3><p>' + item.detail + '</p>' +
      line('价格', money(item.cost)) + (game.items[id] ? '<p>已拥有。</p>' :
        !locked && game.cash >= item.cost ? button('购买', 'item-' + id, true) :
          '<p>' + (locked ? '本周结算后可购买。' : '现金不足。') + '</p>'))).join('');
  } else {
    content = '<p class="hint">模拟股票使用游戏内现金。日期推进后，股价会变动。</p>' + Object.entries(stocks).map(([id, stock]) => {
      const price = stockPrice(game, stock);
      return card('<h3>' + stock.name + '</h3>' + line('股价 / 持有', money(price) + ' / ' + (game.shares[id] ?? 0) + ' 股') +
        (locked ? '<p>本周结算后可交易。</p>' : '<div class="phone-trades">' +
          (game.cash - price >= meals.bun.cost ? button('买入 1 股', 'buy-' + id) : '') +
          (game.shares[id] ? button('卖出 1 股', 'sell-' + id) : '') + '</div>'));
    }).join('');
  }
  return '<h2>手机</h2>' + nav + content;
}
