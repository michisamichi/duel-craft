/** SAHOVERSE local backup v1. Deliberately excludes room states, anonymous auth, and Firebase config. */
import {normalizeDeckStore} from './decks.js?v=194';
import {isSafeCustomCard} from './cards.js?v=194';
export const BACKUP_KEYS=[
 'duel-name','duel-compact','duel-deck','duel-decks-v4','duel-custom-cards',
 'duel-packs-v5','duel-rules-v5','duel-fx-settings','duel-appearance-v5',
 'duel-sealed-v1','saho-card-draft-v1','saho-deck-draft-v1'
];
const MAX_BACKUP=8*1024*1024;
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function makeBackup(storage){
 const data={};
 for(const key of BACKUP_KEYS){const v=storage.getItem(key);if(typeof v==='string')data[key]=v;}
 return {format:'SAHOVERSE_LOCAL_BACKUP',version:1,createdAt:new Date().toISOString(),data};
}
export function parseBackup(raw){
 if(typeof raw!=='string'||raw.length>MAX_BACKUP)throw Error('バックアップの容量が大きすぎます');
 let file;try{file=JSON.parse(raw);}catch{throw Error('JSONファイルを読み込めません');}
 if(!isRecord(file)||file.format!=='SAHOVERSE_LOCAL_BACKUP'||file.version!==1||!isRecord(file.data))throw Error('SAHOVERSEのバックアップではありません');
 if(Object.keys(file.data).some(k=>!BACKUP_KEYS.includes(k)))throw Error('未知の項目が含まれています');
 const data={};
 for(const [key,value] of Object.entries(file.data)){
   if(typeof value!=='string'||value.length>MAX_BACKUP)throw Error('保存形式が正しくありません');
   if(key!=='duel-name'&&key!=='duel-compact'){
     let v;try{v=JSON.parse(value);}catch{throw Error(`保存データが破損しています：${key}`);}
     if(key==='duel-decks-v4'&&!normalizeDeckStore(v))throw Error('デッキデータが不正です');
     if(key==='duel-custom-cards'){
       if(!isRecord(v)||Object.keys(v).length>300||Object.entries(v).some(([id,c])=>
         !/^(?:[a-z][0-9]{2}|u_[0-9a-f]{16,32})$/.test(id)||!isRecord(c)||c.id!==id||!isSafeCustomCard(c)))throw Error('カードデータが不正です');
     }
     if(key==='duel-packs-v5'&&(!isRecord(v)||!Array.isArray(v.packs)||v.packs.length>25||!isRecord(v.collection)))throw Error('パックデータが不正です');
     if(key==='saho-card-draft-v1'&&(!isRecord(v)||typeof v.id!=='string'||typeof v.type!=='string'))throw Error('カード下書きが不正です');
     if(key==='saho-deck-draft-v1'&&(!isRecord(v)||!isRecord(v.counts)||Object.keys(v.counts).length>60))throw Error('デッキ下書きが不正です');
   }
   data[key]=value;
 }
 return data;
}
/** Apply as a set; restore previous data on quota/error. Reconnect auth and room data are never touched. */
export function applyBackup(storage,data){
 if(!isRecord(data)||Object.keys(data).some(k=>!BACKUP_KEYS.includes(k)))throw Error('復元データが不正です');
 const before={};for(const key of BACKUP_KEYS)before[key]=storage.getItem(key);
 try{
   for(const key of BACKUP_KEYS){if(Object.hasOwn(data,key))storage.setItem(key,data[key]);else storage.removeItem(key);}
 }catch(e){
   for(const key of BACKUP_KEYS){try{if(before[key]===null)storage.removeItem(key);else storage.setItem(key,before[key]);}catch{}}
   throw Error('端末の空き容量が不足しているか、保存が許可されていません');
 }
}
