import type { Localized } from "@/lib/i18n/localized";
import type { UiKey } from "./ui-strings";

/**
 * Reviewed translations of interface strings in the languages the pipeline
 * machine-translates (not English and not the hand-written languages of
 * ui-strings.ts). Written by the `/translation-review` skill
 * (.claude/skills/translation-review/SKILL.md), which reads the live strings
 * and fixes what the per-string machine translation got wrong: a button named
 * differently from the button, a game term that changes from one text to the
 * next, a wrong role or meaning.
 *
 * Each entry repeats the English it was reviewed against. `--sync-ui` writes
 * the languages over the machine translation only while that English is
 * still the text (and a test fails on a stale entry: review it again or
 * delete it), so a fix never outlives the sentence it translates. The row's
 * source hash stays the English one, so the pipeline keeps the fix.
 */
export type ReviewedText = { en: string } & Localized;

export const REVIEWED_UI: Partial<Record<UiKey, ReviewedText>> = {
  "home.kvkCard.body": {
    en: "Formations to prepare, coordinators and instructions for the next castle battle or KvK. Password protected — ask your R4/R5.",
    ja: "次の城戦またはKvKに向けて準備する編成、コーディネーター、指示。パスワード保護 — R4/R5に聞いてね。",
    "zh-TW": "下一場王城爭奪戰或 KvK 需準備的編隊、協調員與說明。受密碼保護——請向你的 R4/R5 索取。",
  },
  "kvk.coordinators": {
    en: "Coordinators",
    ja: "コーディネーター",
    "zh-TW": "協調員",
  },
  "kvk.coordinators.hint": {
    en: "The coordinators run our two battle alliances: [KvK] rallies the castle, [TMP] counter-rallies. Follow their instructions on battle day — they decide who goes where and which formation to use.",
    ja: "コーディネーターが2つの戦闘同盟を率います：[KvK]は城に集結、[TMP]はカウンター集結を担当。決戦の日はコーディネーターの指示に従ってね — 誰がどこへ行き、どの編成を使うかはコーディネーターが決めます。",
    "zh-TW": "協調員負責帶領我們的兩個作戰聯盟：[KvK] 集結王城，[TMP] 負責反集結。開戰日請聽從他們的指示 — 由他們決定誰去哪裡、使用哪個陣容。",
  },
  "kvk.formations.hint": {
    en: "Prepare every formation below in advance and save each one in the game's Troop Ratio presets. The coordinators tell you which one to use.",
    ja: "以下の編成をすべて事前に準備し、ゲーム内の兵種比率プリセットにそれぞれ保存してね。どれを使うかはコーディネーターが伝えます。",
    "zh-TW": "請事先準備好以下所有陣容，並分別儲存在遊戲的部隊比例預設中。協調員會告訴你要用哪一個。",
  },
  "kvk.menu.rallySync": {
    en: "Rally Sync",
    ja: "集結同期",
  },
  "kvk.subtitle": {
    en: "Formations, coordinators and instructions for the next castle battle or KvK. For governors of Kingdom 1241 only.",
    ja: "次の城争奪戦またはKvKの編成、コーディネーター、指示。Kingdom 1241の領主専用です。",
    "zh-TW": "下一場王城戰或 KvK 的陣容、協調員與說明。僅限 Kingdom 1241 的領主。",
  },
  "leaders.overview": {
    en: "Find your name below. Your card shows your battle team, where to teleport, when to start your rally (in UTC and in your own time) and when to activate your pets: their boost lasts two hours, so the council spreads the activations over the battle. Work out your march time before the battle.",
    it: "Trova il tuo nome qui sotto. La tua scheda mostra la tua squadra di battaglia, dove teletrasportarti, quando avviare il tuo raduno (in UTC e nel tuo orario locale) e quando attivare i tuoi pet: il loro potenziamento dura due ore, quindi il consiglio distribuisce le attivazioni durante la battaglia. Calcola il tempo di marcia prima della battaglia.",
  },
  "leaders.pets": {
    en: "Pets",
    it: "Pet",
  },
  "leaders.startCalled": {
    en: "When your coordinator calls it",
    "zh-TW": "當你的協調員下令時",
  },
  // Set before the first machine run: the top bar's label threshold was measured with these words (NavLinks.tsx).
  "nav.transfers": {
    en: "Transfers",
    tr: "Transferler",
    it: "Trasferimenti",
    fr: "Transferts",
  },
  "prep.group.best": {
    en: "Use today",
    tr: "Bugün kullan",
    ja: "今日使う",
    "zh-TW": "今天使用",
  },
  "prep.group.tips": {
    en: "Remember",
    ja: "覚えておくこと",
    "zh-TW": "注意事項",
    fr: "À retenir",
  },
  "prep.intel.complete": {
    en: "Complete",
    fr: "Terminer",
  },
  "prep.intel.step.open": {
    en: "Day {day} begins: claim the saved 08:00 rewards, then complete every intel mission available: the waiting ones, the fresh ones and Master Pan's new set.",
    it: "Inizia il giorno {day}: riscatta le ricompense delle 08:00 messe da parte, poi completa tutte le missioni di intel disponibili: quelle in attesa, quelle nuove e il nuovo set di Master Pan.",
  },
  "prep.item.manuscript": {
    en: "Master's Manuscripts",
    ja: "マスターの写本",
  },
  "prep.item.temperedTruegold": {
    en: "Tempered Truegold",
    it: "Truegold temprato",
    fr: "Truegold trempé",
  },
  "prep.item.tgDust": {
    en: "Truegold Dust",
    fr: "Poussière de Truegold",
  },
  "prep.mark.ok": {
    en: "OK",
    "zh-TW": "可以",
  },
  "prep.points.perScore": {
    en: "{n} pts per +1 score",
    "zh-TW": "每 +1 評分得 {n} 分",
  },
  "prep.save.truegold": {
    en: "Truegold",
    "zh-TW": "純金",
  },
  "prep.tip.warAcademy": {
    en: "Do both kinds of research today: normal research and War Academy research. Research speedups work for both; War Academy research also needs Truegold Dust.",
    it: "Fai oggi entrambi i tipi di ricerca: la ricerca normale e la ricerca dell'Accademia di Guerra. Gli acceleratori di ricerca valgono per entrambe; la ricerca dell'Accademia di Guerra richiede anche Polvere di Truegold.",
    fr: "Fais les deux types de recherche aujourd'hui : la recherche normale et la recherche de l'Académie de guerre. Les accélérations de recherche fonctionnent pour les deux ; la recherche de l'Académie de guerre nécessite aussi de la Poussière de Truegold.",
  },
  "retro.error.duplicate": {
    en: "Feedback for this Governor ID has already been recorded. If that wasn't you, tell the council on Discord.",
    "zh-TW": "此領主ID的回饋已經記錄過了。如果不是你提交的，請在 Discord 上告知議會。",
  },
  "retro.governorId.hint": {
    en: "In the game: tap your avatar; the number under your name. One answer per Governor ID.",
    ja: "ゲーム内でアバターをタップし、名前の下にある番号を確認してね。回答は領主IDごとに1回まで。",
  },
  "retro.privacy": {
    en: "Only the site owner can see your Governor ID and name; the council sees your alliance and your answers.",
    ja: "領主IDと名前はサイト管理者のみが閲覧できます。評議会にはあなたの同盟と回答が表示されます。",
  },
  "retro.q.coordination.hint": {
    en: "Rally calls, timing and the coordinators' instructions.",
    "zh-TW": "集結號召、時機與協調員的指示。",
  },
  "retro.you": {
    en: "About you",
    tr: "Senin hakkında",
  },
  "sync.back": {
    en: "Back to Rally Sync",
    ja: "集結同期に戻る",
  },
  "sync.backIn": {
    en: "Back in",
    tr: "Tekrar katıl",
    it: "Rientra",
    ja: "復帰",
    "zh-TW": "重新參加",
    fr: "Revenir",
  },
  "sync.coord.badge": {
    en: "Coordinator",
    "zh-TW": "協調員",
  },
  "sync.coord.title": {
    en: "Coordinator",
    "zh-TW": "協調員",
  },
  "sync.counter.orWhen": {
    en: "or when {name}'s shows {time}",
    tr: "veya {name} rallisi {time} gösterdiğinde",
  },
  "sync.form.marchHint": {
    en: "The march time the game shows for your rally to the target. Minutes and seconds add up (1 min + 12 s = 72 s).",
    fr: "Le temps de marche affiché par le jeu pour ton ralliement jusqu'à la cible. Les minutes et les secondes s'additionnent (1 min + 12 s = 72 s).",
  },
  "sync.gar.correct": {
    en: "Correct landing time",
    tr: "Varış zamanını düzelt",
    it: "Correggi orario di arrivo",
    ja: "着弾時間を修正",
    "zh-TW": "修正抵達時間",
    fr: "Corriger l'heure d'arrivée",
  },
  "sync.gar.enemyMarch": {
    en: "March to our castle",
    tr: "Kalemize sefer süresi",
    ja: "こちらの城までの行軍",
  },
  "sync.gar.enemyMarchHint": {
    en: "A guess is fine for a new leader: once their rally launches, “Correct landing time” fixes it.",
    tr: "Yeni bir lider için tahmin yeterli: Rallisi başladığında “Varış zamanını düzelt” bunu düzeltir.",
  },
  "sync.gar.landsInHint": {
    en: "Type it, then tap Now when the game shows it. This also saves their real march time (a new leader, or pets) for the next waves.",
    ja: "入力して、ゲームに表示されたら「今」をタップしてね。これで実際の行軍時間（新しいリーダーやペットの影響）も次のウェーブ用に保存されるよ。",
  },
  "sync.gar.landsInTime": {
    en: "Lands in {time}",
    ja: "{time}後に到着",
  },
  "sync.gar.marchLaunchedHint": {
    en: "This rally has launched: the new time counts from their next rally. To fix this one, use “Correct landing time”.",
    tr: "Bu ralli başladı: yeni süre bir sonraki rallilerinden itibaren geçerli. Bunu düzeltmek için “Varış zamanını düzelt” seçeneğini kullan.",
  },
  "sync.gar.marchOf": {
    en: "march {march}",
    ja: "行軍 {march}",
    "zh-TW": "行軍 {march}",
  },
  "sync.hero.nextRally": {
    en: "You're in from the next rally: this one (lands {time}) was already under way. Your start time appears when the coordinator sets the next hit time.",
    "zh-TW": "你將從下一次集結開始加入：這次集結（{time} 抵達）已在進行中。協調員設定下一次攻擊時間後，就會顯示你的出發時間。",
  },
  "sync.hero.tooLateHint": {
    en: "Your rally can't make this hit time. Ask the coordinator to re-sync.",
    "zh-TW": "你的集結無法趕上這個命中時間。請聯絡協調員重新同步。",
  },
  "sync.history": {
    en: "Previous hit times ({n})",
    it: "Orari d'impatto precedenti ({n})",
    ja: "過去の着弾時刻（{n}）",
  },
  "sync.how.3": {
    en: "The coordinator sets the hit time. Everyone sees their own start time in UTC and starts the rally when the in-game clock shows it.",
    "zh-TW": "協調員設定命中時間。每個人都會看到自己以 UTC 顯示的出發時間，當遊戲內時鐘顯示該時間時就發起集結。",
  },
  "sync.invite.coordLink": {
    en: "Coordinator link",
    "zh-TW": "協調員連結",
  },
  "sync.join.body": {
    en: "Your coordinator shares the room ID and password on Discord, or sends an invite link that opens the room directly.",
    "zh-TW": "你的協調員會在 Discord 上分享房間 ID 和密碼，或傳送可直接開啟房間的邀請連結。",
  },
  "sync.join.leader": {
    en: "Are you a rally leader?",
    "zh-TW": "你是集結隊長嗎？",
  },
  "sync.leader.tooLate": {
    en: "Too late for this hit time",
    "zh-TW": "已來不及趕上這次的命中時間",
  },
  "sync.leaders.title": {
    en: "Rally leaders",
    fr: "Chefs de ralliement",
  },
  "sync.link.live": {
    en: "Live",
    "zh-TW": "已連線",
  },
  "sync.missing": {
    en: "There is no room with this ID. Check it with your coordinator.",
    fr: "Il n'existe aucun salon avec cet ID. Vérifie-le auprès de ton coordinateur.",
    ja: "このIDのルームはありません。コーディネーターに確認してください。",
  },
  "sync.sound.off": {
    en: "Sound off",
    tr: "Ses kapalı",
    "zh-TW": "音效已關閉",
  },
  "sync.sound.on": {
    en: "Sound on",
    "zh-TW": "音效已開啟",
  },
  "sync.watching.label": {
    en: "Your name in this room (optional)",
    "zh-TW": "你在此房間的名稱（選填）",
  },
  "sync.yourStart": {
    en: "Your start",
    "zh-TW": "你的出發時間",
  },
  "tour.checklist.board.body": {
    en: "Everything to do, by phase. Tick tasks off as you go: ticks stay on this device, so every coordinator keeps their own.",
    ja: "フェーズごとのやることリストです。終わったタスクにチェックを入れてください。チェックはこの端末に保存されるので、コーディネーターごとに個別に管理できます。",
    "zh-TW": "依階段列出所有待辦事項。完成後就打勾：勾選只會保存在這台裝置上，所以每位協調員都有自己的清單。",
  },
  "tour.checklist.guidelines.body": {
    en: "Rules for everyone who coordinates.",
    ja: "コーディネーター全員へのルール。",
    "zh-TW": "給所有協調員的規則。",
  },
  "tour.checklist.orders.body": {
    en: "How the commander runs the battle and directs the rally leaders and joiners.",
    "zh-TW": "指揮官如何主導戰鬥，並指揮集結隊長與參與集結的玩家。",
  },
  "tour.counter.copy.body": {
    en: "Two versions of the order: the countdown each leader watches, or the seconds to count after the rally before.",
    fr: "Deux versions de l'ordre : le compte à rebours que chaque chef surveille, ou les secondes à compter après le ralliement précédent.",
    it: "Due versioni dell'ordine: il conto alla rovescia che ogni leader osserva, oppure i secondi da contare dopo il rally precedente.",
    tr: "Sıralamanın iki versiyonu: her liderin takip ettiği geri sayım ya da bir önceki ralliden sonra sayılacak saniyeler.",
  },
  "tour.counter.focus.body": {
    en: "Start your counter rally when the earlier rally named here shows this countdown in the alliance war list. Or count the seconds after it started.",
    fr: "Lance ton contre-ralliement quand le ralliement indiqué ici affiche ce compte à rebours dans la liste de guerre de l'alliance. Ou compte les secondes depuis son lancement.",
    it: "Avvia il tuo contro-rally quando il rally precedente indicato qui mostra questo conto alla rovescia nella lista di guerra dell'alleanza. Oppure conta i secondi dal suo avvio.",
  },
  "tour.counter.focus.title": {
    en: "Your cue",
    tr: "Senin işaretin",
  },
  "tour.counter.order.body": {
    en: "Everyone in order, slowest march first, so all counter rallies land in the same second. The first starts when the main alliance says go.",
    fr: "Tout le monde dans l'ordre, la marche la plus lente en premier, pour que tous les contre-ralliements arrivent à la même seconde. Le premier part quand l'alliance principale donne le signal.",
    it: "Tutti in ordine, partendo dalla marcia più lenta, così tutti i contro-rally arrivano nello stesso secondo. Il primo parte quando l'alleanza principale dà il via.",
    tr: "Herkes sırayla, en yavaş sefer önce; böylece tüm karşı ralliler aynı saniyede varır. İlki, ana ittifak başla dediğinde başlar.",
  },
  "tour.feedback.ratings.body": {
    en: "0 to 5 stars per question; the marked ones are required.",
    ja: "各質問に0〜5個の星をつけてください。印のある質問は必須です。",
  },
  "tour.feedback.you.body": {
    en: "Your Governor ID from your in-game profile. The page checks it and usually fills in your name; one answer per ID.",
    tr: "Oyun içi profilindeki Vali ID'n. Sayfa bunu kontrol eder ve genellikle adını otomatik doldurur; her ID için bir yanıt.",
  },
  "tour.gar.edit.body": {
    en: "Add enemy leaders with their march time to our castle, or untick those who aren't fighting today.",
    "zh-TW": "新增敵方集結隊長及他們行軍到我方王城的時間，或取消勾選今天沒有參戰的人。",
  },
  "tour.gar.enemies.body": {
    en: "When one of them starts a rally on us, tap {{ui:sync.gar.rallyStarted}} on their card, then the countdown value the moment the game shows it. Once it launches, the card counts down to the hit.",
    fr: "Quand l'un d'eux lance un ralliement contre nous, appuie sur {{ui:sync.gar.rallyStarted}} sur sa carte, puis sur la valeur du compte à rebours dès que le jeu l'affiche. Une fois le ralliement parti, la carte décompte jusqu'à l'impact.",
    it: "Quando uno di loro avvia un rally contro di noi, tocca {{ui:sync.gar.rallyStarted}} sulla sua scheda, poi il valore del conto alla rovescia nel momento in cui il gioco lo mostra. Una volta partito, la scheda conta alla rovescia fino all'impatto.",
    tr: "Biri bize ralli başlattığında kartındaki {{ui:sync.gar.rallyStarted}} düğmesine dokun, ardından oyun geri sayımı gösterdiği anda o değere dokun. Ralli yola çıkınca kart vuruşa kadar geri sayar.",
    ja: "相手の誰かがこちらに集結を始めたら、そのカードの「{{ui:sync.gar.rallyStarted}}」をタップし、ゲームにカウントダウンの値が出た瞬間にその値をタップしてください。集結が出発すると、カードは着弾までカウントダウンします。",
    "zh-TW": "當其中一人對我們發起集結時，點他卡片上的「{{ui:sync.gar.rallyStarted}}」，再在遊戲顯示倒數的那一刻點選該數值。集結出發後，卡片會倒數到命中。",
  },
  "tour.gar.enemies.title": {
    en: "Enemy rally leaders",
    fr: "Chefs de ralliement ennemis",
  },
  "tour.gar.march.body": {
    en: "Type your march time to the castle and how many seconds you need between two sends. Both stay on this device.",
    ja: "城までの行軍時間と、2回の出発の間に必要な秒数を入力してください。どちらもこの端末にのみ保存されます。",
    "zh-TW": "輸入你行軍到王城所需的時間，以及兩次出兵之間需要間隔的秒數。兩項資料都只會保存在此裝置上。",
  },
  "tour.gar.march.title": {
    en: "Your march",
    ja: "あなたの行軍",
    "zh-TW": "你的行軍",
  },
  "tour.gar.refills.body": {
    en: "Once the enemy's rallies are marked, each refill shows when to send so it lands between two hits. The next ones are big: send when the countdown says {{ui:sync.gar.sendNow}}.",
    fr: "Une fois les ralliements ennemis marqués, chaque recharge indique quand l'envoyer pour qu'elle arrive entre deux impacts. Les prochaines s'affichent en grand : envoie quand le compte à rebours affiche {{ui:sync.gar.sendNow}}.",
    it: "Una volta segnati i rally nemici, ogni ricarica mostra quando inviarla perché arrivi tra due impatti. Le prossime sono mostrate in grande: invia quando il conto alla rovescia indica {{ui:sync.gar.sendNow}}.",
    tr: "Düşman rallileri işaretlendikten sonra her takviye, iki vuruş arasına denk gelmesi için ne zaman gönderileceğini gösterir. Sıradakiler büyük gösterilir: geri sayım {{ui:sync.gar.sendNow}} dediğinde gönder.",
    ja: "敵の集結をマークすると、各補充をいつ送れば2回の着弾の間に届くかが表示されます。次の補充は大きく表示されます。カウントダウンが「{{ui:sync.gar.sendNow}}」になったら送ってください。",
    "zh-TW": "標記敵方集結後，每次補充都會顯示何時出發，讓它在兩次命中之間抵達。接下來的補充會放大顯示：倒數顯示「{{ui:sync.gar.sendNow}}」時就出發。",
  },
  "tour.gar.windows.body": {
    en: "When our refills should land, between the enemy hits. {{ui:sync.copyChat}} sends the hits and landing times to the alliance chat.",
    fr: "Quand nos recharges doivent arriver, entre les impacts ennemis. « {{ui:sync.copyChat}} » copie les impacts et les heures d'arrivée pour le chat d'alliance.",
    it: "Quando devono arrivare le nostre ricariche, tra gli impatti nemici. «{{ui:sync.copyChat}}» copia gli impatti e gli orari di arrivo per la chat dell'alleanza.",
    tr: "Takviyelerimizin düşman vuruşları arasında ne zaman varması gerektiği. “{{ui:sync.copyChat}}” vuruşları ve varış zamanlarını ittifak sohbeti için kopyalar.",
    ja: "敵の着弾の合間に、こちらの補充が届くべき時刻です。「{{ui:sync.copyChat}}」で着弾と到着の時刻を同盟チャット用にコピーできます。",
    "zh-TW": "我方補充應在敵方命中之間抵達的時間。「{{ui:sync.copyChat}}」會複製命中與抵達時間，方便貼到聯盟聊天。",
  },
  "tour.home.prep.title": {
    en: "KvK prep days",
    ja: "KvK準備日",
  },
  "tour.kvk.feedback.body": {
    en: "After the battle: a few stars and short answers on how it went. It takes a minute.",
    ja: "戦闘後に、星といくつかの短い回答で、どうだったか教えてください。1分で終わります。",
  },
  "tour.kvk.feedback.title": {
    en: "Tell the council",
    fr: "Dis-le au conseil",
    it: "Dillo al consiglio",
  },
  "tour.kvk.formations.body": {
    en: "The troop presets to save in the game before the battle. Tap {{ui:kvk.markNotSaved}} on each one you've saved; your ticks stay on this device.",
    fr: "Les préréglages de troupes à enregistrer dans le jeu avant la bataille. Appuie sur « {{ui:kvk.markNotSaved}} » pour chacun que tu as enregistré ; tes coches restent sur cet appareil.",
    it: "I preset delle truppe da salvare nel gioco prima della battaglia. Tocca «{{ui:kvk.markNotSaved}}» su ognuno che hai salvato; le tue spunte restano su questo dispositivo.",
    tr: "Savaştan önce oyunda kaydetmen gereken birlik ön ayarları. Kaydettiğin her birinde “{{ui:kvk.markNotSaved}}” düğmesine dokun; işaretlerin bu cihazda kalır.",
    ja: "戦闘前にゲーム内で保存しておく部隊プリセットです。保存したものごとに「{{ui:kvk.markNotSaved}}」をタップしてください。チェックはこの端末に保存されます。",
    "zh-TW": "戰鬥前要在遊戲中儲存的部隊預設。每儲存好一個，就點一下「{{ui:kvk.markNotSaved}}」；你的勾選會保留在這台裝置上。",
  },
  "tour.kvk.rules.title": {
    en: "Instructions",
    ja: "指示",
  },
  "tour.kvk.unlock.body": {
    en: "Type the password your alliance leaders shared. This device then stays unlocked for 30 days, or until the council changes the password.",
    ja: "同盟のリーダーから共有されたパスワードを入力してください。この端末は30日間、または評議会がパスワードを変更するまでロック解除されたままになります。",
  },
  "tour.leaders.glance.body": {
    en: "Who leads which rally, by battle team. Tap a row to jump to that rally.",
    fr: "Qui mène quel ralliement, par équipe de combat. Touche une ligne pour aller à ce ralliement.",
    it: "Chi guida quale rally, per squadra di battaglia. Tocca una riga per passare a quel rally.",
  },
  "tour.leaders.rallies.title": {
    en: "Each rally",
    fr: "Chaque ralliement",
    it: "Ogni rally",
  },
  "tour.leaders.rules.body": {
    en: "What every leader, or only the rally or garrison leads, should do: march times, when to start, pets, where to stand.",
    fr: "Ce que chaque chef, ou seulement les chefs de ralliement ou de garnison, doit faire : temps de marche, moment du lancement, familiers, positionnement.",
    tr: "Her liderin ya da yalnızca ralli veya garnizon liderlerinin yapması gerekenler: sefer süreleri, ne zaman başlanacağı, evcil hayvanlar, nerede durulacağı.",
    "zh-TW": "每位隊長，或只有集結隊長或駐防隊長要做的事：行軍時間、何時出發、寵物、站位。",
  },
  "tour.leaders.rules.title": {
    en: "Instructions for leaders",
    ja: "集結リーダー向けの指示",
    "zh-TW": "給集結隊長的說明",
  },
  "tour.leaders.unlock.body": {
    en: "This page is only for rally leaders and has its own password, not the battle plan's. Ask your coordinator for it.",
    fr: "Cette page est réservée aux chefs de ralliement et a son propre mot de passe, différent de celui du plan de bataille. Demande-le à ton coordinateur.",
    it: "Questa pagina è solo per i leader dei rally e ha una password propria, diversa da quella del piano di battaglia. Chiedila al tuo coordinatore.",
    ja: "このページは集結リーダー専用で、作戦プランとは別の専用パスワードがあります。コーディネーターに聞いてください。",
    "zh-TW": "此頁面僅限集結隊長使用，並有獨立密碼（與作戰計畫的密碼不同）。請向你的協調員索取。",
  },
  "tour.leaders.unlock.title": {
    en: "Leaders' password",
    "zh-TW": "集結隊長密碼",
  },
  "tour.prep.day.body": {
    en: "What to use, what also counts, what to get ready and what to keep, with the points each item scores and the council's tips.",
    fr: "Ce qu'il faut utiliser, ce qui compte aussi, ce qu'il faut préparer et ce qu'il faut garder, avec les points rapportés par chaque objet et les astuces du conseil.",
  },
  "tour.site.nav.body": {
    en: "Events, rules, guides, the KvK pages and tools such as {{ui:kvk.menu.rallySync}}. On a phone this menu sits at the bottom of the screen.",
    fr: "Événements, règles, guides, les pages KvK et des outils comme {{ui:kvk.menu.rallySync}}. Sur téléphone, ce menu se trouve en bas de l'écran.",
    it: "Eventi, regole, guide, le pagine KvK e strumenti come {{ui:kvk.menu.rallySync}}. Sul telefono questo menu si trova in fondo allo schermo.",
    tr: "Etkinlikler, kurallar, rehberler, KvK sayfaları ve {{ui:kvk.menu.rallySync}} gibi araçlar. Telefonda bu menü ekranın altındadır.",
    ja: "イベント、ルール、ガイド、KvKページ、{{ui:kvk.menu.rallySync}}などのツールはこちらです。スマホでは、このメニューは画面の下にあります。",
    "zh-TW": "活動、規則、攻略、KvK 頁面，以及{{ui:kvk.menu.rallySync}}等工具。在手機上，這個選單位於畫面底部。",
  },
  "tour.sync.clock.body": {
    en: "Every time here is a game time (UTC). If the game's clock is a second off, tap the clock and nudge it until both tick together.",
    ja: "ここに表示される時刻はすべてゲーム内時刻（UTC）です。ゲームの時計と1秒ずれている場合は、時計をタップして、両方が同時に進むまで調整してください。",
  },
  "tour.sync.coordinator.body": {
    en: "Only you see this panel: from here you run the room for everyone in it.",
    fr: "Toi seul vois ce panneau : d'ici, tu gères le salon pour tous ceux qui s'y trouvent.",
  },
  "tour.sync.coordinator.title": {
    en: "Coordinator panel",
    "zh-TW": "協調員面板",
  },
  "tour.sync.copy.body": {
    en: "Copies the hit time and every leader's start time, ready to paste into the alliance chat.",
    fr: "Copie l'heure d'impact et l'heure de lancement de chaque chef de ralliement, prêtes à coller dans le chat d'alliance.",
  },
  "tour.sync.focus.title": {
    en: "Hit and start time",
    ja: "着弾と開始時刻",
  },
  "tour.sync.hit.body": {
    en: "Or type the hit time yourself, as the game clock shows it. Every leader's start time follows at once.",
    ja: "または、ゲーム内の時計に表示されている着弾時刻を自分で入力してください。各リーダーの開始時刻がすぐに表示されます。",
    "zh-TW": "或依遊戲時鐘顯示的時間，自行輸入命中時間。每位集結隊長的開始時間會立即算出。",
  },
  "tour.sync.leaders.body": {
    en: "Everyone else in the room, with their march time and start time.",
    tr: "Odadaki diğer herkes, sefer süreleri ve başlangıç zamanlarıyla birlikte.",
  },
  "tour.sync.leaders.title": {
    en: "The other leaders",
    fr: "Les autres chefs",
    "zh-TW": "其他隊長",
  },
  "tour.sync.me.body": {
    en: "Join as a rally leader with your name and your march time to the castle. Your entry then shows here: tap {{ui:sync.edit}} to change your march time or to sit a rally out.",
    fr: "Inscris-toi comme chef de ralliement avec ton nom et ton temps de marche jusqu'au château. Ta participation s'affiche ensuite ici : appuie sur {{ui:sync.edit}} pour changer ton temps de marche ou pour passer un ralliement.",
    it: "Unisciti come leader del rally con il tuo nome e il tuo tempo di marcia fino al castello. La tua iscrizione compare poi qui: tocca {{ui:sync.edit}} per cambiare il tempo di marcia o per saltare un rally.",
    tr: "Adın ve kaleye sefer sürenle ralli lideri olarak katıl. Kaydın sonra burada görünür: sefer süreni değiştirmek ya da bir ralliyi pas geçmek için {{ui:sync.edit}} düğmesine dokun.",
    ja: "名前と城までの行軍時間を入力して、集結リーダーとして参加してください。参加するとここに表示されます。行軍時間を変えるときや集結を休むときは「{{ui:sync.edit}}」をタップしてください。",
    "zh-TW": "以集結隊長身分加入，填寫你的名字和到王城的行軍時間。之後你的登錄資料會顯示在這裡：點「{{ui:sync.edit}}」即可修改行軍時間，或選擇不參加某次集結。",
  },
  "tour.sync.resync.body": {
    en: "Sets the earliest hit time every leader can still make. While a rally runs it asks for a second tap, so a stray tap can't change it.",
    fr: "Définit l'heure d'impact la plus tôt que chaque chef de ralliement peut encore tenir. Pendant un ralliement en cours, un second appui est demandé, pour qu'un appui accidentel ne puisse pas la changer.",
    tr: "Her liderin hâlâ yetişebileceği en erken vuruş zamanını ayarlar. Bir ralli sürerken ikinci bir dokunuş ister; böylece yanlışlıkla yapılan bir dokunuş onu değiştiremez.",
    "zh-TW": "設定所有集結隊長都還能趕上的最早命中時間。集結進行中時需要再點一次確認，避免誤觸更改。",
  },
  "tour.sync.wake.body": {
    en: "Keeps your screen from going dark while the room is open. Tap it to switch this off.",
    fr: "Empêche ton écran de s'éteindre tant que le salon est ouvert. Appuie dessus pour désactiver cette option.",
  },
};

/** The text of a key with its reviewed languages laid over it, while they were reviewed against this English. */
export function withReviewed(key: string, text: Localized): Localized {
  const reviewed = (REVIEWED_UI as Record<string, ReviewedText | undefined>)[key];
  if (!reviewed || reviewed.en !== text.en) return text;
  return { ...text, ...reviewed, en: text.en };
}
