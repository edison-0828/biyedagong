import { actionReason, activityReason, canTryStall, careerStarted, changeJob, contacts, currentJob, energyChange, exercises, jobReason, jobs, leaseReason, leases, menus, needsReason, newGame, openShop, settleWeek, shifts, shopWorkload, skillNames, weekActivity, weeklyQuote } from './business.js';
import { createGameClock, weekDuration } from './game-clock.js';
import { applyAudioSettings, playEffect, readAudioSettings, refreshAudioVisibility, unlockAudio, writeAudioSettings } from './audio.js';
import { button, card, confirm, dismiss, el, money, selectChoice } from './ui.js';
import { nextDay, phoneScreen, restRecovery, usePhone } from './phone.js';

const saveKey = 'after-graduation-v1';
let game = newGame();
let plan = null;
let tab = 'work';
let phoneApp = 'contacts';
let scene = 'title';
let status = '';
const sound = readAudioSettings();
applyAudioSettings(sound);
try {
  const saved = JSON.parse(localStorage.getItem(saveKey));
  if (saved?.game && Array.isArray(saved.game.ledger)) {
    game = { ...newGame(), ...saved.game };
    game.day = saved.game.day ?? 1 + (game.week - 1) * 7;
    plan = saved.plan;
    if (plan?.id === 'socialize') plan = { contact: 'mentor' };
    if (plan?.id === 'exercise') plan = { exercise: 'run' };
  }
} catch {}
const hasSave = () => Boolean(game.ledger.length || plan);
const disabled = (label) => '<button class="btn" type="button" disabled>' + label + '</button>';
const line = (label, value) => '<div class="line"><span>' + label + '</span><b>' + value + '</b></div>';
const icon = name => '<i class="pixel-icon icon-' + name + '" aria-hidden="true"></i>';
const sectionTitle = (name, title) => '<h2 class="section-title">' + icon(name) + title + '</h2>';
const stat = (label, value) => '<span class="stat"><span>' + label + '</span><b>' + value + '</b></span>';
const workload = (energy, hunger) => line('体力 / 饥饿', energy + ' / +' + hunger);

function persist() {
  try { localStorage.setItem(saveKey, JSON.stringify({ game, plan })); }
  catch { status = '保存失败，请检查浏览器存储。'; }
}

const clock = createGameClock({
  canRun: () => scene === 'game' && Boolean(plan) && !document.hidden && !el('dialog').open,
  paydayRisk: () => false,
  advanceWeek() {
    const working = !game.shop;
    settleWeek(game, plan);
    plan = null;
    status = working ? '本周工资与开支已入账。' : '本周营业已结算。';
    if (game.shop?.weeks === 1) playEffect('release');
    persist();
    render();
    return false;
  },
  onPauseChange: render,
});

function queue(next) {
  if (plan) return;
  status = '';
  plan = next;
  tab = 'work';
  el('screen').scrollTop = 0;
  clock.resetElapsed();
  clock.resume();
  persist();
  render();
}

function work() {
  const hero = '<div class="hero"><span>' + (game.shop ? '店主' : currentJob(game).name) + '</span></div>';
  if (plan) return hero + card('<h2>第 ' + game.week + ' 周进行中</h2><p>' +
    (game.shop ? menus[plan.menu].name + ' · 正在营业' : weekActivity(plan).label) +
    '</p><progress id="week-progress" max="' + weekDuration + '" value="' + clock.elapsed + '" aria-label="本周进度"></progress>' +
    button(clock.pauseReason ? '继续本周' : '暂停', 'pause'));
  if (game.shop) return hero + shop();
  const choices = Object.entries(shifts).filter(([id]) =>
    careerStarted(game) ? id !== 'stall' || canTryStall(game) : id === 'study'
  ).map(([id, shift]) => {
    const reason = actionReason(game, id);
    return card('<h3>' + shift.label + '</h3><p>' + shift.detail + '</p>' +
      line('本周工资', money(currentJob(game).wage + shift.bonus)) + workload(shift.energy, shift.hunger) +
      (reason ? '<p class="muted">' + reason + '</p>' : button('安排本周', 'work-' + id)));
  }).join('');
  const summary = game.last?.kind === 'stall' ? card('<h3>最近一次试卖</h3>' +
    line('卖出', game.last.sales + ' 杯') + line('试卖净收入', money(game.last.profit))) : '';
  const career = careerStarted(game) ? card(line('基础周薪', money(currentJob(game).wage)) +
    button('查看岗位与涨薪条件', 'tab-careers', true)) : '';
  return hero + sectionTitle('work', '安排这一周') + '<p class="hint">每周生活费 ¥880。</p>' + career + summary + choices;
}

function activityScreen(kind, options) {
  const isSocial = kind === 'contact';
  return sectionTitle(isSocial ? 'social' : 'sports', isSocial ? '约谁见面？' : '选一项运动') +
    '<p class="hint">本周照常领工资，活动费用计入账本。</p>' +
    Object.entries(options).map(([id, activity]) => {
      const reason = plan ? '本周已有安排。' : activityReason(game, { [kind]: id });
      const gains = activity.gains;
      return card('<div class="activity-heading"><h3>' + activity.label + '</h3><span class="price">' +
        (activity.fee ? money(activity.fee) : '免费') + '</span></div><p>' + activity.detail + '</p>' +
        (isSocial ? line('当前好感 / 本次增加', (game.relationships[id] ?? 0) + '/100 · +' + activity.affinity) +
          line('沟通', '+' + gains.social) : line('体能 / 健康', '+' + gains.fitness + ' / +' + gains.health)) +
        workload(energyChange(game, { [kind]: id }, activity), activity.hunger) +
        (reason ? '<p>' + reason + '</p>' : button(isSocial ? '约见' + activity.label : '安排训练', kind + '-' + id, true)));
    }).join('');
}

function shop() {
  const lease = leases[game.shop.lease];
  const needs = needsReason(game, shopWorkload.energy, shopWorkload.hunger);
  const result = game.last?.kind === 'shop' ? card('<h3>' + (game.shop.weeks === 1 && game.last.profit >= 0 ? '第一笔店租已靠营业赚回' : '上周营业') +
    '</h3>' + line('售出', game.last.sales + ' 份') + line('店面净收益', money(game.last.profit)) +
    (game.last.demand > game.last.capacity ? '<p>有 ' + (game.last.demand - game.last.capacity) + ' 位顾客没排到。</p>' : '')) : '';
  return sectionTitle('work', lease.name + '咖啡店') + result +
    card('<form id="shop-plan"><label>本周菜单<select name="menu">' + Object.entries(menus).map(([id, menu]) =>
      '<option value="' + id + '"' + (game.skill < menu.skill ? ' disabled' : '') + '>' +
      menu.name + (game.skill < menu.skill ? ' · 手艺 ' + menu.skill + ' 解锁' : '') + '</option>').join('') +
      '</select></label><label>定价<select name="price"><option value="standard">标准价</option><option value="value">亲民价</option><option value="premium">高价</option></select></label>' +
      '<label class="check"><input type="checkbox" name="partTime">兼做兼职 · 多赚 ¥950，少接部分顾客</label>' +
      '<div id="shop-quote"></div>' + workload(shopWorkload.energy, shopWorkload.hunger) +
      (needs ? '<p>' + needs + '</p>' : '<button class="btn primary" type="submit">开始营业</button>') + '</form>') +
    card('<h3>设备</h3><p>每次升级增加 20 份周接待量。</p>' +
      (game.shop.equipment >= 2 ? '<p>设备已升满。</p>' :
        game.cash < 2700 ? disabled('升级 ¥1,800 · 需预留 ¥900') : button('升级设备 · ¥1,800', 'upgrade')));
}

function careers() {
  return sectionTitle('work', '找一份更好的工作') + Object.entries(jobs).map(([id, job]) => {
    const reason = jobReason(game, id);
    const requirements = Object.entries(job.requirements).map(([key, target]) =>
      line(skillNames[key], Math.min(game[key], target) + ' / ' + target)).join('');
    return card('<h3>' + job.name + '</h3>' + line('基础周薪', money(job.wage)) +
      requirements + (reason || plan ? '<p>' + (reason || '本周结束后可换工作。') + '</p>' :
        button('申请入职', 'job-' + id, true)));
  }).join('') + (canTryStall(game) ? card(button('查看创业店面', 'tab-premises', true)) : '');
}

function premises() {
  if (game.shop) return card('<h2>' + leases[game.shop.lease].name + '</h2><p>已开业 ' + game.shop.weeks + ' 周。</p>' + button('回店营业', 'tab-work', true));
  return sectionTitle('premises', '找一间自己的店') + Object.entries(leases).map(([id, lease]) => {
    const reason = leaseReason(game, id) || (plan ? '本周结束后可签约。' : '');
    return card('<h3>' + lease.name + '</h3><p>' + lease.detail + '</p>' +
      line('签约与设备', money(lease.cost)) + line('每周租金', money(lease.rent)) +
      (reason ? '<p class="muted">' + reason + '</p>' : button('租下这里', 'lease-' + id, true)));
  }).join('');
}

function settings() {
  return sectionTitle('settings', '设置') + card('<label>总音量 <output id="volume-value">' + sound.volume +
    '%</output><input id="volume" type="range" min="0" max="100" value="' + sound.volume + '"></label>' +
    '<label class="check"><input id="effects" type="checkbox"' + (sound.effects ? ' checked' : '') + '>音效</label>' +
    '<label class="check"><input id="music" type="checkbox"' + (sound.music ? ' checked' : '') + '>背景音乐</label>' +
    button('试听', 'preview')) + card('<p>每次安排工作和结算时自动保存。</p>' + button('重新开始', 'restart'));
}

function render() {
  const screen = el('screen');
  screen.dataset.page = scene === 'title' ? 'title' : tab;
  if (scene === 'title') {
    el('header').innerHTML = '';
    el('nav').innerHTML = '';
    screen.innerHTML = '<section class="cover"><div class="hero"></div><div class="cover-copy">' +
      icon('work') + '<h1>打工攒个店</h1><p>先打工学手艺，攒钱开一间自己的咖啡店。</p>' +
      button(hasSave() ? '继续经营' : '开始游戏', 'enter', true) + '</div></section>';
    return;
  }
  el('header').innerHTML = '<div class="heading">' + icon('work') + '<strong>打工攒个店</strong><span>第 ' + game.week + ' 周 · 第 ' + game.day + ' 日</span></div>' +
    '<div class="stats' + (game.shop ? '' : ' career-stats') + '">' +
    stat('现金', money(game.cash)) + stat('体力', game.energy) + stat('饥饿', game.hunger + '/100') + stat('手艺', game.skill) +
    (game.shop ? stat('熟客', game.regulars) : stat('沟通', game.social) + stat('体能', game.fitness) + stat('健康', game.health)) +
    '</div>' +
    '<div class="daily-actions">' + (plan || game.energy === 100 ? disabled('下一日') : button('下一日 · 恢复 ' +
      Math.min(100 - game.energy, restRecovery(game)) + ' 体力', 'nextday')) +
    (game.hunger >= 60 ? button('去点外卖', 'food') : '') + '</div>' +
    (status ? '<p class="notice" role="status">' + status + '</p>' : '');
  const tabs = [['work', game.shop ? '营业' : '打工'],
    ...(game.shop ? [['premises', '店面']] : careerStarted(game) ? [['social', '社交'], ['sports', '运动']] : []),
    ['phone', '手机'], ['settings', '设置']];
  el('nav').innerHTML = tabs.map(([id, label]) => '<button type="button" class="nav-button" data-action="tab-' + id + '"' +
    (tab === id ? ' aria-current="page"' : '') + '>' + icon(id) + '<span>' + label + '</span></button>').join('');
  el('nav').style.setProperty('--tab-count', tabs.length);
  screen.innerHTML = ({work,careers,premises,settings,
    phone: () => phoneScreen(game, phoneApp, Boolean(plan), !game.shop && careerStarted(game)),
    social: () => activityScreen('contact', contacts), sports: () => activityScreen('exercise', exercises)})[tab]();
  updateQuote();
}

function readShopPlan(form) {
  const fields = new FormData(form);
  return { menu: fields.get('menu'), price: fields.get('price'), partTime: fields.has('partTime') };
}

function updateQuote() {
  const form = el('shop-plan');
  if (!form) return;
  const plan = readShopPlan(form);
  const quote = weeklyQuote(game, plan.menu, plan.price, plan.partTime);
  el('shop-quote').innerHTML = line('预计售出 / 售价', quote.sales + ' 份 / ' + money(quote.price)) +
    line('预计店面净收益', money(quote.sales * (quote.price - quote.cost) - quote.rent));
}

document.addEventListener('click', event => {
  const target = event.target.closest('button[data-action]');
  if (!target || target.disabled) return;
  clock.interact();
  const [action, value] = target.dataset.action.split('-');
  unlockAudio().then(ready => { if (ready) playEffect(action === 'preview' ? 'preview' : 'click'); });
  if (action === 'enter') { scene = 'game'; clock.start(); render(); }
  if (action === 'tab') { tab = value; el('screen').scrollTop = 0; render(); }
  if (action === 'food' || action === 'phoneapp') {
    phoneApp = action === 'food' ? 'delivery' : value;
    tab = 'phone';
    el('screen').scrollTop = 0;
    render();
  }
  if (action === 'nextday' && !plan && game.energy < 100) {
    nextDay(game);
    status = '休息了一晚，体力已恢复。';
    persist();
    render();
  }
  if (action === 'meet' && !game.shop && careerStarted(game)) {
    tab = 'social';
    render();
    el('screen').querySelector('[data-action="contact-' + value + '"]')?.focus();
  }
  if (['meal', 'item', 'buy', 'sell'].includes(action) && !plan) {
    const result = usePhone(game, action, value);
    if (result) {
      status = result;
      persist();
      render();
    }
  }
  if (action === 'work' && !plan && !actionReason(game, value)) queue({ id: value });
  if (action === 'contact' || action === 'exercise') {
    const activity = { [action]: value };
    if (!plan && !activityReason(game, activity)) queue(activity);
  }
  if (action === 'job' && !plan && !jobReason(game, value)) {
    const job = jobs[value];
    confirm('入职' + job.name + '？', '下一周起基础周薪为 ' + money(job.wage) + '。', () => {
      if (!changeJob(game, value)) return;
      status = '已入职 · ' + job.name;
      tab = 'work';
      persist();
      render();
    });
  }
  if (action === 'pause') clock.pauseReason ? clock.resume() : clock.pause('manual');
  if (action === 'lease' && !plan && !leaseReason(game,value)) {
    const lease = leases[value];
    confirm('签约' + lease.name + '？', '本次投入 ' + money(lease.cost) + '，每周租金 ' + money(lease.rent) + '。', () => {
      if (!openShop(game,value)) return;
      tab = 'work';
      status = '店面已签约，准备第一周营业。';
      persist();
      render();
    });
  }
  if (action === 'upgrade' && !plan && game.shop && game.shop.equipment < 2 && game.cash >= 2700) {
    game.cash -= 1800;
    game.shop.equipment++;
    game.ledger.unshift({week:game.week,label:'设备升级',lines:[{label:'咖啡设备',amount:-1800}]});
    persist();
    render();
  }
  if (action === 'restart') confirm('重新开始？','当前试玩进度会清空。', () => {
    game = newGame(); plan = null; status = ''; tab = 'work'; phoneApp = 'contacts';
    clock.resetElapsed(); clock.resume(); persist(); render();
  });
  if (action === 'choice') selectChoice(Number(value));
  if (action === 'dismiss') dismiss();
});

document.addEventListener('submit', event => {
  if (event.target.id !== 'shop-plan') return;
  event.preventDefault();
  if (!needsReason(game, shopWorkload.energy, shopWorkload.hunger)) queue(readShopPlan(event.target));
});
document.addEventListener('change', event => {
  if (event.target.closest('#shop-plan')) updateQuote();
  if (!['volume','effects','music'].includes(event.target.id)) return;
  sound.volume = Number(el('volume').value);
  sound.effects = el('effects').checked;
  sound.music = el('music').checked;
  applyAudioSettings(sound);
  writeAudioSettings(sound);
  el('volume-value').value = sound.volume + '%';
});
document.addEventListener('visibilitychange', () => {
  clock.resetFrame();
  if (document.hidden && plan) clock.pause('background');
  refreshAudioVisibility();
});

function updateProgress() {
  const progress = el('week-progress');
  if (progress) progress.value = clock.elapsed;
  requestAnimationFrame(updateProgress);
}
window.render_game_to_text = () => JSON.stringify({scene,tab,plan,paused:clock.pauseReason,...game});
window.advanceTime = clock.advanceTime;
render();
requestAnimationFrame(updateProgress);
