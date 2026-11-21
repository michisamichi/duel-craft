/** A small, declarative user effect-recipe library. No script execution, no engine extensions. */
import {validMonsterEffect} from './cards.js?v=1995';
import {isValidAbility,abilityText} from './rules.js?v=1995';

export const EFFECT_TEMPLATE_KEY='saho-effect-templates-v1';
export const EFFECT_TEMPLATE_LIMIT=40;
const MAX_BYTES=35000;
const MAX_NAME=32;
const MAX_ENTRY=1200;
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const COPY=x=>JSON.parse(JSON.stringify(x));
const ALLOWED_SPELL_KINDS=['normal','quick','continuous','equip','field'];

export function templateFromCard(card,name,id){
 const trimmed=typeof name==='string'?name.trim():'';
 if(!isObject(card)||!trimmed||trimmed.length>MAX_NAME||!['monster','spell','trap'].includes(card.type))return null;
 if(typeof id!=='string'||!/^et_[a-z0-9_]{1,40}$/.test(id))return null;
 const t={id,name:trimmed,type:card.type};
 if(card.type==='monster'){
  if(card.subtype!=='effect')return null;
  if(card.ability){if(!isValidAbility(card.ability,'monster'))return null;t.ability=COPY(card.ability);}
  else {if(!validMonsterEffect(card.monsterEffect))return null;t.monsterEffect=COPY(card.monsterEffect);}
 }else{
  if(card.type==='spell'){
   const kind=card.spellKind||'normal';
   if(!ALLOWED_SPELL_KINDS.includes(kind))return null;
   t.spellKind=kind;
  }
  if(!isValidAbility(card.ability,card.type,t.spellKind||'normal'))return null;
  t.ability=COPY(card.ability);
 }
 return JSON.stringify(t).length<=MAX_ENTRY?t:null;
}
export function isValidTemplate(t){
 if(!isObject(t)||typeof t.id!=='string'||typeof t.name!=='string')return false;
 const card={type:t.type,subtype:'effect',spellKind:t.spellKind,ability:t.ability,monsterEffect:t.monsterEffect};
 const check=templateFromCard(card,t.name,t.id);
 return !!check&&JSON.stringify(check)===JSON.stringify(t);
}
export function normalizeTemplates(data){
 if(!Array.isArray(data)||data.length>EFFECT_TEMPLATE_LIMIT)return null;
 const found=new Set(),output=[];
 for(const t of data){
  if(!isValidTemplate(t)||found.has(t.id))return null;
  found.add(t.id);output.push(COPY(t));
 }
 return JSON.stringify(output).length<=MAX_BYTES?output:null;
}
export function readTemplates(storage){
 try{
  const value=storage.getItem(EFFECT_TEMPLATE_KEY);
  if(!value||value.length>MAX_BYTES)return [];
  return normalizeTemplates(JSON.parse(value))||[];
 }catch{return [];}
}
export function saveTemplate(storage,card,name){
 const list=readTemplates(storage);
 if(list.length>=EFFECT_TEMPLATE_LIMIT)throw Error(`保存できる効果は${EFFECT_TEMPLATE_LIMIT}件までです`);
 // Stable short identifier; collision handling requires no additional persistent counter.
 const seed=Date.now().toString(36);
 let index=0,id;
 do{id=`et_${seed}_${(index++).toString(36)}`;}while(list.some(t=>t.id===id));
 const created=templateFromCard(card,name,id);
 if(!created)throw Error('効果の設定または名前が正しくありません。条件や数値を確認してください');
 const next=[...list,created];
 if(!normalizeTemplates(next))throw Error('登録できる効果データの上限を超えました');
 storage.setItem(EFFECT_TEMPLATE_KEY,JSON.stringify(next));
 return COPY(created);
}
export function deleteTemplate(storage,id){
 const list=readTemplates(storage),next=list.filter(t=>t.id!==id);
 if(next.length===list.length)return false;
 storage.setItem(EFFECT_TEMPLATE_KEY,JSON.stringify(next));return true;
}
export function canApplyTemplate(template,card){
 if(!isValidTemplate(template)||!isObject(card)||template.type!==card.type)return false;
 return card.type!=='spell'||(card.spellKind||'normal')===template.spellKind;
}
export function applyTemplate(card,template){
 if(!canApplyTemplate(template,card))throw Error('このカードの種類には適用できません');
 const next={...card};
 delete next.ability;delete next.monsterEffect;
 if(next.type==='monster')next.subtype='effect';
 if(template.ability){next.ability=COPY(template.ability);if(next.type!=='monster')delete next.effect;}
 else next.monsterEffect=COPY(template.monsterEffect);
 return next;
}
export function templateDescription(t){
 if(!isValidTemplate(t))return '';
 if(t.ability)return abilityText(t.ability);
 const e=t.monsterEffect;
 const n=e.amount!==undefined?`（${e.amount}）`:e.threshold!==undefined?`（ATK ${e.threshold}以上）`:'';
 const base={rocketAssault:'攻撃時の戦闘破壊・ダメージ防止＋相手ATK－500',fusionFromExtraPay5000:'5000LPを払いEXデッキから融合モンスターを特殊召喚',soloHandNoTribute:'手札が自身1枚ならリリース不要',doubleLightTribute:'光属性の上級召喚時に2体分のリリース',graveNamedScale:'墓地の指定名でATK変化',raceFieldGraveScale:'場・墓地の指定種族でATK変化',battleAttributeScale:'特定属性との戦闘時にATK変化',battleImmuneAtkThreshold:'戦闘破壊耐性',attributeFieldAura:'属性別の全体ATK変化',raceAuraGuard:'種族強化＋攻撃対象制限',returnOpponentOnFlip:'リバース時に相手モンスターを手札へ戻す',searchStatOnGrave:'フィールドから墓地へ送られた際に指定ATK/DEF以下をサーチ',millOpponentDeck:'リバース時のデッキ破棄',selfReturnHand:'自分エンドフェイズに自身を手札へ戻す',postAttackDefenseLock:'攻撃後に守備表示＋次の自分ターン終了まで手動変更不可',trapSuppression:'表側表示で罠の発動・効果を封じる'};
 return (base[e.code]||`${e.kind}・${e.code}`)+n;
}
