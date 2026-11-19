
/** SAHOVERSE / original lightweight audiovisual effects. All sounds are synthesized locally. */
export const VISUAL_CHOICES={auto:'自動（カード種類に合わせる）',flame:'炎撃',lightning:'雷閃',slash:'斬撃',aqua:'水流',shadow:'闇陣',star:'聖光',heal:'回復',ritual:'儀式の陣',fusion:'融合の渦',none:'演出なし'};
export const SOUND_CHOICES={auto:'自動（カード種類に合わせる）',slash:'剣撃音',spark:'雷鳴',boom:'衝撃音',chime:'魔法音',water:'水音',heal:'回復音',none:'音なし'};
const defaultSettings={visuals:true,sound:true,bgm:false,volume:55};
export function readFxSettings(){
  try{const data=JSON.parse(localStorage.getItem('duel-fx-settings')||'{}');return {
    visuals:data.visuals!==false,sound:data.sound!==false,bgm:data.bgm===true,
    volume:Number.isFinite(Number(data.volume))?Math.max(0,Math.min(100,Number(data.volume))):55,
  };}catch{return {...defaultSettings};}
}
export function writeFxSettings(value){const v={...defaultSettings,...value};try{localStorage.setItem('duel-fx-settings',JSON.stringify(v));}catch{}return v;}
let ctx=null;let latestSequence=0;
export function unlockAudio(){
  try{const Type=window.AudioContext||window.webkitAudioContext;if(!Type)return;
    if(!ctx)ctx=new Type();return ctx.state==='suspended'?ctx.resume().catch(()=>{}):Promise.resolve();
  }catch{}return Promise.resolve();
}
function selectedPreset(type,card){
  const fx=card?.fx||{};
  const title=String(card?.name||'')+String(card?.emoji||'');
  const inferred=type==='win'?'victory':type==='ritual'?'ritual':type==='fusion'?'fusion':
    type==='trap'?'shadow':type==='impact'||type==='attack'?'slash':
    /回復|泉|癒/.test(title)||card?.effect==='heal1000'?'heal':
    /雷|⚡/.test(title)?'lightning':/海|水|氷|蒼|しずく|潮|波|❄️|💧/.test(title)?'aqua':
    /炎|紅|火|焔|🔥|🌋/.test(title)?'flame':'star';
  const visual=type==='win'?'victory':VISUAL_CHOICES[fx.visual]&&fx.visual!=='auto'?fx.visual:inferred;
  const sound=SOUND_CHOICES[fx.sound]&&fx.sound!=='auto'?fx.sound:
    (type==='win'?'chime':type==='impact'||type==='attack'?'slash':visual==='aqua'?'water':visual==='heal'?'heal':
      visual==='lightning'?'spark':type==='trap'||visual==='flame'?'boom':'chime');
  return {visual,sound};
}
function tone(audio,frequency,start,duration,shape,gain,frequencyEnd){
  const osc=audio.createOscillator(),amp=audio.createGain();
  osc.type=shape||'sine';osc.frequency.setValueAtTime(frequency,start);
  if(frequencyEnd)osc.frequency.exponentialRampToValueAtTime(Math.max(20,frequencyEnd),start+duration);
  amp.gain.setValueAtTime(.0001,start);
  amp.gain.exponentialRampToValueAtTime(Math.max(.00011,gain),start+.015);
  amp.gain.exponentialRampToValueAtTime(.0001,start+duration);
  osc.connect(amp).connect(audio.destination);osc.start(start);osc.stop(start+duration+.018);
}
function noise(audio,start,duration,gain){
  const frames=Math.max(1,Math.ceil(audio.sampleRate*duration));
  const buffer=audio.createBuffer(1,frames,audio.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<frames;i++)data[i]=(Math.random()*2-1)*(1-i/frames);
  const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),amp=audio.createGain();
  source.buffer=buffer;filter.type='bandpass';filter.frequency.value=950;filter.Q.value=.6;
  amp.gain.value=gain;source.connect(filter).connect(amp).connect(audio.destination);source.start(start);source.stop(start+duration);
}
function playSynth(preset,volume){
  if(!ctx||ctx.state!=='running'||preset==='none'||volume<=0||document.visibilityState==='hidden')return;
  try{
    const at=ctx.currentTime+.012,v=Math.min(.28,.24*volume/100);
    switch(preset){
      case 'slash':tone(ctx,750,at,.17,'sawtooth',v,125);noise(ctx,at,.12,v*.5);break;
      case 'spark':tone(ctx,910,at,.10,'square',v*.37,420);tone(ctx,630,at+.08,.17,'triangle',v*.6,160);break;
      case 'boom':tone(ctx,185,at,.33,'triangle',v,46);noise(ctx,at,.23,v*.6);break;
      case 'chime':tone(ctx,523,at,.22,'sine',v);tone(ctx,784,at+.105,.27,'sine',v*.7);tone(ctx,1047,at+.21,.29,'sine',v*.4);break;
      case 'water':tone(ctx,405,at,.15,'sine',v*.65,650);tone(ctx,340,at+.13,.23,'sine',v*.5,550);break;
      case 'heal':tone(ctx,396,at,.24,'sine',v*.8,528);tone(ctx,528,at+.15,.28,'sine',v*.75,660);break;
    }
  }catch{}
}
const palettes={
  flame:{title:'炎の力',color:'#ff9b45'},lightning:{title:'雷鳴',color:'#9edaff'},
  slash:{title:'アタック！',color:'#ffc28e'},aqua:{title:'水の力',color:'#8fdfff'},
  shadow:{title:'罠が発動！',color:'#d7a2ff'},star:{title:'カード発動！',color:'#fce3a3'},
  heal:{title:'回復',color:'#a4f5bb'},ritual:{title:'儀式召喚',color:'#80d4ff'},fusion:{title:'融合召喚',color:'#d2a2ff'},victory:{title:'DUEL END',color:'#ffe19c'},none:{title:'',color:'#ffffff'},
};
function svgMarkup(visual,color){
  const c=color||'#ffffff';
  const common=`viewBox="0 0 128 128" class="fx-svg" aria-hidden="true"`;
  if(visual==='flame')return `<svg ${common}><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#ffd09d"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><circle cx="64" cy="64" r="53" fill="none" stroke="${c}" stroke-width="4" opacity=".45"/><path d="M64 14c8 16 17 24 17 39 0 11-7 18-10 24 1-9-4-15-10-22-6 7-16 15-16 31 0 16 10 28 27 28s31-12 31-31c0-26-18-44-39-69z" fill="url(#g)"/><path d="M64 43c4 8 11 13 11 24 0 10-8 17-18 17s-16-7-16-16c0-9 5-15 11-22 2 5 5 7 12 11z" fill="#fff8d8" opacity=".9"/></svg>`;
  if(visual==='lightning')return `<svg ${common}><circle cx="64" cy="64" r="52" fill="none" stroke="${c}" stroke-width="4" opacity=".4"/><path d="M77 15 36 71h23l-8 42 41-56H68z" fill="${c}"/><path d="M83 21 49 68h17l-5 28 26-38H68z" fill="#fff7cf" opacity=".85"/></svg>`;
  if(visual==='slash')return `<svg ${common}><circle cx="64" cy="64" r="50" fill="none" stroke="${c}" stroke-width="4" opacity=".35"/><g stroke="${c}" stroke-width="10" stroke-linecap="round"><path d="M28 92 86 29"/><path d="M42 103 100 40" opacity=".75"/><path d="M20 78 78 15" opacity=".5"/></g></svg>`;
  if(visual==='aqua')return `<svg ${common}><circle cx="64" cy="64" r="51" fill="none" stroke="${c}" stroke-width="4" opacity=".35"/><path d="M18 79c12-10 23-14 34-14s20 7 29 7 17-2 29-10" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/><path d="M23 55c10-8 18-11 28-11 11 0 20 7 29 7 9 0 18-3 27-11" fill="none" stroke="#dffbff" stroke-width="6" stroke-linecap="round" opacity=".82"/><circle cx="38" cy="31" r="5" fill="#dffbff" opacity=".85"/><circle cx="89" cy="90" r="6" fill="#dffbff" opacity=".9"/></svg>`;
  if(visual==='shadow')return `<svg ${common}><circle cx="64" cy="64" r="51" fill="none" stroke="${c}" stroke-width="4" opacity=".45"/><circle cx="64" cy="64" r="33" fill="none" stroke="${c}" stroke-width="3" opacity=".75" stroke-dasharray="6 5"/><path d="M64 21 74 44l24 2-18 15 6 24-22-12-22 12 6-24-18-15 24-2z" fill="${c}" opacity=".88"/><circle cx="64" cy="64" r="10" fill="#fff" opacity=".75"/></svg>`;
  if(visual==='ritual')return `<svg ${common}><g fill="none" stroke="${c}"><circle cx="64" cy="64" r="54" stroke-width="2.2" opacity=".75"/><circle cx="64" cy="64" r="44" stroke-width="1" stroke-dasharray="4 6" opacity=".9"/><circle cx="64" cy="64" r="29" stroke-width="2" opacity=".7"/><path d="M64 12 111 91H17z" stroke-width="2.8"/><path d="m64 116 47-79H17z" stroke-width="2.8" opacity=".65"/><path d="M64 32v64M32 64h64" stroke-width="1.8" opacity=".35"/></g><path d="M64 42 72 56l16 8-16 8-8 14-8-14-16-8 16-8z" fill="#f0fbff" opacity=".95"/><circle cx="64" cy="64" r="5" fill="${c}"/></svg>`;
  if(visual==='fusion')return `<svg ${common}><defs><linearGradient id="svfxfusion" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#90d7ff"/><stop offset=".52" stop-color="${c}"/><stop offset="1" stop-color="#ffb5df"/></linearGradient></defs><g fill="none" stroke="url(#svfxfusion)" stroke-width="5" stroke-linecap="round"><path d="M20 64c12-36 52-52 81-21"/><path d="M108 64c-12 36-52 52-81 21"/><path d="M38 23c26-14 64 4 72 33" opacity=".65"/><path d="M90 105c-26 14-64-4-72-33" opacity=".65"/></g><path d="M64 32 76 52l22 12-22 12-12 20-12-20-22-12 22-12z" fill="url(#svfxfusion)"/><circle cx="64" cy="64" r="8" fill="#fff" opacity=".9"/></svg>`;
  if(visual==='victory')return `<svg ${common}><g fill="none" stroke="${c}" stroke-width="3"><circle cx="64" cy="64" r="53" opacity=".5"/><path d="M25 97c-20-27-12-55 4-66M103 97c20-27 12-55-4-66" stroke-width="6" stroke-linecap="round" opacity=".8"/><path d="M64 22 76 51l30 13-30 13-12 29-12-29-30-13 30-13z" fill="${c}" stroke-width="1"/><circle cx="64" cy="64" r="10" fill="#fffceb" stroke="none"/></g></svg>`;
  if(visual==='heal')return `<svg ${common}><circle cx="64" cy="64" r="52" fill="none" stroke="${c}" stroke-width="4" opacity=".35"/><circle cx="64" cy="64" r="26" fill="${c}" opacity=".22"/><path d="M57 42h14v15h15v14H71v15H57V71H42V57h15z" fill="#ecfff1"/><path d="M30 84c7-3 13-10 15-17 1 8-1 17-4 24-5-1-8-3-11-7zm68-9c-2 8 0 16 3 23 5-2 9-4 11-9-6-2-11-8-14-14z" fill="#ecfff1" opacity=".92"/></svg>`;
  return `<svg ${common}><circle cx="64" cy="64" r="52" fill="none" stroke="${c}" stroke-width="4" opacity=".35"/><path d="M64 18 74 50l34 14-34 14-10 32-10-32-34-14 34-14z" fill="${c}" opacity=".92"/><circle cx="64" cy="64" r="10" fill="#fffbe5" opacity=".95"/></svg>`;
}
let clearTimer=null;
export function playCue(event,card,settings=readFxSettings()){
  if(!event)return;
  const {visual,sound}=selectedPreset(event.type,card);
  if(settings.sound)playSynth(sound,settings.volume);
  const overlay=document.getElementById('fx-overlay');
  if(!settings.visuals||!overlay||visual==='none')return;
  const preset=palettes[visual]||palettes.star;
  if(clearTimer)clearTimeout(clearTimer);
  const token=++latestSequence;
  overlay.replaceChildren();overlay.className='fx-overlay';
  const backdrop=document.createElement('div');backdrop.className='fx-light';
  const burst=document.createElement('div');burst.className='fx-burst';
  const halo=document.createElement('div');halo.className='fx-halo';
  const mark=document.createElement('div');mark.className='fx-mark';mark.innerHTML=svgMarkup(visual,preset.color);
  const title=document.createElement('strong');title.className='fx-title';
  const typeName={summon:'召喚！',attack:'攻撃宣言！',impact:'攻撃！',trap:'罠カード発動！',spell:'魔法カード発動！',effect:'モンスター効果！',win:'デュエル決着！',set:'カードをセット',ritual:'儀式召喚！',fusion:'融合召喚！'};
  title.textContent=event.type==='win'?(event.winner==='draw'?'DRAW':event.viewerSeat===event.winner?'VICTORY':'DEFEAT'):(typeName[event.type]||preset.title);
  const subtitle=document.createElement('span');subtitle.className='fx-subtitle';subtitle.textContent=card?.name||'';
  if(event.damage>0){subtitle.textContent+=(subtitle.textContent?'　':'')+`${event.damage} DAMAGE`;}
  for(let i=0;i<(visual==='victory'?18:visual==='fusion'||visual==='ritual'?14:10);i++){const particle=document.createElement('span');particle.className='fx-particle';particle.style.setProperty('--tx',`${Math.round((Math.random()*2-1)*130)}px`);particle.style.setProperty('--ty',`${-30-Math.round(Math.random()*110)}px`);particle.style.setProperty('--delay',`${(Math.random()*.16).toFixed(2)}s`);particle.style.setProperty('--size',`${6+Math.random()*12}px`);burst.append(particle);}
  burst.append(halo);
  if(['ritual','fusion','victory'].includes(visual)){const secondary=document.createElement('div');secondary.className='fx-halo fx-halo-secondary';burst.append(secondary);}
  burst.append(mark,title,subtitle);overlay.append(backdrop,burst);
  overlay.style.setProperty('--fx-color',event.type==='win'&&event.winner!=='draw'&&event.viewerSeat!==event.winner?'#9aa9d2':preset.color);overlay.dataset.style=visual;
  overlay.dataset.result=event.type==='win'?(event.winner==='draw'?'draw':event.viewerSeat===event.winner?'victory':'defeat'):'';
  void overlay.offsetWidth;overlay.classList.add('active');
  clearTimer=setTimeout(()=>{if(token===latestSequence){overlay.className='fx-overlay';overlay.replaceChildren();}},980);
}
let bgmTimer=null,bgmStep=0;
function bgmNote(){if(!ctx||ctx.state!=='running'||document.visibilityState==='hidden')return;
 try {const notes=[196,293.66,392,493.88,220,329.63,440,523.25];
   const n=notes[bgmStep++%notes.length];tone(ctx,n,ctx.currentTime+.02,.47,'sine',.006*Math.max(0,Math.min(1,readFxSettings().volume/55)),n*1.005);
 }catch{}}
export function setBgmPlaying(on){
 if(!on){if(bgmTimer)clearInterval(bgmTimer);bgmTimer=null;return;}
 unlockAudio();if(bgmTimer)return;
 bgmNote();bgmTimer=setInterval(bgmNote,580);
}
