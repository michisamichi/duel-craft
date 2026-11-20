/** SAHOVERSE v1.9.22 — client-only, one-shot visual cues. Never mutates match state. */
let activeNodes = [];
let activeTimers = [];
function later(fn,ms){activeTimers.push(setTimeout(fn,ms));}
export function clearBoardCue(){
  for (const id of activeTimers)clearTimeout(id);
  activeTimers=[];
  for (const node of activeNodes)node.remove();
  activeNodes=[];
  document.querySelectorAll('.sv-cue-on,.sv-revive-on,.sv-impact-on,.sv-cue--summon,.sv-cue--spell,.sv-cue--trap,.sv-cue--effect,.sv-cue--set,.sv-lp-hit,.sv-lp-gain').forEach(node=>node.classList.remove('sv-cue-on','sv-revive-on','sv-impact-on','sv-cue--summon','sv-cue--spell','sv-cue--trap','sv-cue--effect','sv-cue--set','sv-lp-hit','sv-lp-gain'));
}
const point=node=>{const r=node.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};};
function visibleSlot(room,id,viewerSeat,actor){
  if(!id||!room?.players)return null;
  // For response events the actor might be the defending player; search both boards.
  const order=actor===0||actor===1?[actor,1-actor]:[0,1];
  for(const side of order){
    const p=room.players[side];if(!p)continue;
    const owner=side===viewerSeat?'mine':'opponent';
    for(const zone of ['monsters','backrow']){
      for(let i=0;i<5;i++){
        const item=p[zone]?.[i];
        if(item?.id!==id)continue;
        // Never visually expose an opposing set monster, spell or trap.
        if(owner==='opponent'&&(item.faceDown||item.pos==='set'))continue;
        const el=document.querySelector(`#view .slot[data-owner="${owner}"][data-zone="${zone}"][data-index="${i}"]`);
        if(el)return {el,side,owner,zone,index:i};
      }
    }
    if(p.field?.id===id&&(owner==='mine'||!p.field.faceDown)){
      const el=document.querySelector(`#view .field-slot[data-owner="${owner}"]`);
      if(el)return {el,side,owner,zone:'field',index:0};
    }
  }
  return null;
}
function lpCue(room,oldRoom,settings){
  if(!oldRoom?.players||!room?.players)return;
  for(let side=0;side<2;side++){
    const now=Number(room.players[side]?.lp),old=Number(oldRoom.players[side]?.lp);
    if(!Number.isFinite(now)||!Number.isFinite(old)||now===old)continue;
    // Both compact and expanded HUDs have .seat; there is exactly one per side.
    const seatEl=document.querySelector(`#view .seat[data-seat="${side}"]`);
    if(!seatEl)continue;
    const gain=now>old;
    if(settings.visuals)seatEl.classList.add(gain?'sv-lp-gain':'sv-lp-hit');
    if(settings.visuals){
      const label=document.createElement('span');label.className=`sv-lp-delta ${gain?'gain':'loss'}`;
      label.textContent=(gain?'+':'−')+Math.abs(now-old).toLocaleString('ja-JP');
      seatEl.append(label);activeNodes.push(label);
    }
  }
}
function streak(from,to){
  const a=point(from),b=point(to),dx=b.x-a.x,dy=b.y-a.y;
  const beam=document.createElement('div');beam.className='sv-attack-streak';
  beam.style.left=`${a.x}px`;beam.style.top=`${a.y}px`;
  beam.style.setProperty('--move-x',`${dx}px`);beam.style.setProperty('--move-y',`${dy}px`);
  beam.style.setProperty('--trail-angle',`${Math.atan2(dy,dx)}rad`);
  document.body.append(beam);activeNodes.push(beam);
}
/** Resolve all coordinates from real DOM slots. No card-image clones or permanent RAF loops. */
function slotEl(side,index,viewerSeat,zone='monsters'){
 if(![0,1].includes(side)||!Number.isInteger(index)||index<0||index>4)return null;
 return document.querySelector(`#view .slot[data-owner="${side===viewerSeat?'mine':'opponent'}"][data-zone="${zone}"][data-index="${index}"]`);
}
function spark(node,kind='normal'){
 if(!node)return;
 const family=['summon','spell','trap','effect','set'].includes(kind)?kind:'summon';
 if(kind==='revive'||kind==='impact')node.classList.add(kind==='revive'?'sv-revive-on':'sv-impact-on');
 else node.classList.add('sv-cue-on',`sv-cue--${family}`);
 const mark=document.createElement('span');
 mark.className=kind==='revive'?'sv-revive-rune':`sv-field-spark sv-field-spark--${family}`;
 mark.setAttribute('aria-hidden','true');node.append(mark);activeNodes.push(mark);
}
/** A set card is private. Only compare occupied zone positions: no ID/name is used. */
function setPosition(room,previousRoom,actor,viewerSeat){
 if(!previousRoom?.players||![0,1].includes(actor))return null;
 for(const zone of ['monsters','backrow'])for(let i=0;i<5;i++){
   if(!previousRoom.players[actor]?.[zone]?.[i] && room.players[actor]?.[zone]?.[i])
     return slotEl(actor,i,viewerSeat,zone);
 }
 return null;
}
function burst(el){
 if(!el)return;
 const where=point(el),node=document.createElement('span');
 node.className='sv-impact-burst';node.setAttribute('aria-hidden','true');
 node.style.left=`${where.x}px`;node.style.top=`${where.y}px`;
 document.body.append(node);activeNodes.push(node);
}
function graveTrace(from,side){
 const hud=document.querySelector(`#view .seat[data-seat="${side}"] .sv-grave-count`);
 if(!from||!hud)return;
 const a=point(from),b=point(hud),mark=document.createElement('span');
 mark.className='sv-grave-trace';mark.setAttribute('aria-hidden','true');
 mark.style.left=`${a.x}px`;mark.style.top=`${a.y}px`;
 mark.style.setProperty('--move-x',`${b.x-a.x}px`);mark.style.setProperty('--move-y',`${b.y-a.y}px`);
 document.body.append(mark);activeNodes.push(mark);
}
export function playBoardCue(event,room,viewerSeat,settings={},previousRoom=null){
 clearBoardCue();
 if(!event||!room||!settings.visuals||document.visibilityState==='hidden'||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 lpCue(room,previousRoom,settings);
 if(event.type==='set'){
   const target=setPosition(room,previousRoom,event.actor,viewerSeat);
   if(target)spark(target,'set'); // A subtle placement cue, never the hidden card identity.
   later(clearBoardCue,680);return;
 }
 if(event.type==='win'||event.type==='draw'){later(clearBoardCue,850);return;}
 if(event.type==='revive'){
   // Slot is public and only specified after the summon actually resolves.
   const target=slotEl(event.actor,event.slot,viewerSeat);
   if(target&&room.players[event.actor]?.monsters[event.slot]?.id===event.cardId)spark(target,'revive');
 }else if(event.type==='impact'){
   const attacker=slotEl(event.actor,event.slot,viewerSeat);
   const target=(event.target===null||event.target===-1)
      ?document.querySelector(`#view .seat[data-seat="${event.targetSeat}"] .lp`)
      :slotEl(event.targetSeat,event.target,viewerSeat);
   if(attacker&&target)streak(attacker,target);
   if(target){later(()=>{spark((event.target===null||event.target===-1)?null:target,'impact');burst(target);},270);}
   // Only animate a card going to grave when the confirmed board differs.
   if(previousRoom?.players){
     const pairs=[[event.actor,event.slot],[event.targetSeat,event.target]];
     for(const [side,i] of pairs){
       if(![0,1].includes(side)||!Number.isInteger(i))continue;
       if(previousRoom.players[side]?.monsters[i]&&!room.players[side]?.monsters[i]){
         const from=slotEl(side,i,viewerSeat);
         if(from)later(()=>graveTrace(from,side),380);
       }
     }
   }
 }else{
   const source=visibleSlot(room,event.cardId,viewerSeat,event.actor);
   if(source){
     spark(source.el,['summon','ritual','fusion'].includes(event.type)?'summon':['spell','trap','effect'].includes(event.type)?event.type:'normal');
     if(event.type==='attack'&&room.pending?.kind==='attack'){
       const attack=room.pending;
       const target=attack.target===null
         ?document.querySelector(`#view .seat[data-seat="${1-attack.by}"] .lp`)
         :slotEl(1-attack.by,attack.target,viewerSeat);
       if(target)streak(source.el,target);
     }
   }
 }
 later(clearBoardCue,980);
}
