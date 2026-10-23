import type { Localized } from "@/lib/i18n/localized";

/**
 * Interface text (navigation, labels, buttons).
 *
 * English is the source of truth. The other languages below are hand-written
 * seed translations so the language switcher works from the very first
 * deploy; they can be regenerated with Gemini at any time:
 *
 *   npm run translate -- --table ui_strings --force
 *
 * Content (announcements, rules, guides...) is NOT here — it lives in the
 * database and is translated by the pipeline when it is added or edited.
 */
export const UI_STRINGS = {
  // Navigation
  "nav.home": { en: "Home", de: "Start", ko: "홈", pl: "Start", ar: "الرئيسية" },
  "nav.events": { en: "Events", de: "Events", ko: "이벤트", pl: "Wydarzenia", ar: "الفعاليات" },
  "nav.rules": { en: "Rules", de: "Regeln", ko: "규칙", pl: "Zasady", ar: "القواعد" },
  "nav.guides": { en: "Guides", de: "Guides", ko: "가이드", pl: "Poradniki", ar: "الأدلة" },
  "nav.tools": { en: "Tools", de: "Tools", ko: "도구", pl: "Narzędzia", ar: "الأدوات" },

  // Common
  "common.copy": { en: "Copy", de: "Kopieren", ko: "복사", pl: "Kopiuj", ar: "نسخ" },
  "common.copied": { en: "Copied!", de: "Kopiert!", ko: "복사됨!", pl: "Skopiowano!", ar: "تم النسخ!" },
  "common.readMore": { en: "Read more", de: "Mehr lesen", ko: "더 보기", pl: "Czytaj więcej", ar: "اقرأ المزيد" },
  "common.back": { en: "Back", de: "Zurück", ko: "뒤로", pl: "Wstecz", ar: "رجوع" },
  "common.days": { en: "days", de: "Tage", ko: "일", pl: "dni", ar: "أيام" },
  "common.hours": { en: "hrs", de: "Std.", ko: "시간", pl: "godz.", ar: "ساعات" },
  "common.minutes": { en: "min", de: "Min.", ko: "분", pl: "min", ar: "دقائق" },
  "common.seconds": { en: "sec", de: "Sek.", ko: "초", pl: "s", ar: "ثوانٍ" },

  // Time
  "time.startsIn": { en: "Starts in", de: "Beginnt in", ko: "시작까지", pl: "Rozpoczyna się za", ar: "يبدأ خلال" },
  "time.endsIn": { en: "Ends in", de: "Endet in", ko: "종료까지", pl: "Kończy się za", ar: "ينتهي خلال" },
  "time.live": { en: "Live now", de: "Jetzt live", ko: "진행 중", pl: "Trwa teraz", ar: "جارٍ الآن" },
  "time.ended": { en: "Ended", de: "Beendet", ko: "종료됨", pl: "Zakończone", ar: "انتهى" },
  "time.yourTimeZone": { en: "Your time zone", de: "Deine Zeitzone", ko: "내 시간대", pl: "Twoja strefa czasowa", ar: "منطقتك الزمنية" },
  "time.serverTime": { en: "Server time (UTC)", de: "Serverzeit (UTC)", ko: "서버 시간 (UTC)", pl: "Czas serwera (UTC)", ar: "وقت الخادم (UTC)" },
  "time.dailyReset": { en: "Daily reset", de: "Täglicher Reset", ko: "일일 초기화", pl: "Dzienny reset", ar: "إعادة التعيين اليومية" },
  "time.resetIn": { en: "Next reset in", de: "Nächster Reset in", ko: "다음 초기화까지", pl: "Następny reset za", ar: "إعادة التعيين التالية خلال" },
  "time.resetAt": { en: "Resets daily at", de: "Reset täglich um", ko: "매일 초기화 시각", pl: "Reset codziennie o", ar: "يُعاد التعيين يوميًا عند" },

  // Home
  "home.announcements": { en: "Announcements", de: "Ankündigungen", ko: "공지사항", pl: "Ogłoszenia", ar: "الإعلانات" },
  "home.noAnnouncements": { en: "No announcements yet.", de: "Noch keine Ankündigungen.", ko: "아직 공지사항이 없습니다.", pl: "Brak ogłoszeń.", ar: "لا توجد إعلانات بعد." },
  "home.pinned": { en: "Pinned", de: "Angepinnt", ko: "고정", pl: "Przypięte", ar: "مثبّت" },
  "home.upcomingEvents": { en: "Upcoming events", de: "Nächste Events", ko: "다가오는 이벤트", pl: "Nadchodzące wydarzenia", ar: "الفعاليات القادمة" },
  "home.viewAllEvents": { en: "All events", de: "Alle Events", ko: "모든 이벤트", pl: "Wszystkie wydarzenia", ar: "كل الفعاليات" },
  "home.alliances": { en: "Alliances of the kingdom", de: "Allianzen des Königreichs", ko: "왕국의 연맹", pl: "Sojusze królestwa", ar: "تحالفات المملكة" },
  "home.giftCodes": { en: "Gift codes", de: "Geschenkcodes", ko: "선물 코드", pl: "Kody podarunkowe", ar: "رموز الهدايا" },
  "home.giftCodesHint": {
    en: "Redeem in game: Profile → Settings → Gift Code.",
    de: "Im Spiel einlösen: Profil → Einstellungen → Geschenkcode.",
    ko: "게임 내 사용: 프로필 → 설정 → 선물 코드",
    pl: "Użyj w grze: Profil → Ustawienia → Kod podarunkowy.",
    ar: "استبدلها في اللعبة: الملف الشخصي ← الإعدادات ← رمز الهدية.",
  },
  "home.noGiftCodes": { en: "No active gift codes right now.", de: "Aktuell keine aktiven Geschenkcodes.", ko: "현재 사용 가능한 선물 코드가 없습니다.", pl: "Brak aktywnych kodów.", ar: "لا توجد رموز هدايا نشطة حاليًا." },
  "home.expires": { en: "Expires", de: "Läuft ab", ko: "만료", pl: "Wygasa", ar: "ينتهي" },
  "home.noExpiry": { en: "No known expiry", de: "Kein bekanntes Ablaufdatum", ko: "만료일 미정", pl: "Brak znanej daty wygaśnięcia", ar: "لا يوجد تاريخ انتهاء معروف" },
  "home.joinDiscord": { en: "Join our Discord", de: "Zu unserem Discord", ko: "디스코드 참여", pl: "Dołącz do Discorda", ar: "انضم إلى ديسكورد" },

  // Alliances
  "alliance.leader": { en: "Leader", de: "Anführer", ko: "맹주", pl: "Lider", ar: "القائد" },
  "alliance.power": { en: "Power", de: "Macht", ko: "전투력", pl: "Moc", ar: "القوة" },
  "alliance.members": { en: "Members", de: "Mitglieder", ko: "멤버", pl: "Członkowie", ar: "الأعضاء" },
  "alliance.languages": { en: "Languages", de: "Sprachen", ko: "언어", pl: "Języki", ar: "اللغات" },
  "alliance.requirements": { en: "Requirements", de: "Voraussetzungen", ko: "가입 조건", pl: "Wymagania", ar: "المتطلبات" },

  // Events
  "events.title": { en: "Events", de: "Events", ko: "이벤트", pl: "Wydarzenia", ar: "الفعاليات" },
  "events.subtitle": {
    en: "All times are shown in your local time zone.",
    de: "Alle Zeiten in deiner lokalen Zeitzone.",
    ko: "모든 시간은 내 시간대 기준입니다.",
    pl: "Wszystkie godziny w Twojej strefie czasowej.",
    ar: "جميع الأوقات معروضة حسب منطقتك الزمنية.",
  },
  "events.next": { en: "Next", de: "Nächstes", ko: "다음", pl: "Następne", ar: "التالي" },
  "events.everyNDays": { en: "Every {n} days", de: "Alle {n} Tage", ko: "{n}일마다", pl: "Co {n} dni", ar: "كل {n} أيام" },
  "events.daily": { en: "Daily", de: "Täglich", ko: "매일", pl: "Codziennie", ar: "يوميًا" },
  "events.weekly": { en: "Weekly", de: "Wöchentlich", ko: "매주", pl: "Co tydzień", ar: "أسبوعيًا" },
  "events.oneOff": { en: "One-time event", de: "Einmaliges Event", ko: "1회성 이벤트", pl: "Jednorazowe", ar: "فعالية لمرة واحدة" },
  "events.duration": { en: "Duration", de: "Dauer", ko: "진행 시간", pl: "Czas trwania", ar: "المدة" },
  "events.openGuide": { en: "Open guide", de: "Guide öffnen", ko: "가이드 보기", pl: "Otwórz poradnik", ar: "افتح الدليل" },
  "events.noEvents": { en: "No events scheduled.", de: "Keine Events geplant.", ko: "예정된 이벤트가 없습니다.", pl: "Brak zaplanowanych wydarzeń.", ar: "لا توجد فعاليات مجدولة." },
  "events.category.alliance": { en: "Alliance", de: "Allianz", ko: "연맹", pl: "Sojusz", ar: "التحالف" },
  "events.category.kingdom": { en: "Kingdom", de: "Königreich", ko: "왕국", pl: "Królestwo", ar: "المملكة" },
  "events.category.cross-kingdom": { en: "Cross-kingdom", de: "Königreichsübergreifend", ko: "왕국 간", pl: "Międzykrólestwowe", ar: "بين الممالك" },
  "events.category.solo": { en: "Solo", de: "Solo", ko: "개인", pl: "Solo", ar: "فردي" },

  // Rules
  "rules.title": { en: "Kingdom rules", de: "Regeln des Königreichs", ko: "왕국 규칙", pl: "Zasady królestwa", ar: "قواعد المملكة" },
  "rules.subtitle": {
    en: "Rules every governor in the kingdom follows. Choose a topic.",
    de: "Regeln für alle Gouverneure des Königreichs. Wähle ein Thema.",
    ko: "왕국의 모든 영주가 따르는 규칙입니다. 주제를 선택하세요.",
    pl: "Zasady obowiązujące każdego gubernatora. Wybierz temat.",
    ar: "القواعد التي يلتزم بها كل حاكم في المملكة. اختر موضوعًا.",
  },
  "rules.noRules": { en: "No rules in this topic yet.", de: "Noch keine Regeln zu diesem Thema.", ko: "이 주제에는 아직 규칙이 없습니다.", pl: "Brak zasad w tym temacie.", ar: "لا توجد قواعد في هذا الموضوع بعد." },

  // Guides
  "guides.title": { en: "Guides", de: "Guides", ko: "가이드", pl: "Poradniki", ar: "الأدلة" },
  "guides.subtitle": {
    en: "How our kingdom plays each event.",
    de: "So spielt unser Königreich jedes Event.",
    ko: "우리 왕국의 이벤트별 플레이 방법",
    pl: "Jak nasze królestwo gra w każde wydarzenie.",
    ar: "كيف تلعب مملكتنا كل فعالية.",
  },
  "guides.updated": { en: "Updated", de: "Aktualisiert", ko: "업데이트", pl: "Zaktualizowano", ar: "آخر تحديث" },
  "guides.read": { en: "Read guide", de: "Guide lesen", ko: "가이드 읽기", pl: "Czytaj poradnik", ar: "اقرأ الدليل" },
  "guides.back": { en: "All guides", de: "Alle Guides", ko: "모든 가이드", pl: "Wszystkie poradniki", ar: "كل الأدلة" },
  "guides.relatedEvent": { en: "Related event", de: "Zugehöriges Event", ko: "관련 이벤트", pl: "Powiązane wydarzenie", ar: "الفعالية المرتبطة" },
  "guides.notFound": { en: "This guide doesn't exist (yet).", de: "Diesen Guide gibt es (noch) nicht.", ko: "이 가이드는 (아직) 없습니다.", pl: "Ten poradnik (jeszcze) nie istnieje.", ar: "هذا الدليل غير موجود (بعد)." },

  // Tools
  "tools.title": { en: "Tools", de: "Tools", ko: "도구", pl: "Narzędzia", ar: "الأدوات" },
  "tools.subtitle": { en: "Calculators for everyday kingdom life.", de: "Rechner für den Alltag im Königreich.", ko: "왕국 생활을 위한 계산기", pl: "Kalkulatory na co dzień.", ar: "حاسبات للحياة اليومية في المملكة." },

  "tools.refill.title": { en: "Rally troop refill", de: "Rally-Truppen auffüllen", ko: "집결 병력 보충", pl: "Uzupełnianie wojsk w rajdzie", ar: "إعادة تعبئة قوات الحشد" },
  "tools.refill.description": {
    en: "Work out how many troops of each type still need to be sent to reach the target ratio of a rally.",
    de: "Berechne, wie viele Truppen jedes Typs noch geschickt werden müssen, um das Zielverhältnis der Rally zu erreichen.",
    ko: "집결의 목표 비율에 맞추기 위해 병종별로 얼마나 더 보내야 하는지 계산합니다.",
    pl: "Oblicz, ile wojsk każdego typu trzeba jeszcze wysłać, aby osiągnąć docelowe proporcje rajdu.",
    ar: "احسب عدد القوات من كل نوع التي ما زال يجب إرسالها للوصول إلى النسبة المستهدفة للحشد.",
  },
  "tools.refill.capacity": { en: "Rally capacity", de: "Rally-Kapazität", ko: "집결 수용량", pl: "Pojemność rajdu", ar: "سعة الحشد" },
  "tools.refill.inRally": { en: "Troops already in the rally", de: "Truppen bereits in der Rally", ko: "현재 집결된 병력", pl: "Wojska już w rajdzie", ar: "القوات الموجودة في الحشد" },
  "tools.refill.target": { en: "Target ratio (%)", de: "Zielverhältnis (%)", ko: "목표 비율 (%)", pl: "Docelowe proporcje (%)", ar: "النسبة المستهدفة (%)" },
  "tools.refill.presets": { en: "Presets", de: "Vorlagen", ko: "프리셋", pl: "Szablony", ar: "إعدادات مسبقة" },
  "tools.refill.infantry": { en: "Infantry", de: "Infanterie", ko: "보병", pl: "Piechota", ar: "المشاة" },
  "tools.refill.cavalry": { en: "Cavalry", de: "Kavallerie", ko: "기병", pl: "Kawaleria", ar: "الفرسان" },
  "tools.refill.archers": { en: "Archers", de: "Bogenschützen", ko: "궁병", pl: "Łucznicy", ar: "الرماة" },
  "tools.refill.type": { en: "Troop type", de: "Truppentyp", ko: "병종", pl: "Typ wojsk", ar: "نوع القوات" },
  "tools.refill.current": { en: "In rally", de: "In der Rally", ko: "현재", pl: "W rajdzie", ar: "في الحشد" },
  "tools.refill.targetCount": { en: "Target", de: "Ziel", ko: "목표", pl: "Cel", ar: "الهدف" },
  "tools.refill.toSend": { en: "Send now", de: "Jetzt senden", ko: "추가 파병", pl: "Wyślij teraz", ar: "أرسل الآن" },
  "tools.refill.after": { en: "After", de: "Danach", ko: "이후", pl: "Po wysłaniu", ar: "بعد الإرسال" },
  "tools.refill.total": { en: "Total", de: "Gesamt", ko: "합계", pl: "Razem", ar: "الإجمالي" },
  "tools.refill.remaining": { en: "Free capacity", de: "Freie Kapazität", ko: "남은 수용량", pl: "Wolne miejsce", ar: "السعة المتاحة" },
  "tools.refill.ratioSumWarning": {
    en: "The target ratio must add up to 100%.",
    de: "Das Zielverhältnis muss 100 % ergeben.",
    ko: "목표 비율의 합은 100%여야 합니다.",
    pl: "Docelowe proporcje muszą sumować się do 100%.",
    ar: "يجب أن يكون مجموع النسبة المستهدفة 100%.",
  },
  "tools.refill.fullWarning": { en: "The rally is already full.", de: "Die Rally ist bereits voll.", ko: "집결이 이미 가득 찼습니다.", pl: "Rajd jest już pełny.", ar: "الحشد ممتلئ بالفعل." },
  "tools.refill.overTargetWarning": {
    en: "Some troop types are already above target. The free capacity is split between the other types.",
    de: "Einige Truppentypen liegen bereits über dem Ziel. Die freie Kapazität wird auf die anderen Typen verteilt.",
    ko: "일부 병종이 이미 목표를 초과했습니다. 남은 수용량은 다른 병종에 배분됩니다.",
    pl: "Niektóre typy wojsk są już powyżej celu. Wolne miejsce dzielone jest między pozostałe typy.",
    ar: "بعض أنواع القوات تجاوزت الهدف بالفعل. تُقسَّم السعة المتاحة بين الأنواع الأخرى.",
  },
  "tools.refill.preset.bearGen4": { en: "Bear Hunt (gen 4+)", de: "Bärenjagd (Gen 4+)", ko: "곰 사냥 (4세대+)", pl: "Polowanie na niedźwiedzia (gen 4+)", ar: "صيد الدب (الجيل 4+)" },
  "tools.refill.preset.bearGen1": { en: "Bear Hunt (gen 1)", de: "Bärenjagd (Gen 1)", ko: "곰 사냥 (1세대)", pl: "Polowanie na niedźwiedzia (gen 1)", ar: "صيد الدب (الجيل 1)" },
  "tools.refill.preset.balanced": { en: "Balanced", de: "Ausgewogen", ko: "균형", pl: "Zrównoważone", ar: "متوازن" },
  "tools.refill.preset.infantryWall": { en: "Infantry wall", de: "Infanteriewall", ko: "보병 벽", pl: "Ściana piechoty", ar: "جدار المشاة" },
  "tools.refill.preset.vikings": { en: "Viking defence", de: "Wikinger-Verteidigung", ko: "바이킹 방어", pl: "Obrona przed Wikingami", ar: "دفاع الفايكنج" },

  "tools.pack.title": { en: "Pack value check", de: "Paketwert-Check", ko: "패키지 가치 계산", pl: "Wartość pakietu", ar: "تقييم الحزمة" },
  "tools.pack.description": {
    en: "Rebuild a pack from its contents to see how many gems it is worth compared with buying gems directly.",
    de: "Baue ein Paket aus seinem Inhalt nach und sieh, wie viele Edelsteine es im Vergleich zum direkten Edelsteinkauf wert ist.",
    ko: "패키지 구성품을 입력해 보석을 직접 구매할 때와 비교한 가치를 확인하세요.",
    pl: "Odtwórz zawartość pakietu, aby sprawdzić, ile jest wart w klejnotach w porównaniu z bezpośrednim zakupem klejnotów.",
    ar: "أعد بناء الحزمة من محتوياتها لمعرفة قيمتها بالجواهر مقارنةً بشراء الجواهر مباشرة.",
  },
  "tools.pack.price": { en: "Pack price", de: "Paketpreis", ko: "패키지 가격", pl: "Cena pakietu", ar: "سعر الحزمة" },
  "tools.pack.gemsPerUnit": { en: "Gems per 1 currency unit", de: "Edelsteine pro Währungseinheit", ko: "통화 1단위당 보석", pl: "Klejnoty za 1 jednostkę waluty", ar: "الجواهر لكل وحدة عملة" },
  "tools.pack.gemsPerUnitHint": {
    en: "Default 500 gems per 1 USD when buying gems directly. Adjust for your store currency.",
    de: "Standard: 500 Edelsteine pro 1 USD beim Direktkauf. Für deine Store-Währung anpassen.",
    ko: "기본값: 직접 구매 시 1 USD당 500 보석. 사용 통화에 맞게 조정하세요.",
    pl: "Domyślnie 500 klejnotów za 1 USD przy zakupie bezpośrednim. Dostosuj do swojej waluty.",
    ar: "الافتراضي 500 جوهرة لكل 1 دولار عند الشراء المباشر. عدّله حسب عملة متجرك.",
  },
  "tools.pack.contents": { en: "Pack contents", de: "Paketinhalt", ko: "패키지 구성품", pl: "Zawartość pakietu", ar: "محتويات الحزمة" },
  "tools.pack.addItem": { en: "Add item", de: "Item hinzufügen", ko: "아이템 추가", pl: "Dodaj przedmiot", ar: "أضف عنصرًا" },
  "tools.pack.item": { en: "Item", de: "Item", ko: "아이템", pl: "Przedmiot", ar: "العنصر" },
  "tools.pack.quantity": { en: "Qty", de: "Anzahl", ko: "수량", pl: "Ilość", ar: "الكمية" },
  "tools.pack.gemValue": { en: "Gems each", de: "Edelsteine je Stück", ko: "개당 보석", pl: "Klejnoty za szt.", ar: "جواهر لكل وحدة" },
  "tools.pack.remove": { en: "Remove", de: "Entfernen", ko: "삭제", pl: "Usuń", ar: "إزالة" },
  "tools.pack.reset": { en: "Reset", de: "Zurücksetzen", ko: "초기화", pl: "Wyczyść", ar: "إعادة ضبط" },
  "tools.pack.custom": { en: "Custom item", de: "Eigenes Item", ko: "사용자 지정 아이템", pl: "Własny przedmiot", ar: "عنصر مخصص" },
  "tools.pack.totalGems": { en: "Gem value of the pack", de: "Edelsteinwert des Pakets", ko: "패키지의 보석 가치", pl: "Wartość pakietu w klejnotach", ar: "قيمة الحزمة بالجواهر" },
  "tools.pack.baselineGems": { en: "Gems for the same money", de: "Edelsteine für dasselbe Geld", ko: "같은 금액의 보석", pl: "Klejnoty za tę samą kwotę", ar: "الجواهر بنفس المبلغ" },
  "tools.pack.valuePercent": { en: "Pack value", de: "Paketwert", ko: "패키지 가치", pl: "Wartość pakietu", ar: "قيمة الحزمة" },
  "tools.pack.excludeResources": { en: "Ignore basic resources", de: "Basisressourcen ignorieren", ko: "기본 자원 제외", pl: "Pomiń podstawowe surowce", ar: "تجاهل الموارد الأساسية" },
  "tools.pack.share": { en: "Share", de: "Anteil", ko: "비중", pl: "Udział", ar: "الحصة" },
  "tools.pack.empty": { en: "Add items to see the pack value.", de: "Füge Items hinzu, um den Paketwert zu sehen.", ko: "아이템을 추가하면 패키지 가치가 표시됩니다.", pl: "Dodaj przedmioty, aby zobaczyć wartość pakietu.", ar: "أضف عناصر لرؤية قيمة الحزمة." },
  "tools.pack.rating.insane": { en: "Insane value", de: "Unglaublicher Wert", ko: "압도적 가치", pl: "Rewelacyjna wartość", ar: "قيمة استثنائية" },
  "tools.pack.rating.great": { en: "Very good value", de: "Sehr guter Wert", ko: "매우 좋음", pl: "Bardzo dobra wartość", ar: "قيمة ممتازة" },
  "tools.pack.rating.good": { en: "Decent value", de: "Guter Wert", ko: "좋음", pl: "Przyzwoita wartość", ar: "قيمة جيدة" },
  "tools.pack.rating.average": { en: "Average", de: "Durchschnitt", ko: "보통", pl: "Przeciętna", ar: "متوسطة" },
  "tools.pack.rating.poor": { en: "Poor value", de: "Schlechter Wert", ko: "나쁨", pl: "Słaba wartość", ar: "قيمة ضعيفة" },
  "tools.pack.valuesNote": {
    en: "Gem values are community estimates and can be edited per item.",
    de: "Edelsteinwerte sind Community-Schätzungen und können pro Item angepasst werden.",
    ko: "보석 가치는 커뮤니티 추정치이며 아이템별로 수정할 수 있습니다.",
    pl: "Wartości w klejnotach to szacunki społeczności; można je edytować dla każdego przedmiotu.",
    ar: "قيم الجواهر تقديرات من المجتمع ويمكن تعديلها لكل عنصر.",
  },
  "tools.pack.category.gems": { en: "Gems & currency", de: "Edelsteine & Währung", ko: "보석 및 재화", pl: "Klejnoty i waluta", ar: "الجواهر والعملة" },
  "tools.pack.category.speedups": { en: "Speedups", de: "Beschleunigungen", ko: "가속 아이템", pl: "Przyspieszenia", ar: "التسريعات" },
  "tools.pack.category.resources": { en: "Resources", de: "Ressourcen", ko: "자원", pl: "Surowce", ar: "الموارد" },
  "tools.pack.category.hero": { en: "Heroes", de: "Helden", ko: "영웅", pl: "Bohaterowie", ar: "الأبطال" },
  "tools.pack.category.heroGear": { en: "Hero gear", de: "Heldenausrüstung", ko: "영웅 장비", pl: "Ekwipunek bohaterów", ar: "عتاد الأبطال" },
  "tools.pack.category.governorGear": { en: "Governor gear & charms", de: "Gouverneursausrüstung & Talismane", ko: "영주 장비 및 부적", pl: "Ekwipunek gubernatora i amulety", ar: "عتاد الحاكم والتعاويذ" },
  "tools.pack.category.pets": { en: "Pets", de: "Haustiere", ko: "펫", pl: "Zwierzaki", ar: "الحيوانات" },
  "tools.pack.category.other": { en: "Other", de: "Sonstiges", ko: "기타", pl: "Inne", ar: "أخرى" },

  // Chrome
  "lang.label": { en: "Language", de: "Sprache", ko: "언어", pl: "Język", ar: "اللغة" },
  "theme.toggle": { en: "Toggle dark mode", de: "Dunkelmodus umschalten", ko: "다크 모드 전환", pl: "Przełącz tryb ciemny", ar: "تبديل الوضع الداكن" },
  "footer.disclaimer": {
    en: "Fan-made community site for Kingshot Kingdom 1241. Not affiliated with the game's publisher.",
    de: "Von Fans erstellte Community-Seite für Kingshot-Königreich 1241. Nicht mit dem Publisher des Spiels verbunden.",
    ko: "Kingshot 1241 왕국의 팬 커뮤니티 사이트입니다. 게임 퍼블리셔와 무관합니다.",
    pl: "Fanowska strona społeczności Królestwa 1241 w Kingshot. Niepowiązana z wydawcą gry.",
    ar: "موقع مجتمعي من صنع المعجبين لمملكة 1241 في Kingshot. غير تابع لناشر اللعبة.",
  },
  "footer.translationNote": {
    en: "Translations are generated automatically and reviewed by players. Spotted a mistake? Tell an admin on Discord.",
    de: "Übersetzungen werden automatisch erstellt und von Spielern geprüft. Fehler gefunden? Sag einem Admin auf Discord Bescheid.",
    ko: "번역은 자동 생성되며 플레이어가 검토합니다. 오류를 발견하면 디스코드에서 관리자에게 알려주세요.",
    pl: "Tłumaczenia są generowane automatycznie i sprawdzane przez graczy. Widzisz błąd? Napisz do admina na Discordzie.",
    ar: "تُولَّد الترجمات تلقائيًا ويراجعها اللاعبون. وجدت خطأ؟ أخبر أحد المشرفين على ديسكورد.",
  },
  "notFound.title": { en: "Page not found", de: "Seite nicht gefunden", ko: "페이지를 찾을 수 없습니다", pl: "Nie znaleziono strony", ar: "الصفحة غير موجودة" },
  "notFound.body": { en: "This page doesn't exist or has moved.", de: "Diese Seite existiert nicht oder wurde verschoben.", ko: "이 페이지는 존재하지 않거나 이동되었습니다.", pl: "Ta strona nie istnieje lub została przeniesiona.", ar: "هذه الصفحة غير موجودة أو تم نقلها." },
  "notFound.home": { en: "Back to home", de: "Zur Startseite", ko: "홈으로", pl: "Wróć na stronę główną", ar: "العودة إلى الرئيسية" },
} satisfies Record<string, Localized>;

export type UiKey = keyof typeof UI_STRINGS;

export const UI_KEYS = Object.keys(UI_STRINGS) as UiKey[];
