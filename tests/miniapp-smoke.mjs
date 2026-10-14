import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const boot = await readFile(new URL("../miniapp-boot.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const landing = await readFile(new URL("../landing.html", import.meta.url), "utf8");
const offer = await readFile(new URL("../offer.html", import.meta.url), "utf8");

assert.match(html, /role="status"[^>]*aria-live="polite"/);
assert.match(html, /viewport-fit=cover/);
// styles.css обязан быть версионирован, но КАКАЯ это версия проверяется ниже
// сверкой всей цепочки. Литерал здесь ронял тест на каждом релизе и толкал
// правку теста вместо проверки, поэтому фиксируем форму, а не значение.
assert.match(html, /styles\.css\?v=[\w.-]+/);
assert.match(boot, /config\.onerror = showFailure/);
assert.match(boot, /app\.onerror = showFailure/);
assert.match(boot, /today\.onerror = showFailure/);
assert.match(boot, /setTimeout\(showFailure, 15000\)/);
assert.match(boot, /assetVersion = "[\w.-]+"/);
assert.doesNotMatch(boot, /app\.src = ".\/app\.js\?v=" \+ configVersion/);

assert.match(app, /new AbortController\(\)/);
assert.match(app, /NETWORK_TIMEOUT_MS = 10000/);
assert.match(app, /\/api\/profile\?refresh=1/);
assert.match(app, /function normalizeProfile\(raw\)/);
// normalizeProfile is an allow-list: a field it forgets silently never reaches the
// screen. is_guess was dropped once, which made a model's guess look like a stated
// fact on the home screen. Every flag the UI reads must survive the copy.
const memoryFields = app.match(/items: arrayOfObjects\(group\.items\)\.map\(\(item\) => \(\{[^}]*\}\)\)/s);
assert.ok(memoryFields, 'memory item allow-list must stay findable');
for (const field of ['needs_confirmation', 'is_guess', 'editable', 'expires_on']) {
  assert.ok(memoryFields[0].includes(field), 'allow-list must carry ' + field);
}
const reminderNormalizerSource = app.match(/function reminderHourOrNull\(value\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(reminderNormalizerSource, "reminder normalizer must stay independently testable");
const reminderHourOrNull = vm.runInNewContext("(" + reminderNormalizerSource + ")");
assert.equal(reminderHourOrNull(null), null);
assert.equal(reminderHourOrNull(undefined), null);
assert.equal(reminderHourOrNull(""), null);
assert.equal(reminderHourOrNull("   "), null);
assert.equal(reminderHourOrNull(false), null);
assert.equal(reminderHourOrNull([]), null);
assert.equal(reminderHourOrNull("21"), 21);
assert.equal(reminderHourOrNull(0), 0);
assert.equal(reminderHourOrNull(24), null);
const offsetNormalizerSource = app.match(/function utcOffsetMinutesOrNull\(value\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(offsetNormalizerSource, "timezone offset normalizer must stay independently testable");
const utcOffsetMinutesOrNull = vm.runInNewContext("(" + offsetNormalizerSource + ")");
assert.equal(utcOffsetMinutesOrNull(null), null);
assert.equal(utcOffsetMinutesOrNull(""), null);
assert.equal(utcOffsetMinutesOrNull(false), null);
assert.equal(utcOffsetMinutesOrNull("180"), 180);
assert.equal(utcOffsetMinutesOrNull(-720), -720);
assert.equal(utcOffsetMinutesOrNull(841), null);
// Привычка рисуется среди тем экрана, а не на своём. Этот блок раньше извлекал
// currentRitualHabit, которой в app.js давно нет: регэксп возвращал undefined,
// vm исполняла "(undefined)" и тест молча не проверял НИЧЕГО. Проверяем то, что
// действительно должно быть правдой.
assert.match(app, /function habitItem\(habit\)/, 'habits must render');
assert.match(app, /habitItem\(h\)/, 'habitItem must actually be called');
assert.doesNotMatch(app, /function habitField\(/, 'the dead habit-card helper is gone');
// Ни счётчика выполнений, ни стриков на экране: срыв здесь материал для разговора,
// а не провал. Счётчики ещё живут в normalizeProfile(p.path) — это данные человека,
// их не выбрасываем; проверяем, что карточка привычки их не рисует.
assert.doesNotMatch(
  app.match(/function habitItem\(habit\)[\s\S]*?\n\}/)?.[0] ?? "",
  /done_count|streak|стрик/i,
  'the habit card never counts or shames',
);
// Человек с привычками, но без разделов, обязан видеть их, а не пустой экран.
assert.match(app, /sections\.length \|\| habits\.length/, 'habits alone must open the screen');
assert.doesNotMatch(app, /raw_transcript|crisis_reason/);

assert.doesNotMatch(app, /function changePathBlock/);
assert.match(app, /\/api\/outcomes/);
assert.match(app, /function outcomeQuestion\(/);
assert.match(app, /Любой исход подходит/);
assert.match(app, /deep_helpfulness/);
assert.match(app, /deep_followup/);
assert.doesNotMatch(app, /outcome_feedback.*intention|outcome_feedback.*user_words/);
assert.match(app, /Дословно из твоих сообщений/);
assert.match(app, /Выдели 20–30 минут/);
assert.match(app, /не за рулём и не на работе/);
assert.doesNotMatch(app, /Твои подтверждённые слова/);
assert.match(app, /Гипотеза проводника, не факт/);
assert.match(app, /\/api\/deep-session\/delete/);
assert.match(app, /session_id: sessionId/);
assert.match(app, /Связанный с ним текущий шаг тоже будет удалён/);
assert.match(app, /Подтверждённый итог пока не сохранён/);
assert.match(app, /Скопировать \/imagine/);
assert.match(app, /Ты управляешь памятью/);
assert.match(app, /\/api\/memory\/control/);
assert.match(app, /\/api\/memory\/export/);
assert.match(app, /delete_all/);
assert.match(app, /delete_class/);
assert.match(app, /Новые записи на паузе/);
// Провенанс остаётся у каждой записи. Подпись раскрытия менялась, поэтому
// проверяем саму возможность, а не её формулировку.
assert.match(app, /memory-more-toggle/);
assert.match(app, /memory-more-line", item\.source/);
assert.match(app, /memory-more-line", item\.why/);
assert.match(app, /Добавить важное самому/);

assert.match(app, /payments_available === true/);
assert.match(app, /Новое оформление временно закрыто/);
assert.match(app, /Не покупай Stars специально для MindCoach/);
assert.match(app, /\["30 дней", monthly === null \? "цена недоступна"/);
assert.match(app, /\["365 дней", annual === null \? "цена недоступна"/);
assert.doesNotMatch(app, /Number\(b\.monthly_xtr\) \|\| 500/);
assert.doesNotMatch(app, /Number\(b\.annual_xtr\) \|\| 5000/);
assert.match(app, /function isTelegramInvoiceUrl\(value\)/);
assert.match(app, /url\.hostname === "t\.me"/);
assert.match(app, /p\.safety_pause = Boolean\(p\.safety_pause\)/);
assert.match(app, /Позвонить 112/);
assert.match(app, /tg\.openLink/);
assert.match(html, /name="referrer" content="no-referrer"/);
assert.match(app, /@PremiumBot/);
assert.match(app, /Пополни баланс минимум на/);
assert.match(app, /Проверь рублёвую цену/);
// Лимит проверяется ниже вместе с лендингом и каноном из payments.py: держать
// его здесь отдельным числом уже один раз позволило трём местам разойтись.
assert.doesNotMatch(app, /Разговоры без дневного лимита/);
assert.match(app, /не скидка и не депозит MindCoach/);
assert.match(app, /Я не увижу, о чём ты пишешь/);
assert.doesNotMatch(app, /карта Мир|карты Мир|МИР/);
assert.match(app, /status === "failed"/);
assert.match(app, /status === "pending"/);
assert.match(app, /status === "cancelled"/);

assert.match(app, /themeChanged/);
assert.match(app, /themeParams/);
assert.match(app, /colorScheme/);
assert.match(app, /setBottomBarColor/);
assert.match(styles, /--tg-theme-bg-color/);
assert.match(styles, /--tg-content-safe-area-inset-bottom/);
assert.match(styles, /--tg-viewport-stable-height/);
assert.match(styles, /prefers-reduced-motion: reduce/);
assert.match(styles, /min-width: 320px/);
assert.match(styles, /min-height: 44px/);
assert.match(styles, /\.outcome-option[\s\S]*min-height: 48px/);
assert.match(styles, /\.outcome-options[\s\S]*gap: 8px/);
assert.match(styles, /\.memory-origin-toggle,[\s\S]*min-height: 44px/);
assert.match(styles, /@media \(max-width: 359px\)[\s\S]*\.memory-global-actions/);

assert.match(app, /Сессия завершилась/);
assert.match(app, /Обновить статус/);
assert.match(app, /function changeExperimentView\(raw\)/);
assert.match(app, /Пауза тоже часть пути/);
assert.doesNotMatch(app, /latestMemory\.summary \+ " Что изменилось/);
assert.match(app, /item\.needs_confirmation \? "reject" : "delete"/);
assert.match(app, /История разговора останется до полного сброса данных/);
assert.match(html, /id="action-status"[^>]*role="status"[^>]*aria-live="polite"/);
assert.doesNotMatch(app, /function psycheMap/);
assert.doesNotMatch(app, /root\.appendChild\(pathBlock/);
assert.doesNotMatch(app, /root\.appendChild\(upgradeNudge/);

assert.match(landing, />500 <span>Stars \/ 30 дней<\/span>/);
assert.match(landing, /Годовой доступ: 5000 Stars/);
assert.match(landing, /Пополните баланс минимум на 500 Stars/);
assert.match(offer, /30 дней — 500 Telegram Stars/);
assert.match(offer, /365 дней — 5000 Telegram Stars/);
assert.match(offer, /@PremiumBot/);
assert.doesNotMatch(landing, /Подписка за 250 Telegram/);

// Deep-link вместо копирования команды: мини-апп не может отправить сообщение
// от имени человека, поэтому открывает чат ссылкой ?start=<action>.
const commandActionSource = app.match(/function commandAction\(command, label, statusNode, action, linkLabel\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(commandActionSource, "commandAction must stay independently testable");

function runCommandAction(username) {
  const opened = [];
  const listeners = [];
  const sandbox = {
    botUsername: username,
    tg: { openTelegramLink: (url) => opened.push(url) },
    el: (tag, cls, text) => ({
      tag,
      cls,
      textContent: text,
      type: "",
      addEventListener: (event, handler) => listeners.push([event, handler]),
    }),
    copyPlainText: async () => true,
    encodeURIComponent,
    window: { open: (url) => opened.push(url) },
  };
  const fn = vm.runInNewContext("(" + commandActionSource + ")", sandbox);
  const status = { textContent: "" };
  const button = fn("/imagine", "Скопировать /imagine", status, "imagine", "Начать сессию в чате");
  return { button, status, opened, listeners };
}

const linked = runCommandAction("MindCoachBot");
assert.equal(linked.button.textContent, "Начать сессию в чате");
linked.listeners[0][1]();
assert.deepEqual(linked.opened, ["https://t.me/MindCoachBot?start=imagine"]);

const fallback = runCommandAction(null);
assert.equal(fallback.button.textContent, "Скопировать /imagine");
assert.deepEqual(fallback.opened, []);

assert.match(app, /profile\.bot_username === "string"/);
assert.match(app, /commandAction\("\/imagine", "Скопировать \/imagine", status, "imagine", "Начать сессию в чате"\)/);

// Память: правка/удаление больше не кричат с каждой карточки, но остаются доступны.
// Отклонение неподтверждённой гипотезы остаётся на виду — это выбор, не разрушение.
assert.match(app, /memoryEditForm\(item, types\)/);
assert.match(app, /memory-danger-quiet", item\.needs_confirmation \? "Отклонить" : "Удалить"/);
assert.match(app, /memory-manage-toggle", "Удалить весь раздел"/);
assert.match(styles, /\.memory-manage \{/);
assert.match(styles, /\.memory-manage-toggle \{/);
// Статус записи читается линией слева, а не только подписью.
assert.match(styles, /\.memory-record\.is-pending \{/);
assert.match(styles, /\.memory-record\.is-guess \{/);
// Раздела «Практики» больше нет, но сохранённое перенесено в «Память».

// Один экран вместо трёх вкладок. Измерено 18.09: мини-апп открывали 3 раза
// за всю жизнь продукта, а удалённые разделы рендерили ключи, которых нет ни в
// одном профиле. Экран строится из profiles.sections — единственного места,
// где у людей реально что-то есть.
assert.match(app, /function understandingScreen\(p\)/);
assert.match(app, /function understandingItem\(item\)/);
assert.match(app, /function threadLine\(thread\)/);
assert.match(app, /root\.appendChild\(understandingScreen\(p\)\)/);
assert.doesNotMatch(app, /function profileTabShell/, 'the tab shell is gone');
assert.doesNotMatch(app, /PROFILE_TABS/, 'no first-level tabs remain');
// Права на данные обязаны оставаться достижимыми без вкладки «Доступ».
assert.match(app, /memoryControlsBlock\(p\.memory_center/);
assert.match(app, /legalLinks\(\)/);
// Нить — гипотеза, и подписана как гипотеза.
assert.match(app, /Это догадка, а не вывод/);
// Перечисление ярлыков не склеивается через «и»: ярлык сам может его содержать
// («Анима и Анимус»), и тогда строка читается как сбой.
assert.match(app, /labels\.join\("; "\)/);
assert.match(styles, /\.understanding \{/);
assert.match(styles, /\.thread \{/);
assert.match(styles, /\.understanding--open \{/);
// Фикстура стенда обязана нести sections и threads: без них скриншот
// показывает экран без содержимого продукта и ничего не доказывает.
const preview = await readFile(new URL("./preview-server.mjs", import.meta.url), "utf8");
assert.match(preview, /sections: /, 'the stand must render real section shape');
assert.match(preview, /threads: /, 'the stand must render a thread');

// Наблюдения — то, что человек накопил. Владелец 18.09 открыл экран и сказал,
// что «потерялось очень много личных моментов»: показывалось ~2 КБ summary при
// 31 КБ наблюдений. Лента свёрнута, но полная, и порядок задаёт фронт.
assert.match(app, /function evidenceBlock\(item\)/);
assert.match(app, /Из чего это сложилось/);
assert.match(app, /localeCompare\(String\(a\.observed_at/, 'the front end sorts, newest first');
assert.doesNotMatch(app, /evidence\.slice\(0,\s*\d+\)/, 'the ledger is never silently truncated');
assert.match(styles, /\.evidence-list \{/);
// Фикстура обязана нести наблюдения, иначе скриншот снова ничего не доказывает.
assert.match(preview, /observation: /, 'the stand must carry real observations');
// Фикстура обязана нести привычку: с habits: [] скриншот снова ничего не докажет.
assert.match(preview, /serves: /, 'the stand must carry a habit with its need');

// Обещание подписки живёт в трёх местах (payments.py, landing.html, здесь) и 19.09
// разошлось во всех трёх: 30 сообщений при живом лимите 20 и практики, снятые 18.09.
// Число и обещания проверяются здесь, чтобы расхождение падало, а не продавалось.
for (const [name, text] of [["app.js", app], ["landing.html", landing]]) {
  assert.match(text, /до 20 сообщений в день/, name + ' must state the real daily limit');
  assert.doesNotMatch(text, /до 30 сообщений/, name + ' still promises the old limit');
  assert.match(text, /[Пп]исьмо недели/, name + ' must lead with the weekly letter');
}
assert.doesNotMatch(app, /Дополнительные практики/, 'the practices were removed on 18.09');

// Экспорт уходит файлом в чат: скачивание blob в Telegram WebView молча проваливалось.
assert.match(app, /\/api\/memory\/export-to-chat/, 'export must go through the chat');
assert.doesNotMatch(app, /link\.download/, 'the broken download path is gone');
assert.doesNotMatch(app, /Проверь загрузки устройства/, 'it never landed in downloads');
assert.match(app, /Прислать мою память в чат/, 'the button must say what actually happens');
// Привычки показываются ВСЕ и снимаются по одной. 19.09.2026 владелец: прятать
// записи и отсылать к специалисту нельзя, а забыть привычку должно быть можно без
// удаления всей памяти.
assert.doesNotMatch(app, /habits_withheld|withheldNote/, 'nothing about the person is hidden');
assert.match(app, /\/api\/profile\/habit\/dismiss/, 'a habit must be removable on its own');
assert.match(app, /Забыть эту привычку/, 'the card must offer to forget it');
assert.match(app, /confirmAction\(/, 'forgetting asks first');

// Вся цепочка загрузки должна нести ОДНУ версию.
// index.html -> root-redirect.js?v=X -> miniapp-boot.js?v=X -> app.js?v=assetVersion.
// Если поднять версию только в конце цепочки, телефон возьмёт из кэша старый
// root-redirect.js, тот подтянет старый boot, и новый код не доедет никогда.
const rootRedirect = await readFile(new URL("../root-redirect.js", import.meta.url), "utf8");
const chainVersions = new Set();
for (const [label, text, re] of [
  ["index.html -> root-redirect.js", html, /root-redirect\.js\?v=([\w.-]+)/],
  ["index.html -> styles.css", html, /styles\.css\?v=([\w.-]+)/],
  ["root-redirect.js -> miniapp-boot.js", rootRedirect, /miniapp-boot\.js\?v=([\w.-]+)/],
  ["miniapp-boot.js assetVersion", boot, /assetVersion = "([\w.-]+)"/],
]) {
  const found = text.match(re);
  assert.ok(found, label + " must carry a version");
  chainVersions.add(found[1]);
}
assert.equal(
  chainVersions.size, 1,
  "every step of the load chain must use one version, got: " + [...chainVersions].join(", "),
);

console.log("Mini App redesign smoke passed");

// The voice entry is the primary action of the first "talk" block, not a footer link.
const voiceEntry = app.match(/function attachVoiceEntry\(root\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(voiceEntry, 'voice entry must stay findable');
assert.match(voiceEntry, /root\.querySelector\('\.talk'\)/);
assert.match(voiceEntry, /talk\.insertBefore\(button, chat\)/);
console.log('Voice entry placement contract passed');

// Voice settings: a clear way back, automatic return after saving, voice preview.
const voiceScreen = app.match(/function openVoiceScreen\(options = \{\}\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(voiceScreen, 'voice screen must stay findable');
assert.match(voiceScreen, /'← Назад'/, 'open settings show a back button');
assert.match(voiceScreen, /closeSettings\(/, 'saving returns to the conversation');
assert.match(voiceScreen, /\/api\/voice\/preview/, 'voices can be previewed');
// Owner 2026-10-14: choosing by description is odd; every voice has its own play button.
assert.match(voiceScreen, /type = 'radio'/, 'voices are a visible list, not a dropdown');
assert.match(voiceScreen, /voice-play/, 'each voice row has a play button');
assert.match(voiceScreen, /`Послушать голос \$\{name\}`/, 'play buttons name their voice');
assert.doesNotMatch(voiceScreen, /'Перебить'/, 'a spoken «стоп» replaces the interrupt button');
assert.match(voiceScreen, /«стоп»/, 'the screen tells how to stop the guide');
console.log('Voice settings back, return-after-save, per-voice preview, spoken stop: passed');

// Voice minutes (owner decision 2026-10-14): what is left is always visible and honest.
assert.match(voiceScreen, /showMinutes\(options\.minutes\)/, 'the screen shows minutes on open');
assert.match(voiceScreen, /minutes: showMinutes/, 'minutes update after every turn');
const minutesSource = app.match(/function voiceMinutesText\([\s\S]*?\n\}/)?.[0];
assert.ok(minutesSource, 'minutes text must stay findable');
const voiceMinutesText = new Function(`${minutesSource}; return voiceMinutesText;`)();
assert.equal(voiceMinutesText({ kind: 'trial', used_seconds: 70, left_seconds: 230, limit_minutes: 5 }),
  'Пробный голос: осталось 3 мин из 5. Считается только речь.');
assert.equal(voiceMinutesText({ kind: 'plan', used_seconds: 3570, left_seconds: 30, limit_minutes: 60 }),
  'Осталось меньше минуты голоса.');
assert.equal(voiceMinutesText({ kind: 'plan', used_seconds: 3600, left_seconds: 0, limit_minutes: 60 }),
  'Минуты голоса на этот период закончились.');
assert.match(voiceMinutesText({ kind: 'owner', used_seconds: 600, left_seconds: 3000, limit_minutes: 60 }), /без ограничения/);
console.log('Voice minutes are shown and updated: passed');
