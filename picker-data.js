export const COLOR_ROWS = [
  ['#000000','#434343','#666666','#999999','#b7b7b7','#cccccc','#d9d9d9','#efefef','#f3f3f3','#ffffff'],
  ['#980000','#ff0000','#ff9900','#ffff00','#00ff00','#00ffff','#4a86e8','#0000ff','#9900ff','#ff00ff'],
  ['#e6b8af','#f4cccc','#fce5cd','#fff2cc','#d9ead3','#d0e0e3','#c9daf8','#cfe2f3','#d9d2e9','#ead1dc'],
  ['#dd7e6b','#ea9999','#f9cb9c','#ffe599','#b6d7a8','#a2c4c9','#a4c2f4','#9fc5e8','#b4a7d6','#d5a6bd'],
  ['#cc4125','#e06666','#f6b26b','#ffd966','#93c47d','#76a5af','#6d9eeb','#6fa8dc','#8e7cc3','#c27ba0'],
  ['#a61c00','#cc0000','#e69138','#f1c232','#6aa84f','#45818e','#3c78d8','#3d85c6','#674ea7','#a64d79'],
  ['#85200c','#990000','#b45f06','#bf9000','#38761d','#134f5c','#1155cc','#0b5394','#351c75','#741b47'],
  ['#5b0f00','#660000','#783f04','#7f6000','#274e13','#0c343d','#1c4587','#073763','#20124d','#4c1130'],
];
export function normalizeColor(value) {
  const text = String(value).trim().toLowerCase().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(text)) return '#' + [...text].map(char => char + char).join('');
  return /^[0-9a-f]{6}$/.test(text) ? '#' + text : null;
}
export function readableInk(color) {
  const rgb = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
  return rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 155 ? '#202124' : '#ffffff';
}
// Insert after the selection, retaining existing text even when an entire field is selected.
export function insertEmojiText(value, emoji, caret = value.length) {
  const position = Math.max(0, Math.min(value.length, caret));
  return {value: value.slice(0, position) + emoji + value.slice(position), caret: position + emoji.length};
}
const groups = {
  'Smileys': [
    ['😀','grinning happy smile'],['😃','smile happy excited'],['😄','smiling happy laugh'],['😁','grin beaming smile'],['😆','laugh laughing'],['😅','sweat smile relieved'],['😂','tears joy laugh'],['🤣','rolling laughing'],['😊','blush smiling happy'],['🙂','smile slightly happy'],['😉','wink'],['😍','heart eyes love'],['🥰','love hearts smile'],['😘','kiss'],['😎','cool sunglasses'],['🤓','nerd glasses'],['🧐','curious monocle'],['🤔','thinking think idea'],['🤩','star struck wow excited'],['🥳','party celebration birthday'],['😴','sleep tired'],['😇','angel innocent'],['🤗','hug'],['🤭','giggle oops'],['🤫','quiet hush'],['😐','neutral'],['🙃','upside down smile'],['😬','grimace awkward'],['😮','surprise wow'],['😢','sad cry'],['😭','cry tears sad'],['😤','determined frustrated'],['🤯','mind blown wow'],['🥹','happy tears touched'],['🫠','melting'],['💪','strong muscle'],
  ],
  'People': [
    ['👋','wave hello goodbye'],['🤚','hand stop'],['👌','okay perfect'],['✌️','peace victory'],['🤞','crossed fingers luck'],['🤟','love you'],['👍','thumbs up yes good'],['👎','thumbs down no'],['👏','clap applause'],['🙌','celebrate hands hooray'],['🫶','heart hands love'],['🙏','thanks please pray'],['🤝','handshake agreement team'],['🧑‍💻','developer coder engineer computer'],['👩‍💻','woman developer engineer'],['👨‍💻','man developer engineer'],['🧑‍🎓','student graduate school'],['🧑‍🎨','artist design creative'],['🧑‍🔬','scientist science'],['🧑‍🚀','astronaut space'],['🏃','run runner'],['🚴','cycling bicycle'],['🧘','meditation yoga'],['👀','eyes look'],
  ],
  'Nature': [
    ['🌱','seedling growth plant'],['🌿','herb nature leaf'],['🍀','clover luck'],['🌳','tree nature'],['🌻','sunflower flower'],['🌸','cherry blossom flower'],['🌵','cactus plant'],['🍂','autumn leaf fall'],['🐶','dog puppy'],['🐱','cat kitten'],['🦊','fox'],['🐻','bear'],['🐼','panda'],['🐸','frog'],['🦋','butterfly'],['🐝','bee'],['🐢','turtle'],['🐙','octopus'],['🐬','dolphin'],['🌎','earth world globe'],['☀️','sun sunny'],['🌙','moon night'],['⭐','star favorite'],['✨','sparkles magic'],['🌈','rainbow'],['🔥','fire hot'],['❄️','snow winter'],['🌊','wave ocean water'],
  ],
  'Food': [
    ['☕','coffee cafe'],['🍵','tea'],['🧋','bubble tea boba'],['🥤','drink soda'],['🍕','pizza'],['🍔','burger hamburger'],['🌮','taco'],['🍣','sushi'],['🍜','ramen noodles'],['🥑','avocado'],['🍎','apple fruit'],['🍌','banana'],['🍓','strawberry'],['🍒','cherry'],['🍋','lemon'],['🥐','croissant'],['🍞','bread'],['🥞','pancakes breakfast'],['🍪','cookie'],['🍰','cake dessert'],['🎂','birthday cake'],['🍩','donut doughnut'],['🍫','chocolate'],['🍿','popcorn'],
  ],
  'Travel': [
    ['🚀','rocket launch space'],['✈️','airplane flight travel'],['🚗','car road trip'],['🚲','bicycle bike'],['🚆','train travel'],['⛵','boat sailing'],['🏠','home house'],['🏙️','city skyline'],['🏔️','mountain hiking'],['🏕️','camp camping'],['🏖️','beach holiday'],['🗺️','map travel'],['🧭','compass direction'],['🎒','backpack trip school'],['🏁','finish flag goal'],['🌅','sunrise'],['🌇','sunset'],['🛰️','satellite space'],['🏛️','museum building'],['🎡','ferris wheel'],['⚽','soccer football'],['🏀','basketball'],['🎾','tennis'],['⛷️','ski winter'],
  ],
  'Objects': [
    ['💻','laptop computer code'],['⌨️','keyboard typing'],['🖥️','desktop computer'],['📱','phone mobile'],['💡','idea light bulb'],['🔧','wrench tools build'],['🔨','hammer build'],['⚙️','gear engineering settings'],['🛠️','tools engineering build'],['📐','ruler triangle design'],['📏','ruler measure'],['🧪','test tube experiment science'],['🔬','microscope research'],['🔭','telescope space'],['📝','memo note write'],['📚','books study learn'],['📖','book reading'],['📊','bar chart data statistics'],['📈','growth chart increase'],['📉','chart decrease'],['📋','clipboard list'],['📁','folder projects'],['📂','open folder'],['📎','paperclip attachment'],['📅','calendar date'],['⏰','alarm clock time'],['⏱️','stopwatch time'],['🔗','link'],['🔒','lock secure'],['🔑','key'],['🎨','art design palette'],['🎯','target goal'],['🎉','party popper celebrate'],['🏆','trophy win achievement'],['🏅','medal award'],['💼','briefcase work experience'],['✉️','email contact envelope'],['📍','pin location'],['📷','camera photo'],['🎵','music note'],
  ],
  'Symbols': [
    ['❤️','heart red love'],['🧡','orange heart'],['💛','yellow heart'],['💚','green heart'],['💙','blue heart'],['💜','purple heart'],['🖤','black heart'],['🤍','white heart'],['✅','check done complete yes'],['☑️','checkbox check'],['❌','cross no cancel'],['❗','exclamation important'],['❓','question help'],['⚠️','warning caution'],['💯','hundred perfect'],['💬','speech comment chat'],['🔔','bell notification'],['📌','pin important'],['🔴','red circle'],['🟠','orange circle'],['🟡','yellow circle'],['🟢','green circle'],['🔵','blue circle'],['🟣','purple circle'],['⬆️','arrow up'],['⬇️','arrow down'],['⬅️','arrow left'],['➡️','arrow right'],['➕','plus add'],['➖','minus subtract'],['♾️','infinity'],['🔄','refresh repeat'],
  ],
};
export const EMOJI_CATEGORIES = Object.keys(groups);
export const EMOJIS = Object.entries(groups).flatMap(([category, entries]) => entries.map(([emoji, keywords]) => ({emoji, keywords, category})));
