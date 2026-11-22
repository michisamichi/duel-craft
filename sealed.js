// SAHOVERSE sealed battle — local deck construction from a fresh, isolated pack pool.
// No online rule changes: the saved deck enters the existing duel engine unchanged.
import {CARD,summonKind} from './cards.js?v=2022';
import {cardLimit} from './rules.js?v=2022';
import {openPack} from './packs.js?v=2022';

export const SEALED_STORAGE_KEY='duel-sealed-v1';
const MAX_PACKS=30;
export function allowedSealedCopies(id){
  const c=CARD[id];return c?Math.min(3,cardLimit(c)):0;
}
export function sealedCapacity(pool){
  return Object.entries(pool||{}).reduce((n,[id,qty])=>
    n+(CARD[id]&&summonKind(CARD[id])!=='fusion'?Math.min(Math.max(0,Number(qty)||0),allowedSealedCopies(id)):0),0);
}
export function sealedPoolFromPacks(pack,deckSize,rand=Math.random){
  const count=Math.max(1,Math.min(60,Math.floor(Number(deckSize)||40)));
  const size=Math.max(1,Math.min(10,Number(pack?.size)||5));
  const minPacks=Math.max(1,Math.ceil(count*1.5/size));
  if(minPacks>MAX_PACKS)throw Error('1パックの枚数が少なすぎます。パックを編集してください。');
  const chosen=[];
  let packsOpened=0,capacity=0;
  const pool=Object.create(null);
  while(packsOpened<MAX_PACKS){
    const drawn=openPack(pack,rand);
    chosen.push(...drawn);
    for(const id of drawn)pool[id]=(pool[id]||0)+1;
    packsOpened++;
    if(packsOpened>=minPacks){capacity=sealedCapacity(pool);if(capacity>=count)break;}
  }
  if(capacity<count)throw Error(`このパックでは${count}枚の有効なデッキを作れません。収録種類を増やしてください。`);
  return {version:1,packId:pack.id,packName:String(pack.name||'パック').slice(0,30),pool:{...pool},drawn:chosen,
    packCount:packsOpened,createdAt:Date.now(),draftCounts:{},draftExtraCounts:{},draftName:`パック戦 ${new Date().toLocaleDateString('ja-JP')}`.slice(0,28)};
}
export function normalizeSealedSession(raw){
  if(!raw||raw.version!==1||!raw.pool||typeof raw.pool!=='object'||Array.isArray(raw.pool))return null;
  if(!Array.isArray(raw.drawn)||raw.drawn.length>300||Object.keys(raw.pool).length>300)return null;
  const pool=Object.create(null);
  for(const [id,n] of Object.entries(raw.pool)){
    if(!CARD[id]||!Number.isInteger(n)||n<1||n>300)return null;
    pool[id]=n;
  }
  const counts=Object.create(null),extra=Object.create(null);
  for(const [dst,src] of [[counts,raw.draftCounts||{}],[extra,raw.draftExtraCounts||{}]]){
    if(!src||typeof src!=='object'||Array.isArray(src)||Object.keys(src).length>100)return null;
    for(const [id,n] of Object.entries(src)){
      if(!CARD[id]||!Number.isInteger(n)||n<1||n>Math.min(pool[id]||0,allowedSealedCopies(id)))continue;
      dst[id]=n;
    }
  }
  return {...raw,pool:{...pool},draftCounts:{...counts},draftExtraCounts:{...extra},draftName:String(raw.draftName||'パック戦').slice(0,28)};
}
