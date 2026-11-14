export const jobs = {
  starter: { name: '咖啡店学徒', wage: 1570, requirements: {} },
  barista: { name: '独立咖啡师', wage: 2300, requirements: { skill: 2, social: 1 } },
  lead: { name: '精品店领班', wage: 3200, requirements: { skill: 4, social: 2, fitness: 2 } },
};

export const skillNames = { skill: '手艺', social: '沟通', fitness: '体能' };
export const currentJob = game => jobs[game.job] ?? jobs.starter;
export const careerStarted = game => game.week > 1;
export const canTryStall = game => game.job !== 'starter' || game.trials > 0;

export const shifts = {
  study: { label: '认真上班', bonus: 0, energy: -12, hunger: 12, gains: { skill: 1 }, detail: '手艺 +1。' },
  overtime: { label: '加班攒钱', bonus: 650, energy: -23, hunger: 20, gains: { skill: 1 }, detail: '手艺 +1，额外赚 ¥650。' },
  stall: { label: '周末摆摊', bonus: 0, energy: -16, hunger: 15, detail: '花 ¥320 买原料，试卖并认识熟客。' },
};

export const contacts = {
  mentor: { label: '陈师傅', detail: '约师傅喝咖啡，聊聊店里的事。', fee: 80, energy: -9, hunger: 10, gains: { social: 1 }, affinity: 8 },
  classmate: { label: '林晓', detail: '和同学逛市集，聊聊毕业后的生活。', fee: 120, energy: -10, hunger: 11, gains: { social: 1 }, affinity: 12 },
  owner: { label: '许老板', detail: '请街坊店主喝茶，聊聊附近的生意。', fee: 220, energy: -13, hunger: 14, gains: { social: 2 }, affinity: 10 },
};

export const exercises = {
  run: { label: '公园慢跑', detail: '沿河跑一圈。', fee: 0, energy: -14, hunger: 16, gains: { fitness: 1, health: 3 } },
  gym: { label: '健身房训练', detail: '买一次训练票，做力量和有氧。', fee: 160, energy: -22, hunger: 22, gains: { fitness: 2, health: 6 } },
};

export function weekActivity(plan) {
  if (plan.contact) return contacts[plan.contact];
  if (plan.exercise) return exercises[plan.exercise];
  if (plan.id === 'rest') return { label: '休息', energy: 29, hunger: 0 }; // Older saved plans.
  return shifts[plan.id];
}

export const shopWorkload = { energy: -18, hunger: 17 };
export const energyChange = (game, plan, activity = weekActivity(plan)) =>
  activity.energy + (plan.exercise && game.items.shoes ? 5 : 0);

export function needsReason(game, energy, hunger) {
  if (game.energy + energy < 0) return '体力不足，先休息到下一日。';
  if (game.hunger + hunger > 100) return '太饿了，先去手机点外卖。';
  return '';
}

export function activityReason(game, plan) {
  if (!plan.contact && !plan.exercise) return actionReason(game, plan.id);
  const activity = weekActivity(plan);
  if (!activity || game.shop || !careerStarted(game)) return '当前无法安排这项活动。';
  if (game.cash < activity.fee) return '现金不足。';
  return needsReason(game, energyChange(game, plan, activity), activity.hunger);
}

export function jobReason(game, id) {
  if (game.shop || !Object.hasOwn(jobs, id)) return '当前无法换工作。';
  const order = Object.keys(jobs);
  if (id === game.job) return '当前工作';
  if (order.indexOf(id) < order.indexOf(game.job)) return '已超过这个岗位。';
  if (order.indexOf(id) !== order.indexOf(game.job) + 1) return '先完成上一阶段的工作。';
  const missing = Object.entries(jobs[id].requirements)
    .filter(([key, value]) => (game[key] ?? 0) < value)
    .map(([key, value]) => skillNames[key] + ' ' + value);
  return missing.length ? '还需要 ' + missing.join('、') + '。' : '';
}

export function changeJob(game, id) {
  if (jobReason(game, id)) return false;
  game.job = id;
  return true;
}

export const leases = {
  alley: { name: '小巷拐角', cost: 3700, rent: 570, visitors: 48, capacity: 78, detail: '租金低，靠熟客慢慢做起来。' },
  street: { name: '车站街口', cost: 6200, rent: 1060, visitors: 96, capacity: 105, detail: '通勤客多，开业投入更高。' },
};

export const menus = {
  coffee: { name: '手冲咖啡', cost: 6, price: 19, demand: 1, skill: 0, detail: '原料便宜，适合先做回头客。' },
  combo: { name: '咖啡 + 司康', cost: 10, price: 29, demand: .94, skill: 2, detail: '需要手艺 2。客单价更高。' },
};

const livingCost = 880;
export const newGame = () => ({
  week: 1, day: 1, cash: 950, energy: 70, hunger: 15, health: 75, skill: 0, social: 0, fitness: 0,
  relationships: {}, items: {}, shares: {},
  job: 'starter', regulars: 0, trials: 0, shop: null, ledger: [], last: null,
});

export function actionReason(game, id) {
  const shift = shifts[id];
  if (!shift || game.shop) return '当前无法安排这项活动。';
  if (!careerStarted(game) && id !== 'study') return '先完成第一周工作。';
  if (id === 'stall' && !canTryStall(game)) return '成为独立咖啡师后开放试卖。';
  if (id === 'stall' && game.cash < 320) return '摆摊需要先准备 ¥320 原料费。';
  return needsReason(game, shift.energy, shift.hunger);
}

export function leaseReason(game, id) {
  const lease = leases[id];
  if (!lease || game.shop) return '店面已选定。';
  if (!canTryStall(game)) return '成为独立咖啡师后开放创业准备。';
  if (game.trials < 1) return '先完成一次周末试卖。';
  if (game.cash < lease.cost + 900) return '签约后需要留出 ¥900 周转金。';
  return '';
}

export function record(game, lines, label, amount) {
  lines.push({ label, amount });
  game.cash += amount;
}

export function openShop(game, id) {
  if (leaseReason(game, id)) return false;
  const lease = leases[id];
  const lines = [];
  record(game, lines, '签约与设备 · ' + lease.name, -lease.cost);
  game.ledger.unshift({ week: game.week, label: '开店', lines });
  game.shop = { lease: id, weeks: 0, equipment: 0 };
  return true;
}

export function weeklyQuote(game, menuId, priceMode, partTime) {
  const lease = leases[game.shop.lease];
  const menu = menus[menuId];
  const price = menu.price + (priceMode === 'premium' ? 5 : priceMode === 'value' ? -3 : 0);
  const demand = Math.floor((lease.visitors + game.regulars * 2 + game.skill * 4) * menu.demand *
    (priceMode === 'premium' ? .73 : priceMode === 'value' ? 1.24 : 1));
  const capacity = Math.floor((lease.capacity + game.shop.equipment * 20) * (partTime ? .68 : 1));
  return { price, demand, capacity, sales: Math.min(demand, capacity), cost: menu.cost, rent: lease.rent };
}

export function settleWeek(game, plan) {
  const lines = [];
  const week = game.week;
  if (game.shop) {
    game.energy = Math.max(0, game.energy + shopWorkload.energy);
    game.hunger = Math.min(100, game.hunger + shopWorkload.hunger);
    const quote = weeklyQuote(game, plan.menu, plan.price, plan.partTime);
    record(game, lines, '咖啡店营业额', quote.sales * quote.price);
    record(game, lines, '食材与耗材', -quote.sales * quote.cost);
    record(game, lines, '店面周租', -quote.rent);
    if (plan.partTime) record(game, lines, '兼职收入', 950);
    game.shop.weeks++;
    game.regulars += Math.max(0, Math.floor(quote.sales / 17) - (quote.demand > quote.capacity ? 1 : 0));
    game.last = { kind: 'shop', ...quote, profit: quote.sales * (quote.price - quote.cost) - quote.rent };
  } else {
    const shift = weekActivity(plan);
    record(game, lines, currentJob(game).name + '工资', currentJob(game).wage + (shift.bonus ?? 0));
    if (shift.fee) record(game, lines, (plan.contact ? '社交 · ' : '运动 · ') + shift.label, -shift.fee);
    game.energy = Math.max(0, Math.min(100, game.energy + energyChange(game, plan, shift)));
    game.hunger = Math.min(100, game.hunger + shift.hunger);
    for (const [key, gain] of Object.entries(shift.gains ?? {})) {
      game[key] = key === 'health' ? Math.min(100, game[key] + gain) : game[key] + gain;
    }
    if (plan.contact) {
      const previous = game.relationships[plan.contact] ?? 0;
      game.relationships[plan.contact] = Math.min(100, previous + shift.affinity);
    }
    if (plan.id === 'stall') {
      const sales = Math.min(35, 15 + game.skill * 4 + game.regulars);
      record(game, lines, '试卖原料', -320);
      record(game, lines, '试卖收入', sales * 24);
      game.trials++;
      game.regulars += Math.floor(sales / 5);
      game.last = { kind: 'stall', sales, profit: sales * 24 - 320 };
    }
  }
  record(game, lines, '房租和生活费', -livingCost);
  game.ledger.unshift({ week, label: game.shop ? '营业结算' : '打工结算', lines });
  game.week++;
  game.day += 7;
}
