// Премиум-эмодзи Telegram. ID берутся из набора кастомных эмодзи.
// В тег <tg-emoji emoji-id="..."> кладётся обычный эмодзи как fallback:
// пользователи без Telegram Premium увидят обычный, с Premium — анимированный кастомный.
// parse_mode должен быть HTML (используется по умолчанию в sendTelegramMessage).

export const TELEGRAM_PREMIUM_EMOJI = {
  eyes: { id: "5210956306952758910", fallback: "👀" },
  smile: { id: "5461117441612462242", fallback: "🙂" },
  lightning: { id: "5456140674028019486", fallback: "⚡️" },
  comet: { id: "5224607267797606837", fallback: "☄️" },
  ban: { id: "5260293700088511294", fallback: "⛔️" },
  prohibited: { id: "5240241223632954241", fallback: "🚫" },
  exclamation: { id: "5274099962655816924", fallback: "❗️" },
  doubleExclamation: { id: "5440660757194744323", fallback: "‼️" },
  interrobang: { id: "5314504236132747481", fallback: "⁉️" },
  question: { id: "5436113877181941026", fallback: "❓" },
  warning: { id: "5447644880824181073", fallback: "⚠️" },
  globe: { id: "5447410659077661506", fallback: "🌐" },
  speechBubble: { id: "5443038326535759644", fallback: "💬" },
  thought: { id: "5467538555158943525", fallback: "💭" },
  chart: { id: "5231200819986047254", fallback: "📊" },
  arrowUpTrend: { id: "5244837092042750681", fallback: "📈" },
  arrowDownTrend: { id: "5246762912428603768", fallback: "📉" },
  check: { id: "5206607081334906820", fallback: "✔️" },
  cross: { id: "5210952531676504517", fallback: "❌" },
  cool: { id: "5222079954421818267", fallback: "🆒" },
  bell: { id: "5458603043203327669", fallback: "🔔" },
  pin: { id: "5397782960512444700", fallback: "📌" },
  money: { id: "5409048419211682843", fallback: "💵" },
  play: { id: "5264919878082509254", fallback: "▶️" },
  redCircle: { id: "5411225014148014586", fallback: "🔴" },
  greenCircle: { id: "5416081784641168838", fallback: "🟢" },
  arrowRight: { id: "5416117059207572332", fallback: "➡️" },
  fire: { id: "5424972470023104089", fallback: "🔥" },
  boom: { id: "5276032951342088188", fallback: "💥" },
  megaphone: { id: "5424818078833715060", fallback: "📣" },
  search: { id: "5231012545799666522", fallback: "🔍" },
  shield: { id: "5251203410396458957", fallback: "🛡" },
  link: { id: "5271604874419647061", fallback: "🔗" },
  monitor: { id: "5282843764451195532", fallback: "🖥" },
  info: { id: "5334544901428229844", fallback: "ℹ️" },
  thumbsUp: { id: "5337080053119336309", fallback: "👍" },
  hundred: { id: "5341498088408234504", fallback: "💯" },
  refresh: { id: "5375338737028841420", fallback: "🔄" },
  top: { id: "5415655814079723871", fallback: "🔝" },
  new: { id: "5382357040008021292", fallback: "🆕" },
  soon: { id: "5440621591387980068", fallback: "🔜" },
  location: { id: "5391032818111363540", fallback: "📍" },
  plus: { id: "5397916757333654639", fallback: "➕" },
  diamond: { id: "5427168083074628963", fallback: "💎" },
  star: { id: "5438496463044752972", fallback: "⭐️" },
  sparkles: { id: "5325547803936572038", fallback: "✨" },
  crown: { id: "5217822164362739968", fallback: "👑" },
  trash: { id: "5445267414562389170", fallback: "🗑" },
  bookmark: { id: "5222444124698853913", fallback: "🔖" },
  envelope: { id: "5253742260054409879", fallback: "✉️" },
  lock: { id: "5296369303661067030", fallback: "🔒" },
  surprised: { id: "5303479226882603449", fallback: "😮" },
  paperclip: { id: "5305265301917549162", fallback: "📎" },
  gear: { id: "5341715473882955310", fallback: "⚙️" },
  gamepad: { id: "5361741454685256344", fallback: "🎮" },
  hourglass: { id: "5386367538735104399", fallback: "⌛" },
  sun: { id: "5402477260982731644", fallback: "☀️" },
  calendar: { id: "5413879192267805083", fallback: "🗓" },
  bulb: { id: "5422439311196834318", fallback: "💡" },
  gold1: { id: "5440539497383087970", fallback: "🥇" },
  silver2: { id: "5447203607294265305", fallback: "🥈" },
  bronze3: { id: "5453902265922376865", fallback: "🥉" },
  pencil: { id: "5395444784611480792", fallback: "✏️" },
  siren: { id: "5395695537687123235", fallback: "🚨" },
  home: { id: "5416041192905265756", fallback: "🏠" },
  flag: { id: "5460755126761312667", fallback: "🚩" },
  party: { id: "5461151367559141950", fallback: "🎉" },
} as const;

export type TelegramPremiumEmojiKey = keyof typeof TELEGRAM_PREMIUM_EMOJI;

/**
 * Возвращает HTML-разметку премиум-эмодзи с безопасным fallback.
 * Использовать только в сообщениях с parse_mode=HTML.
 */
export function tgEmoji(key: TelegramPremiumEmojiKey) {
  const emoji = TELEGRAM_PREMIUM_EMOJI[key];
  return `<tg-emoji emoji-id="${emoji.id}">${emoji.fallback}</tg-emoji>`;
}
