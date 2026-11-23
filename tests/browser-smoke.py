import mimetypes
import os
import re
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright


REPO_ROOT = Path(__file__).resolve().parent.parent

FIREBASE = {
    'firebase-app.js': 'export const initializeApp=config=>config;',
    'firebase-auth.js': 'export const getAuth=()=>({currentUser:{uid:"browser-test"},authStateReady:async()=>{}}); export const signInAnonymously=async()=>{};',
    'firebase-database.js': '''
const listeners = new Map();
const mock = key => JSON.parse(localStorage.getItem("browser-mock:" + key));
const snapshot = value => ({val: () => structuredClone(value)});
export const getDatabase = () => ({});
export const ref = (_, key) => key;
export const onValue = (key, notify) => {
  listeners.set(key, notify);
  queueMicrotask(() => notify(snapshot(key === ".info/connected" ? true : mock(key))));
  return () => listeners.delete(key);
};
export const get = async key => snapshot(mock(key));
export const set = async (key, value) => {
  const prefix = "cardLibrary/cards/";
  if (key.startsWith(prefix)) {
    const cards = mock(prefix.slice(0, -1)) || {};
    cards[key.slice(prefix.length)] = JSON.parse(JSON.stringify(value));
    key = prefix.slice(0, -1);
    value = cards;
  }
  localStorage.setItem("browser-mock:" + key, JSON.stringify(value));
  const listener = listeners.get(key);
  if (listener) queueMicrotask(() => listener(snapshot(value)));
};
export const remove = async key => localStorage.removeItem("browser-mock:" + key);
export const runTransaction = async (key, updater) => {
  window.__browserMockTxCalled = (window.__browserMockTxCalled || 0) + 1;
  await new Promise(resolve => setTimeout(resolve, 75));
  const old = mock(key);
  if (window.__browserMockStale) {
    window.__browserMockStale = false;
    old.revision++;
    await set(key, old);
  }
  const next = updater(old);
  if (next === undefined) return {committed: false};
  await set(key, next);
  return {committed: true, snapshot: snapshot(next)};
};
''',
}

def route(r):
    url=urlparse(r.request.url)
    name=Path(url.path).name
    if url.netloc=='www.gstatic.com' and name in FIREBASE:
        r.fulfill(body=FIREBASE[name],content_type='text/javascript',headers={'access-control-allow-origin':'*'})
        return
    if url.netloc!='saho.test':
        r.abort()
        return
    path = (REPO_ROOT / (url.path.lstrip('/') or 'index.html')).resolve()
    if not path.is_relative_to(REPO_ROOT):
        r.abort()
        return
    if path.name=='firebase-config.js':
        r.fulfill(body='export const firebaseConfig = {apiKey:"mock",authDomain:"mock",databaseURL:"mock",projectId:"mock",appId:"mock"};',content_type='text/javascript')
        return
    if path.is_file():
        r.fulfill(path=str(path),content_type=mimetypes.guess_type(path)[0])
    else:
        r.fulfill(status=404,body='Missing file')

def action(page, name):
    return page.locator(f'[data-action="{name}"]:visible')

def open_cards(page):
    page.locator('button[data-tab="settings"]').click()
    action(page,'openCards').click()
    page.locator('#cardAdminPassword').fill('browser-mock-password')
    action(page,'unlockCards').click()
    expect(action(page,'newCard')).to_be_enabled()

def choose_template(page, template_id):
    page.locator('.sv-effect-template-manager summary').click()
    page.locator('#effectTemplateSelect').select_option(template_id)
    action(page,'applyEffectTemplate').click()

def state(page):
    return page.evaluate("JSON.parse(localStorage.getItem('duel-demo-state'))")

def baseline(page):
    page.goto('https://saho.test')
    page.wait_for_function('window.__DUEL_READY === true')
    expect(page.locator('#network')).to_have_attribute('title', 'オンライン接続可能')
    action(page,'openDuel').click()
    action(page,'demo').click()
    expect(page.get_by_role('group', name='フェイズ操作')).to_be_visible()
    game=state(page)
    assert game['status']=='playing' and all(len(player['hand'])==5 for player in game['players'])
    action(page,'nextPhase').click()
    assert state(page)['phase']=='main2' and state(page)['revision']==game['revision']+1
    action(page,'endTurn').click()
    assert state(page)['turnNo']==2 and state(page)['turn']==1-game['turn']

def editor(page):
    page.goto('https://saho.test')
    expect(page.locator('#network')).to_have_attribute('title', 'オンライン接続可能')
    open_cards(page)
    action(page,'newCard').click()
    page.locator('#cardName').fill('検証用魔術師')
    page.locator('#cardSubtype').select_option('effect')
    choose_template(page,'et_builtin_baphomet')
    expect(page.locator('#cardEffectCode')).to_have_value('searchDeckOnSummon')
    page.locator('.sv-effect-template-manager summary').click()
    page.locator('#effectTemplateName').fill('検証用効果')
    action(page,'saveEffectTemplate').click()
    expect(page.locator('#toast')).to_contain_text('「検証用効果」を登録しました')
    action(page,'saveCard').click()
    expect(page.locator('#toast')).to_contain_text('共有カードを保存しました')
    page.reload()
    expect(page.locator('#network')).to_have_attribute('title', 'オンライン接続可能')
    open_cards(page)
    edit=page.locator('.card-manage-item[data-cardname="検証用魔術師"] [data-action="editCard"]')
    edit.click()
    expect(page.locator('#cardEffectCode')).to_have_value('searchDeckOnSummon')
    page.locator('.sv-effect-template-manager summary').click()
    expect(page.locator('#effectTemplateSelect optgroup[label="マイ効果"] option')).to_have_text('検証用効果')

def count_editor(page):
    page.goto('https://saho.test')
    expect(page.locator('#network')).to_have_attribute('title', 'オンライン接続可能')
    open_cards(page)
    action(page,'newCard').click()
    page.locator('#cardName').fill('検証用集計魔術師')
    page.locator('#cardSubtype').select_option('effect')
    choose_template(page,'et_builtin_bmg')
    expect(page.locator('#cardEffectCode')).to_have_value('countStatScale')
    expect(page.locator('#cardCountName1')).to_have_value('ブラック・マジシャン')
    expect(page.locator('#cardCountName2')).to_have_value('マジシャン・オブ・ブラックカオス')
    expect(page.locator('#cardCountZone-grave')).to_be_checked()
    expect(page.locator('#cardCountZone-grave')).to_be_disabled()
    page.locator('#cardCountZone-field').check()
    page.locator('#cardCountZone-grave').uncheck()
    page.locator('#cardCountZone-banished').check()
    page.locator('#cardCountAttribute').select_option('闇')
    page.locator('#cardCountRace').select_option('魔法使い')
    page.locator('#cardCountLevel').select_option('6')
    page.locator('#cardCountMonsterKind').select_option('effect')
    page.locator('#cardCountStat').select_option('def')
    page.locator('#cardPassiveScope').select_option('opponent')
    page.locator('#cardPassiveAmount').fill('450')
    page.locator('#cardCountName1').fill('ブラック・マジシャン・ガール')
    page.locator('#cardCountName2').fill('')
    page.locator('#cardCountName3').fill('検証用魔術師')
    page.locator('.sv-effect-template-manager summary').click()
    page.locator('#effectTemplateName').fill('検証用の集計効果')
    action(page,'saveEffectTemplate').click()
    expect(page.locator('#toast')).to_contain_text('「検証用の集計効果」を登録しました')
    action(page,'saveCard').click()
    expect(page.locator('#toast')).to_contain_text('共有カードを保存しました')
    card = page.evaluate("""Object.values(JSON.parse(localStorage.getItem('browser-mock:cardLibrary/cards'))).find(card=>card.name==='検証用集計魔術師')""")
    expected = dict(kind='continuous', code='countStatScale', amount=450, scope='opponent', stat='def', zones=['field','banished'],
                    names=['ブラック・マジシャン・ガール','検証用魔術師'], attribute='闇', race='魔法使い', level=6, monsterKind='effect')
    assert card['monsterEffect']==expected, card['monsterEffect']
    page.reload()
    expect(page.locator('#network')).to_have_attribute('title', 'オンライン接続可能')
    open_cards(page)
    page.locator('.card-manage-item[data-cardname="検証用集計魔術師"] [data-action="editCard"]').click()
    for field,value in {'cardCountName1':'ブラック・マジシャン・ガール','cardCountName2':'検証用魔術師','cardCountName3':'','cardCountAttribute':'闇','cardCountRace':'魔法使い',
                        'cardCountLevel':'6','cardCountMonsterKind':'effect','cardCountStat':'def','cardPassiveScope':'opponent','cardPassiveAmount':'450'}.items():
        expect(page.locator('#'+field)).to_have_value(value)
    expect(page.locator('#cardCountZone-field')).to_be_checked()
    expect(page.locator('#cardCountZone-grave')).not_to_be_checked()
    expect(page.locator('#cardCountZone-banished')).to_be_checked()
    page.locator('#cardCountMonsterKind').select_option('token')
    page.locator('#cardCountZone-field').uncheck()
    expect(page.locator('#cardCountMonsterKind')).to_have_value('')
    expect(page.locator('#cardCountMonsterKind option[value=token]')).to_have_count(0)
    expect(page.locator('#cardCountZone-banished')).to_be_disabled()
    choose_template(page, page.evaluate("""JSON.parse(localStorage.getItem('saho-effect-templates-v1')).find(t=>t.name==='検証用の集計効果').id"""))
    expect(page.locator('#cardCountMonsterKind')).to_have_value('effect')
    expect(page.locator('#cardCountZone-field')).to_be_checked()

def mocked_duel(page):
    setup = page.evaluate("""async () => {
      const app = await (await fetch('/app.js')).text();
      const cardsPath = app.match(/from '(\\.\\/cards\\.js\\?v=[0-9]+)'/)[1];
      const enginePath = app.match(/from '(\\.\\/engine\\.js\\?v=[0-9]+)'/)[1];
      const {CARD}=await import(cardsPath);
      const game = JSON.parse(localStorage.getItem('duel-demo-state'));
      const revive=Object.values(CARD).find(c=>c.name==='死者蘇生').id;
      const normal=Object.values(CARD).find(c=>c.name==='ブラック・マジシャン').id;
      game.players[0].uid='browser-test'; game.players[1].uid='mock-rival';
      game.turn=0; game.phase='main1'; game.pending=null; delete game.lastEvent; game.players[0].hand=[revive];
      game.players[0].grave=[]; game.players[1].grave=[normal];
      localStorage.setItem('browser-mock:rooms/1234',JSON.stringify(game));
      return {revive, normal, revision:game.revision, enginePath};
    }""")
    page.goto('https://saho.test/?room=1234')
    expect(page.locator('#svDuelBoard')).to_be_visible()
    hand=page.locator('[data-zone="hand"][data-index="0"]')
    hand.click()
    action(page,'spellHand').click()
    expect(page.locator('.sv-revive-modal')).to_be_visible()
    expect(action(page,'selectRevive')).to_have_count(1)
    page.get_by_role('button', name='キャンセル', exact=True).click()
    expect(page.locator('.sv-revive-modal')).to_have_count(0)
    assert page.evaluate("window.__browserMockTxCalled || 0")==0
    if action(page,'spellHand').count()==0:
        hand.click()
    action(page,'spellHand').click()
    page.evaluate('window.__browserMockStale = true')
    action(page,'selectRevive').click()
    expect(page.locator('#toast')).to_contain_text('相手の操作で対戦状況が更新されました')
    check = page.evaluate("JSON.parse(localStorage.getItem('browser-mock:rooms/1234'))")
    assert check['revision']==setup['revision']+1 and check['pending'] is None and check['players'][0]['hand']==[setup['revive']]
    hand.click()
    action(page,'spellHand').click()
    page.evaluate("""() => {
        const button=document.querySelector('[data-action="selectRevive"]');
        button.click();
        button.click();
    }""")
    expect(page.locator('.sv-revive-modal')).to_have_count(0)
    page.wait_for_function("JSON.parse(localStorage.getItem('browser-mock:rooms/1234')).pending?.kind === 'chain'")
    assert page.evaluate('window.__browserMockTxCalled')==2
    result=page.evaluate("""async path => {
      const {applyAction}=await import(path);
      const game = JSON.parse(localStorage.getItem('browser-mock:rooms/1234'));
      const passed=applyAction(game,'mock-rival',{type:'chainPass'});
      return applyAction(passed,'browser-test',{type:'chainPass'});
    }""",setup['enginePath'])
    assert result['pending'] is None
    assert result['players'][0]['monsters'][0]['id']==setup['normal']
    assert result['players'][1]['grave']==[] and result['players'][0]['grave']==[setup['revive']]

def virus_cost(page):
    page.evaluate("""async () => {
      const app = await (await fetch('/app.js')).text();
      const cardsPath = app.match(/from '(\\.\\/cards\\.js\\?v=[0-9]+)'/)[1];
      const {CARD} = await import(cardsPath);
      const game = JSON.parse(localStorage.getItem('duel-demo-state'));
      const id = name => Object.values(CARD).find(c => c.name === name).id;
      game.turn = 0; game.phase = 'main1'; game.pending = null; delete game.lastEvent;
      game.players[0].uid = 'browser-test';
      game.players[0].monsters[0] = {id:id('クリボー'), key:1, pos:'atk', ownerSeat:0};
      game.players[0].monsters[2] = {id:id('青眼の白龍'), key:2, pos:'atk', ownerSeat:0};
      game.players[0].backrow[0] = {id:id('死のデッキ破壊ウイルス'), faceDown:true, setTurn:1};
      game.nextKey=2; game.turnNo=3;
      localStorage.setItem('browser-mock:rooms/9999', JSON.stringify(game));
    }""")
    page.goto('https://saho.test/?room=9999')
    own=page.locator('[data-owner=mine]')
    slot=own.and_(page.locator('[data-zone=backrow][data-index="0"]'))
    legal=own.and_(page.locator('[data-zone=monsters][data-index="0"]'))
    invalid=own.and_(page.locator('[data-zone=monsters][data-index="2"]'))
    expect(slot).to_be_visible()
    slot.click()
    action(page,'activateMainTrap').click()
    expect(legal).to_have_class(re.compile('sv-target-eligible'))
    expect(action(page,'confirmPrerequisite')).to_be_disabled()
    invalid.click()
    expect(action(page,'confirmPrerequisite')).to_be_disabled()
    expect(page.locator('#toast')).to_contain_text('Aに使用できる自分のカードを選んでください')
    action(page,'cancelTarget').click()
    expect(action(page,'confirmPrerequisite')).to_have_count(0)
    assert page.evaluate('window.__browserMockTxCalled || 0') == 0
    slot.click()
    action(page,'activateMainTrap').click()
    legal.click()
    expect(action(page,'confirmPrerequisite')).to_be_enabled()
    action(page,'confirmPrerequisite').click()
    page.wait_for_function("JSON.parse(localStorage.getItem('browser-mock:rooms/9999')).pending?.kind === 'chain'")
    game = page.evaluate("JSON.parse(localStorage.getItem('browser-mock:rooms/9999'))")
    assert game['players'][0]['monsters'][0] is None
    assert game['players'][0]['monsters'][2] and len(game['players'][0]['grave']) == 1

def offering_cost(page):
    page.evaluate("""async () => {
      const app = await (await fetch('/app.js')).text();
      const cardsPath = app.match(/from '(\\.\\/cards\\.js\\?v=[0-9]+)'/)[1];
      const {CARD} = await import(cardsPath);
      const game = JSON.parse(localStorage.getItem('duel-demo-state'));
      const id = name => Object.values(CARD).find(c => c.name === name).id;
      game.turn = 0; game.phase = 'main1'; game.pending = null; delete game.lastEvent;
      game.players[0].uid = 'browser-test';
      game.players[0].hand = [id('死者への手向け'), id('ブラック・マジシャン')];
      game.players[0].grave = [];
      game.players[0].monsters[0] = {id:id('青眼の白龍'), key:1, pos:'atk', ownerSeat:0};
      game.players[1].monsters[0] = {id:id('ランプの魔精・ラ・ジーン'), key:2, pos:'atk', ownerSeat:1};
      game.nextKey=2; game.turnNo=3;
      localStorage.setItem('browser-mock:rooms/8888', JSON.stringify(game));
    }""")
    page.goto('https://saho.test/?room=8888')
    spell=page.locator('[data-zone=hand][data-index="0"]')
    cost=page.locator('[data-zone=hand][data-index="1"]')
    slot=page.locator('[data-zone=monsters][data-owner=mine][data-index="0"]')
    expect(spell).to_be_visible()
    for attempt in range(2):
        spell.click()
        action(page,'spellHand').click()
        expect(cost).to_have_class(re.compile('sv-target-eligible'))
        cost.click()
        action(page,'confirmPrerequisite').click()
        expect(action(page,'confirmPrerequisite')).to_have_count(0)
        expect(slot).to_have_class(re.compile('sv-target-eligible'))
        assert page.evaluate('window.__browserMockTxCalled || 0') == 0
        if attempt == 0:
            action(page,'cancelTarget').click()
            assert page.evaluate("JSON.parse(localStorage.getItem('browser-mock:rooms/8888')).players[0].hand.length") == 2
    slot.click()
    page.wait_for_function("JSON.parse(localStorage.getItem('browser-mock:rooms/8888')).pending?.kind === 'chain'")
    game=page.evaluate("JSON.parse(localStorage.getItem('browser-mock:rooms/8888'))")
    assert game['players'][0]['hand'] == [] and len(game['players'][0]['grave']) == 1
    assert game['pending']['stack'][0]['target'] == {'seat':0,'index':0}

def jammer_editor(page):
    page.goto('https://saho.test')
    expect(page.locator('#network')).to_have_attribute('title', 'オンライン接続可能')
    open_cards(page)
    action(page,'newCard').click()
    page.locator('#cardName').fill('検証用魔法無効')
    page.locator('#cardType').select_option('trap')
    choose_template(page,'et_builtin_jammer')
    expect(page.locator('#cardAbilityOperation')).to_have_value('negateEffect')
    action(page,'saveCard').click()
    expect(page.locator('#toast')).to_contain_text('共有カードを保存しました')
    card = page.evaluate("""Object.values(JSON.parse(localStorage.getItem('browser-mock:cardLibrary/cards'))).find(card=>card.name==='検証用魔法無効')""")
    assert card['responseGuard']=='spell' and card['ability']['before']=={'operation':'discardOwnHand','amount':1}


def native_editor(page):
    page.goto('https://saho.test')
    open_cards(page)
    for suffix,kind,code,name_suffix,updates in [
        ('baphomet','trigger','searchDeckOnSummon','召喚',{'cardSearchName':'別の幻獣','cardSearchSummonTiming':'normalOnly'}),
        ('chimera','grave','reviveMaterialOnDestroy','蘇生',{'cardNativeName1':'新しい素材','cardRevivalPosition':'def'}),
        ('copycat','trigger','copyOpponentPrintedStats','攻守',{'cardFaceUpScope':'own'}),
        ('gilfer','grave','weakenOpponentOnGrave','墓地',{'cardFaceUpScope':'both','cardWeakenAmount':'315'}),
        ('kuriboh','hand','preventBattleDamage','手札防御',{}),
        ('valkyrion','hand','specialByThreeNames','指定名素材',{'cardNativeName2':'磁石戦士ベータ'}),
    ]:
        action(page,'newCard').click()
        card_name='検証'+name_suffix
        page.locator('#cardName').fill(card_name)
        page.locator('#cardSubtype').select_option('effect')
        choose_template(page,'et_builtin_'+suffix)
        expect(page.locator('#cardEffectKind')).to_have_value(kind)
        expect(page.locator('#cardEffectCode')).to_have_value(code)
        for element,value in updates.items():
            control=page.locator('#'+element)
            if control.evaluate('e=>e.tagName')=='SELECT':
                control.select_option(value)
            else:
                control.fill(value)
        action(page,'saveCard').click()
        expect(page.locator('#toast')).to_contain_text('共有カードを保存しました')
        card=page.evaluate("""name=>Object.values(JSON.parse(localStorage.getItem('browser-mock:cardLibrary/cards'))).find(card=>card.name===name)""",card_name)
        assert card['monsterEffect']['kind']==kind and card['monsterEffect']['code']==code, card
    page.reload()
    open_cards(page)
    for card_name,expected in [('検証指定名素材',{'cardNativeName2':'磁石戦士ベータ','cardEffectKind':'hand'}),('検証蘇生',{'cardNativeName1':'新しい素材','cardRevivalPosition':'def'}),('検証墓地',{'cardFaceUpScope':'both','cardWeakenAmount':'315'})]:
        page.locator('.card-manage-item[data-cardname="'+card_name+'"] [data-action="editCard"]').click()
        for element,value in expected.items():
            expect(page.locator('#'+element)).to_have_value(value)
        action(page,'cardList').click()


with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get('SAHOVERSE_CHROMIUM'),
        args=['--disable-dev-shm-usage'],
    )
    viewports = [
        ('iPhone portrait', {'width': 390, 'height': 844}),
        ('iPad portrait', {'width': 820, 'height': 1180}),
        ('iPad landscape', {'width': 1180, 'height': 820}),
    ]
    for label, size in viewports:
        page=browser.new_page(viewport=size, is_mobile=True, has_touch=True)
        page.set_default_timeout(5000)
        page.route('**/*', route)
        page_errors=[]
        page.on('pageerror',lambda e:page_errors.append(str(e)))
        baseline(page)
        editor(page)
        count_editor(page)
        mocked_duel(page)
        virus_cost(page)
        offering_cost(page)
        jammer_editor(page)
        native_editor(page)
        assert not page_errors, page_errors
        print(label, 'passed baseline practice duel, template save, card save/reload/re-edit, adjustable count filters, canceling revive, stale and duplicate actions, Virus and Offering costs, Magic Jammer, and native monster templates', flush=True)
        page.close()
