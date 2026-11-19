/** SAHOVERSE room passcodes: new rooms use 4 digits; legacy 8-character invitations still work. */
const LEGACY=/^[A-Z2-9]{8}$/;
const PIN=/^[0-9]{4}$/;
export function makeRoomCode(random=globalThis.crypto){
  if(random?.getRandomValues){
    const bytes=new Uint32Array(1);
    random.getRandomValues(bytes);
    return String(bytes[0]%10000).padStart(4,'0');
  }
  // Random passcodes are identifiers for casual play, not an authentication secret.
  return String(Math.floor(Math.random()*10000)).padStart(4,'0');
}
export function normalizeRoomCode(raw){return String(raw??'').trim().toUpperCase();}
export function isRoomCode(code){return PIN.test(code)||LEGACY.test(code);}
