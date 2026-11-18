// オリジナルカード。データを追加すればカードプールを拡張できます。
export const CARDS = [
  {id:'m01',name:'紅蓮の剣士',type:'monster',level:4,atk:1800,def:1100,emoji:'⚔️',desc:'炎の剣で戦う勇敢な戦士。'},
  {id:'m02',name:'火山の番兵',type:'monster',level:4,atk:1600,def:1700,emoji:'🌋',desc:'熱い岩肌で敵の攻撃を防ぐ。'},
  {id:'m03',name:'焔の小竜',type:'monster',level:3,atk:1500,def:900,emoji:'🐉',desc:'小さくても強い炎の竜。'},
  {id:'m04',name:'陽炎の魔術師',type:'monster',level:4,atk:1700,def:1200,emoji:'🔥',desc:'幻影を操る炎の術師。'},
  {id:'m05',name:'赤銅の騎士',type:'monster',level:4,atk:1400,def:2000,emoji:'🛡️',desc:'鋼の盾で味方を守る。'},
  {id:'m06',name:'燃える狼',type:'monster',level:3,atk:1300,def:1000,emoji:'🐺',desc:'炎をまとう俊敏な狼。'},
  {id:'m07',name:'蒼海の騎士',type:'monster',level:4,atk:1750,def:1300,emoji:'🔱',desc:'青い海を守る剣士。'},
  {id:'m08',name:'深海の守護者',type:'monster',level:4,atk:1400,def:2100,emoji:'🐢',desc:'頑丈な甲羅を持つ守護者。'},
  {id:'m09',name:'しずくの精霊',type:'monster',level:3,atk:1200,def:1600,emoji:'💧',desc:'水流を自在に操る精霊。'},
  {id:'m10',name:'氷晶の剣士',type:'monster',level:4,atk:1900,def:800,emoji:'❄️',desc:'氷の刃で敵を切り裂く。'},
  {id:'m11',name:'真珠の魔導士',type:'monster',level:4,atk:1650,def:1600,emoji:'🪄',desc:'神秘的な真珠から力を得る。'},
  {id:'m12',name:'潮騒の海獣',type:'monster',level:3,atk:1500,def:1100,emoji:'🐬',desc:'大波と共に現れる海獣。'},
  {id:'m13',name:'灼熱の巨人',type:'monster',level:6,atk:2400,def:1800,emoji:'🗿',desc:'召喚にはモンスター1体のリリースが必要。'},
  {id:'m14',name:'炎翼の獅子',type:'monster',level:5,atk:2200,def:1600,emoji:'🦁',desc:'召喚にはモンスター1体のリリースが必要。'},
  {id:'m15',name:'深淵のクジラ',type:'monster',level:6,atk:2450,def:1900,emoji:'🐋',desc:'召喚にはモンスター1体のリリースが必要。'},
  {id:'m16',name:'白波の巨兵',type:'monster',level:5,atk:2100,def:2300,emoji:'🌊',desc:'召喚にはモンスター1体のリリースが必要。'},
  {id:'m17',name:'紅蓮王ドラゴン',type:'monster',level:8,atk:3000,def:2500,emoji:'🐲',desc:'召喚にはモンスター2体のリリースが必要。'},
  {id:'m18',name:'蒼天の海竜',type:'monster',level:8,atk:2900,def:2600,emoji:'🐉',desc:'召喚にはモンスター2体のリリースが必要。'},
  {id:'m19',name:'鉄のゴーレム',type:'monster',level:4,atk:1000,def:2200,emoji:'🤖',desc:'守備力に優れた鉄の巨人。'},
  {id:'m20',name:'風読みのフクロウ',type:'monster',level:2,atk:900,def:1400,emoji:'🦉',desc:'風の変化を読み取る。'},
  {id:'s01',name:'知恵の巻物',type:'spell',emoji:'📜',effect:'draw2',desc:'カードを2枚ドローする。'},
  {id:'s02',name:'回復の泉',type:'spell',emoji:'💚',effect:'heal1000',desc:'自分のLPを1000回復する。'},
  {id:'s03',name:'雷の一撃',type:'spell',emoji:'⚡',effect:'destroy',desc:'相手のモンスター1体を破壊する。'},
  {id:'s04',name:'勇気の紋章',type:'spell',emoji:'💪',effect:'boost500',desc:'自分の表側モンスター1体の攻撃力を、このターンだけ500上げる。'},
  {id:'s05',name:'火球の呪文',type:'spell',emoji:'☄️',effect:'burn800',desc:'相手に800ダメージを与える。'},
  {id:'t01',name:'緊急防御',type:'trap',emoji:'🛡️',effect:'negate',desc:'相手の攻撃時に任意発動。その攻撃を無効にする。'},
  {id:'t02',name:'逆襲の落とし穴',type:'trap',emoji:'🕳️',effect:'counterdestroy',desc:'相手の攻撃時に任意発動。攻撃したモンスターを破壊する。'},
  {id:'t03',name:'反撃の炎',type:'trap',emoji:'💥',effect:'counterburn',desc:'相手の攻撃時に任意発動。攻撃を無効にし、相手に700ダメージ。'},
];
export const CARD = Object.fromEntries(CARDS.map(c => [c.id,c]));

// 各デッキ40枚・同一カード3枚まで。
const RED_COUNTS = {
  m01:3,m02:3,m03:3,m04:3,m05:3,m06:3,
  m13:2,m14:2,m17:1,m19:1,
  s01:3,s02:2,s03:2,s04:2,s05:1,
  t01:2,t02:2,t03:2,
};
const BLUE_COUNTS = {
  m07:3,m08:3,m09:3,m10:3,m11:3,m12:3,
  m15:2,m16:2,m18:1,m20:1,
  s01:3,s02:2,s03:2,s04:2,s05:1,
  t01:2,t02:2,t03:2,
};
export const PRESETS = {
  red: {name:'紅蓮デッキ',counts:RED_COUNTS},
  blue:{name:'蒼海デッキ',counts:BLUE_COUNTS},
};
export function expandDeck(counts) {
  return Object.entries(counts).flatMap(([id,n])=>Array(Number(n)||0).fill(id));
}
export function validDeck(counts) {
  return Object.values(counts).reduce((a,b)=>a+Number(b||0),0)===40 &&
    Object.entries(counts).every(([id,n]) => !!CARD[id] && Number.isInteger(Number(n)) && n>=0 && n<=3);
}
export function copyPreset(id) { return {...PRESETS[id].counts}; }
export function shuffle(xs) {
  const a=[...xs]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;
}
