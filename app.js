"use strict";

// Mini App личного пути. Получает профиль по подписанному Telegram initData.
// Секретов на фронте нет: подпись проверяет бэкенд, он же владеет хранилищем.

const tg = window.Telegram ? window.Telegram.WebApp : null;

const STATUS_LABELS = {
  emerging: "намёк",
  working: "гипотеза",
  confirmed_by_user: "подтверждено",
};

// Уверенность гипотезы показана и знаком, и человеческой подписью: цвет не является
// единственным носителем смысла.
const CONFIDENCE_MOON = {
  low: { shift: 3.5, cap: "едва проявлено" },
  medium: { shift: 9, cap: "проявляется" },
  high: { shift: 15, cap: "ясно видно" },
};

// «Что это» — короткая расшифровка юнгианской рабочей линзы. Это метафоры для
// самонаблюдения, а не устройство психики, диагноз или причинное объяснение.
// Пользователь решает, помогает ли линза заметить что-то в реальной ситуации.
const FACET_GUIDE = {
  life_context: {
    glyph: "✦",
    guide:
      "Контекстная линза: обстоятельства, роли и переходы, на фоне которых можно проверять остальные гипотезы.",
  },
  patterns: {
    glyph: "∞",
    guide:
      "Рабочая линза для поиска сходства между реакциями и выборами. Повтор считается значимым только там, где ты узнаёшь его на конкретных примерах.",
  },
  fears: {
    glyph: "▲",
    guide:
      "Линза для исследования того, что страх защищает или ограничивает. Его смысл нельзя определить без твоего опыта и конкретной ситуации.",
  },
  childhood_wounds: {
    glyph: "✶",
    guide:
      "Линза для проверки возможной связи между ранним опытом и нынешней реакцией. Такая связь является гипотезой, а не установленной причиной.",
  },
  persona: {
    glyph: "◐",
    guide:
      "Юнгианская метафора социальных ролей и ожиданий. Помогает заметить, где выбранная роль поддерживает тебя, а где расходится с твоими потребностями.",
  },
  shadow: {
    glyph: "●",
    guide:
      "Юнгианская метафора качеств и чувств, которые трудно признавать своими. Она приглашает к проверке без стыда, но ничего не доказывает о тебе.",
  },
  anima_animus: {
    glyph: "☽",
    guide:
      "Историческая юнгианская метафора внутренних качеств, которые культура связывала с полом. Здесь мы используем её гендерно-нейтрально: как способ исследовать непривычные качества и ожидания в отношениях.",
  },
  self: {
    glyph: "◎",
    guide:
      "Юнгианская метафора большей целостности: возможности удерживать разные стороны себя и выбирать направление без требования стать «идеальным».",
  },
  mother_complex: {
    glyph: "⊕",
    guide:
      "Рабочая линза для проверки того, как опыт заботы мог отразиться на близости, границах и зависимости. Это не диагноз и не обвинение матери.",
  },
  father_complex: {
    glyph: "⊙",
    guide:
      "Рабочая линза для проверки того, как опыт авторитета мог отразиться на правилах, признании и самостоятельности. Это не диагноз и не обвинение отца.",
  },
};

// Расшифровки архетипов по имени (extraction пишет свободные имена — матчим мягко).
const ARCHETYPE_GUIDE = [
  [/трикстер/i, "Нарушитель правил и хитрец. Ломает застывший порядок, чтобы освободить место живому."],
  [/геро/i, "Тот, кто выходит навстречу испытанию. Сила — в преодолении; риск — не уметь останавливаться."],
  [/мудрец|сенекс|стар(ец|ик)/i, "Ищущий смысл и видящий целое. Опора в хаосе; риск — спрятаться в голове от жизни."],
  [/puer|вечн(ый|ая)/i, "Вечный юноша: полёт, возможности, нелюбовь к ограничениям. Дар лёгкости — и трудность укоренения."],
  [/велик(ая|ой) мат|мать/i, "Питающее и оберегающее начало. В светлой стороне — забота; в тёмной — удержание и поглощение."],
  [/странник|путник|искатель/i, "Идущий своим путём. Дом — дорога; риск — вечно уходить вместо того, чтобы приходить."],
  [/тень/i, "Отвергнутое и вытесненное, ставшее фигурой. Пугает — и хранит запертую энергию."],
  [/анимус/i, "Внутреннее мужское: решимость, слово, структура — как оно звучит в тебе."],
  [/анима/i, "Внутреннее женское: чувство, образ, связь с глубиной — как оно звучит в тебе."],
  [/сирот/i, "Знающий покинутость. Ищет принадлежность; дар — эмпатия к чужой боли."],
  [/творец|художник/i, "Претворяющий внутреннее в форму. Живёт, когда создаёт; страдает, когда копирует."],
  [/правитель|король|королев/i, "Держащий порядок и ответственность. Светлая сторона — опора; тёмная — контроль."],
];
const ARCHETYPE_FALLBACK =
  "Архетип здесь — метафорический образ для самонаблюдения. Его полезность определяешь ты по собственным ассоциациям.";

// Рамка работы с привычкой (/habit): привычка — не враг, а служение потребности.
// Никаких стриков и стыда — срыв здесь материал, а не провал.
const HABIT_GUIDE =
  "Привычка здесь — не враг и не слабость: она служит какой-то настоящей потребности. " +
  "В этой работе мы вслушиваемся, чему именно, — и ищем ритуал замещения, который кормит " +
  "ту же потребность честнее. Срыв — не провал, а материал для следующего шага.";


function pluralRu(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function labelSection(section, id, text, className) {
  const heading = el("h2", className, text);
  heading.id = id;
  section.setAttribute("aria-labelledby", id);
  section.appendChild(heading);
  return heading;
}

function setView(node) {
  const app = document.getElementById("app");
  const initialRender =
    app.getAttribute("aria-busy") === "true" || Boolean(app.querySelector('[aria-busy="true"]'));
  app.replaceChildren(node);
  app.setAttribute("aria-busy", "false");
  const heading = node.querySelector && node.querySelector("[data-view-heading]");
  const focusState = node.classList && node.classList.contains("state");
  if (heading && (initialRender || focusState)) queueMicrotask(() => heading.focus());
}

function stateView(title, sub, glyph, actions, kind) {
  const wrap = el("section", "state");
  wrap.setAttribute("role", kind === "error" ? "alert" : "status");
  wrap.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
  wrap.appendChild(el("div", "glyph", glyph || "✦"));
  const heading = el("h1", "state-title serif", title);
  heading.tabIndex = -1;
  heading.dataset.viewHeading = "true";
  wrap.appendChild(heading);
  if (sub) wrap.appendChild(el("p", "state-sub", sub));
  if (actions && actions.length) {
    const row = el("div", "state-actions");
    actions.forEach((action, index) => {
      const btn = el("button", index ? "state-action state-action--quiet" : "state-action", action.label);
      btn.type = "button";
      btn.addEventListener("click", action.onClick);
      row.appendChild(btn);
    });
    wrap.appendChild(row);
  }
  return wrap;
}

// --- сеть -------------------------------------------------------------------

function apiHeaders(initData, withJson) {
  const headers = {
    Authorization: "tma " + initData,
  };
  if (withJson) headers["Content-Type"] = "application/json";
  return headers;
}

function freshApiUrl(path) {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const sep = path.includes("?") ? "&" : "?";
  return base.replace(/\/$/, "") + path + sep + "ts=" + Date.now();
}

const NETWORK_TIMEOUT_MS = 10000;
// Экспорт собирает архив из всей истории и памяти на сервере, потом Telegram ещё
// доставляет файл. Десяти секунд ему мало: обрыв по таймауту читался бы как отказ,
// хотя архив в этот момент уже уходил в чат.
const EXPORT_TIMEOUT_MS = 45000;

async function fetchWithDeadline(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || NETWORK_TIMEOUT_MS);
  try {
    return await fetch(url, { ...(options || {}), signal: controller.signal });
  } catch (error) {
    if (error && error.name === "AbortError") throw new Error("timeout");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arrayOfObjects(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function practiceKeyOrNull(value) {
  const key = cleanText(value);
  return /^[0-9a-f]{24}$/.test(key) ? key : null;
}


function reminderHourOrNull(value) {
  // Number(null) and Number("") are both 0. Treating either as a real hour invents a
  // midnight reminder that the person never enabled.
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^(?:[0-9]|1[0-9]|2[0-3])$/.test(value.trim())) {
    return null;
  }
  const hour = typeof value === "string" ? Number(value.trim()) : value;
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

function utcOffsetMinutesOrNull(value) {
  if (
    value === null || value === undefined || typeof value === "boolean" ||
    typeof value === "object" ||
    (typeof value === "string" && value.trim() === "")
  ) return null;
  const offset = Number(value);
  return Number.isInteger(offset) && offset >= -720 && offset <= 840 ? offset : null;
}

function utcOffsetLabel(minutes) {
  const offset = utcOffsetMinutesOrNull(minutes);
  if (offset === null) return "UTC";
  if (offset === 0) return "UTC";
  const sign = offset > 0 ? "+" : "−";
  const absolute = Math.abs(offset);
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  return "UTC" + sign + String(hours) + (rest ? ":" + String(rest).padStart(2, "0") : "");
}

const DEEP_SESSION_STATUSES = new Set([
  "preparing",
  "active",
  "integrating",
  "completed",
  "aborted",
]);
const DEEP_SESSION_STAGES = new Set([
  "prepare",
  "intention",
  "explore",
  "integrate",
  "confirm",
]);

// Raw dialogue and safety flags stay on the backend. Any model interpretation that is
// present in the result is rendered separately and explicitly labelled as a hypothesis.
function normalizeDeepSessions(value) {
  const block = objectOrEmpty(value);
  const summary = objectOrEmpty(block.summary);
  const exactContract = Array.isArray(value);
  const source = (exactContract ? arrayOfObjects(value) : arrayOfObjects(block.recent)).slice(0, 5);
  const recent = source
    .map((item) => {
      const result = objectOrEmpty(item.result);
      return {
        id: cleanText(item.id),
        status: exactContract
          ? "completed"
          : (DEEP_SESSION_STATUSES.has(item.status) ? item.status : ""),
        stage: exactContract
          ? "confirm"
          : (DEEP_SESSION_STAGES.has(item.stage) ? item.stage : ""),
        intention: cleanText(item.intention),
        started_at: cleanText(item.started_at),
        ended_at: cleanText(item.ended_at),
        follow_up_at: cleanText(item.follow_up_at),
        result: {
          takeaway: cleanText(result.takeaway),
          title: cleanText(result.title),
          user_words: Array.isArray(result.user_words)
            ? result.user_words.map(cleanText).filter(Boolean).slice(0, 3)
            : [],
          model_hypothesis: cleanText(result.model_hypothesis),
          uncertainty: cleanText(result.uncertainty),
          next_step: cleanText(result.next_step),
          follow_up_at: cleanText(result.follow_up_at),
          check_in_days: Math.max(0, Number(result.check_in_days) || 0),
          check_in_on: cleanText(result.check_in_on),
          closing_question: cleanText(result.closing_question),
        },
      };
    })
    .filter((item) => item.id && item.status);
  const completed = recent.filter((item) => item.status === "completed").length;
  const lastCompleted = recent.find((item) => item.status === "completed");
  return {
    summary: {
      total: Math.max(0, Number(summary.total) || recent.length),
      completed: Math.max(0, Number(summary.completed) || completed),
      last_completed_at: cleanText(summary.last_completed_at) ||
        (lastCompleted ? lastCompleted.ended_at : ""),
    },
    recent,
  };
}

function normalizeProfile(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = { ...raw };
  const completeness = objectOrEmpty(p.completeness);
  p.completeness = {
    percent: Number.isFinite(Number(completeness.percent)) ? Number(completeness.percent) : 0,
    is_sufficient: Boolean(completeness.is_sufficient),
    missing: Array.isArray(completeness.missing) ? completeness.missing.filter((x) => typeof x === "string") : [],
  };
  p.sections = arrayOfObjects(p.sections);
  p.archetypes = arrayOfObjects(p.archetypes);
  p.habits = arrayOfObjects(p.habits).map((habit) => ({
    ...habit,
    name: cleanText(habit.name),
    summary: cleanText(habit.summary),
    trigger: cleanText(habit.trigger),
    serves: cleanText(habit.serves),
    ritual: cleanText(habit.ritual),
    fallback: cleanText(habit.fallback),
    practice_key: practiceKeyOrNull(habit.practice_key),
    is_current_practice: habit.is_current_practice === true,
  })).filter((habit) => habit.name);
  p.memories = arrayOfObjects(p.memories);
  const memoryCenter = objectOrEmpty(p.memory_center);
  p.memory_center = {
    writes_paused: Boolean(memoryCenter.writes_paused),
    manual_types: arrayOfObjects(memoryCenter.manual_types)
      .map((item) => ({
        value: typeof item.value === "string" ? item.value : "",
        label: typeof item.label === "string" ? item.label : "",
      }))
      .filter((item) => item.value && item.label),
    groups: arrayOfObjects(memoryCenter.groups).map((group) => ({
      class: typeof group.class === "string" ? group.class : "",
      label: typeof group.label === "string" ? group.label : "",
      description: typeof group.description === "string" ? group.description : "",
      items: arrayOfObjects(group.items).map((item) => ({
        key: typeof item.key === "string" ? item.key : "",
        type: typeof item.type === "string" ? item.type : "",
        type_label: typeof item.type_label === "string" ? item.type_label : "Важное",
        content: typeof item.content === "string" ? item.content : "",
        source: typeof item.source === "string" ? item.source : "",
        why: typeof item.why === "string" ? item.why : "",
        recorded_on: typeof item.recorded_on === "string" ? item.recorded_on : "",
        expires_on: typeof item.expires_on === "string" ? item.expires_on : "",
        needs_confirmation: Boolean(item.needs_confirmation),
        // Догадка Проводника должна доезжать до экрана, иначе она выглядит как факт.
        is_guess: Boolean(item.is_guess),
        editable: Boolean(item.editable),
      })).filter((item) => item.key && item.content),
    })).filter((group) => group.class && group.label),
  };
  p.threads = arrayOfObjects(p.threads).map((thread) => ({
    ...thread,
    members: arrayOfObjects(thread.members),
  }));
  p.billing = objectOrEmpty(p.billing);
  p.safety_pause = Boolean(p.safety_pause);
  p.access = objectOrEmpty(p.access);
  const path = objectOrEmpty(p.path);
  p.path = {
    ...path,
    ritual_done_count: Math.max(0, Number(path.ritual_done_count) || 0),
    growth_done_count: Math.max(0, Number(path.growth_done_count) || 0),
    ritual_done_at: cleanText(path.ritual_done_at),
    growth_done_at: cleanText(path.growth_done_at),
    growth_name: cleanText(path.growth_name),
    growth_step: cleanText(path.growth_step),
    growth_reminder_hour: reminderHourOrNull(path.growth_reminder_hour),
    practice_timezone: cleanText(path.practice_timezone),
    practice_utc_offset_minutes: utcOffsetMinutesOrNull(path.practice_utc_offset_minutes),
    practice_fallback_utc_offset_minutes: utcOffsetMinutesOrNull(
      path.practice_fallback_utc_offset_minutes,
    ),
    nudges_paused_at: cleanText(path.nudges_paused_at),
  };
  p.change_experiment = objectOrEmpty(p.change_experiment);
  p.outcome_prompts = objectOrEmpty(p.outcome_prompts);
  p.outcome_feedback = arrayOfObjects(p.outcome_feedback).map((item) => ({
    event: typeof item.event === "string" ? item.event : "",
    value: typeof item.value === "string" ? item.value : "",
    measurement_point: typeof item.measurement_point === "string"
      ? item.measurement_point
      : "",
    subject_key: typeof item.subject_key === "string" ? item.subject_key : "",
  })).filter((item) => item.event && item.value && item.measurement_point && item.subject_key);
  const ritual = objectOrEmpty(p.ritual);
  p.ritual = {
    ...ritual,
    reminder_hour: reminderHourOrNull(ritual.reminder_hour),
    done_count: Math.max(0, Number(ritual.done_count) || 0),
  };
  p.live_sync = objectOrEmpty(p.live_sync);
  p.referral = objectOrEmpty(p.referral);
  p.deep_sessions = normalizeDeepSessions(p.deep_sessions);
  p.is_paid = Boolean(p.is_paid);
  p.show_upgrade = Boolean(p.show_upgrade);
  return p;
}

async function fetchProfile(refreshOnly) {
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");

  const path = refreshOnly ? "/api/profile?refresh=1" : "/api/profile";
  const res = await fetchWithDeadline(freshApiUrl(path), {
    headers: apiHeaders(initData, false),
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  return normalizeProfile((await res.json()).profile); // null, если профиля ещё нет
}

// Отклонить гипотезу («это не про меня»). Бэкенд метит раздел dismissed: он выпадает
// из профиля и больше не предлагается моделью. Возвращает обновлённый профиль.
async function dismissSection(key) {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");

  const res = await fetchWithDeadline(base.replace(/\/$/, "") + "/api/profile/dismiss", {
    method: "POST",
    headers: apiHeaders(initData, true),
    body: JSON.stringify({ key }),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  await res.json();
  return fetchProfile(true);
}

async function confirmSection(key) {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetchWithDeadline(base.replace(/\/$/, "") + "/api/profile/confirm", {
    method: "POST",
    headers: apiHeaders(initData, true),
    cache: "no-store",
    body: JSON.stringify({ key }),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  await res.json();
  return fetchProfile(true);
}

// Удалить один подтверждённый факт по opaque key, который бэкенд уже вернул владельцу.
async function controlMemory(action, payload) {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetchWithDeadline(base.replace(/\/$/, "") + "/api/memory/control", {
    method: "POST",
    headers: apiHeaders(initData, true),
    cache: "no-store",
    body: JSON.stringify({ action, ...(payload || {}) }),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  await res.json();
  return fetchProfile(true);
}

// Снять привычку («это не про меня»). До 19.09.2026 единственным способом забыть
// привычку был полный сброс памяти — несоразмерная цена, которую никто не платит.
async function dismissHabit(name) {
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetchWithDeadline(freshApiUrl("/api/profile/habit/dismiss"), {
    method: "POST",
    headers: apiHeaders(initData, true),
    cache: "no-store",
    body: JSON.stringify({ name: name }),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  await res.json();
  return fetchProfile(true);
}

// Архив памяти уходит ФАЙЛОМ В ЧАТ, а не скачиванием. 19.09.2026 владелец нажал
// «скачать» с телефона, и не произошло ничего: прежний код создавал blob и кликал
// по <a download>, а встроенный браузер Telegram не даёт файловой системы, поэтому
// клик молча проваливался. ZIP, который некуда положить и нечем открыть, правом на
// свои данные не является. Файл в переписке открывается одним тапом на любом
// телефоне и никуда не пропадает.
async function sendMemoryExportToChat() {
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetchWithDeadline(freshApiUrl("/api/memory/export-to-chat"), {
    method: "POST",
    headers: apiHeaders(initData, true),
    cache: "no-store",
    body: "{}",
  }, EXPORT_TIMEOUT_MS);
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  await res.json();
}

async function deleteDeepSession(sessionId) {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetchWithDeadline(base.replace(/\/$/, "") + "/api/deep-session/delete", {
    method: "POST",
    headers: apiHeaders(initData, true),
    cache: "no-store",
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  const body = await res.json();
  if (!body || body.deleted !== true) throw new Error("invalid-response");
  return fetchProfile(true);
}

async function submitOutcome(event, value, measurementPoint, subjectKey) {
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetchWithDeadline(freshApiUrl("/api/outcomes"), {
    method: "POST",
    headers: apiHeaders(initData, true),
    cache: "no-store",
    body: JSON.stringify({
      event,
      value,
      measurement_point: measurementPoint,
      subject_key: subjectKey,
    }),
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("http-" + res.status);
  return res.json();
}


let experimentMutationEpoch = 0;

async function controlExperiment(operation, revision, payload) {
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetchWithDeadline(freshApiUrl("/api/experiment/control"), {
    method: "POST",
    headers: apiHeaders(initData, true),
    cache: "no-store",
    body: JSON.stringify({ operation, revision, payload,
      ...(operation === "edit" ? { clock: practiceClockMetadata() } : {}),
    }),
  });
  if (!res.ok) throw new Error("http-" + res.status);
  const body = await res.json();
  if (!body.change_experiment || !body.change_experiment.revision) {
    throw new Error("invalid-response");
  }
  return body.change_experiment;
}

function practiceClockMetadata() {
  let timezone = null;
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof resolved === "string" && resolved.trim()) timezone = resolved.trim();
  } catch (_) {
    timezone = null;
  }
  const rawOffset = -new Date().getTimezoneOffset();
  const utcOffsetMinutes = Number.isInteger(rawOffset) && rawOffset >= -720 && rawOffset <= 840
    ? rawOffset
    : 0;
  return { timezone, utc_offset_minutes: utcOffsetMinutes };
}


function newRequestId() {
  const cryptoApi = window.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return (
    "topic_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  ).slice(0, 80);
}


// Подтверждение действия: нативное у Telegram, иначе обычный confirm.
function confirmAction(message) {
  return new Promise((resolve) => {
    if (tg && typeof tg.showConfirm === "function") {
      tg.showConfirm(message, (ok) => resolve(!!ok));
    } else {
      resolve(window.confirm(message));
    }
  });
}

function announceAction(message) {
  const region = document.getElementById("action-status");
  if (!region) return;
  region.textContent = "";
  queueMicrotask(() => {
    region.textContent = message;
  });
}

// --- кусочки UI -------------------------------------------------------------


function stat(value, label) {
  const s = el("div", "stat");
  s.appendChild(el("div", "stat-val", String(value)));
  s.appendChild(el("div", "stat-label", label));
  return s;
}




// Привычка рисуется в habitItem рядом с остальными темами. Прежние habitField и
// карточка-трекер с прогрессом удалены: счётчик выполнений превращал срыв в провал,
// а привычка здесь — наблюдение о человеке, а не норматив.

// Блок «что изменилось с прошлого визита». d приходит в payload.dynamics с бэкенда:
// первый визит → тёплое приветствие; есть изменения → дельта глубины + новые грани;
// без изменений → мягкое приглашение продолжить в чате. Содержания тут нет — только
// числа и ярлыки граней (152-ФЗ: бэкенд не отдаёт сюда summary/evidence).
// Спарклайн глубины во времени. history — ряд точек {at, score} с бэкенда (только числа
// и даты, без психо-контента — 152-ФЗ). Рисуем мягкую линию роста: осязаемый прогресс
// = причина возвращаться. Нужно ≥2 точек, иначе линию не построить.
function shareRow(referral, inviteUrl) {
  const r = referral || {};
  const days = r.reward_days || 14;
  const bonus = r.bonus_messages || 5;
  const daysWord = pluralRu(days, "день", "дня", "дней");
  const sec = el("section", "referral");
  sec.appendChild(el("div", "referral-label", "Расти вместе"));
  // Оффер в заголовке — ценность цифрами перед глазами, а не абстрактно «бонусные дни».
  sec.appendChild(el("h2", "referral-title serif", "Позови близкого — тебе +" + days + " " + daysWord));

  // Прогресс показываем, только когда уже кто-то приглашён: ценность уже осязаема.
  if (r.invited) {
    const stats = el("div", "referral-stats");
    stats.appendChild(stat(r.invited, "приглашено"));
    stats.appendChild(stat(r.rewarded || 0, "оформили подписку"));
    stats.appendChild(stat("+" + (r.earned_days || 0), "дней тебе"));
    sec.appendChild(stats);
  }

  sec.appendChild(
    el(
      "p",
      "referral-text",
      r.rewarded
        ? "Спасибо, что делишься путём. Когда останется ещё один близкий — тебе снова +" + days + " " + daysWord + "."
        : "Близкому откроется 7-дневный маршрут и +" + bonus + " дополнительных ответов. После его первой оплаты тебе +" + days + " " + daysWord + " подписки. Ты не увидишь его сообщения, профиль или ответы.",
    ),
  );

  const btn = el("button", "share-btn", "Позвать близкого");
  btn.type = "button";
  btn.addEventListener("click", () => {
    const text =
      "Я прохожу 7-дневный маршрут с ИИ-проводником: замечаю повторяющиеся сценарии и проверяю маленькие шаги в жизни. Тебе по моей ссылке дадут +" + bonus + " ответов. Я не увижу, о чём ты пишешь 🌑";
    const link = "https://t.me/share/url?url=" + encodeURIComponent(inviteUrl) + "&text=" + encodeURIComponent(text);
    if (tg && typeof tg.openTelegramLink === "function") tg.openTelegramLink(link);
    else window.open(link, "_blank");
  });
  sec.appendChild(btn);
  return sec;
}

// Запросить у бэкенда нативную ссылку на Telegram Stars invoice.
async function requestInvoice(period) {
  const base = (window.JUNG_CONFIG && window.JUNG_CONFIG.API_BASE) || "";
  const initData = tg && tg.initData ? tg.initData : "";
  if (!initData) throw new Error("no-init-data");
  const res = await fetchWithDeadline(base.replace(/\/$/, "") + "/api/invoice", {
    method: "POST",
    headers: apiHeaders(initData, true),
    body: JSON.stringify({ period: period || "monthly" }),
  });
  if (!res.ok) throw new Error("http-" + res.status);
  const url = (await res.json()).url;
  if (!isTelegramInvoiceUrl(url)) throw new Error("invalid-invoice-url");
  return url;
}

function isTelegramInvoiceUrl(value) {
  if (typeof value !== "string" || value.length > 240) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "t.me" &&
      /^\/\$[A-Za-z0-9_-]{1,160}$/.test(url.pathname) &&
      !url.search && !url.hash && !url.username && !url.password;
  } catch (error) {
    return false;
  }
}

// Оплата прямо из мини-аппа: человек увидел свой образ → открывает нативный Stars invoice.
// Telegram.WebApp.openInvoice даёт статус закрытия, после успешной оплаты перечитываем
// профиль. Fallback открывает invoice link обычным способом на старых клиентах.
function setPaymentFeedback(node, message, kind) {
  if (!node) return;
  node.textContent = message || "";
  node.dataset.kind = kind || "info";
  node.hidden = !message;
}

function lockUpgradeButtons(locked) {
  document.querySelectorAll(".upgrade-btn").forEach((button) => {
    button.disabled = locked;
  });
}

function startUpgrade(btn, period, feedback) {
  const original = btn.textContent;
  lockUpgradeButtons(true);
  btn.setAttribute("aria-busy", "true");
  btn.textContent = "Открываю оплату…";
  setPaymentFeedback(feedback, "", "info");
  const restore = () => {
    lockUpgradeButtons(false);
    btn.removeAttribute("aria-busy");
    btn.textContent = original;
  };
  requestInvoice(period)
    .then((url) => {
      if (tg && typeof tg.openInvoice === "function") {
        tg.openInvoice(url, (status) => {
          if (status === "paid") {
            activationPending = true;
            clearRefreshTimer();
            setView(
              stateView(
                "Платёж получен",
                "Активирую подписку. Обычно это занимает несколько секунд.",
                "✦",
              ),
            );
            pollForActivation();
            return;
          }
          restore();
          if (status === "failed") {
            setPaymentFeedback(
              feedback,
              "Платёж не прошёл. Stars не списаны. Проверь баланс и попробуй ещё раз.",
              "error",
            );
          } else if (status === "pending") {
            setPaymentFeedback(
              feedback,
              "Telegram ещё обрабатывает платёж. Подожди немного и обнови профиль из чата.",
              "pending",
            );
          } else if (status === "cancelled") {
            setPaymentFeedback(feedback, "Оплата отменена. Тариф можно выбрать позже.", "info");
          } else {
            setPaymentFeedback(feedback, "Статус оплаты не изменился. Можно повторить.", "info");
          }
        });
      } else if (tg && typeof tg.openTelegramLink === "function") {
        tg.openTelegramLink(url);
        restore();
      } else {
        window.open(url, "_blank");
        restore();
      }
    })
    .catch(() => {
      restore();
      setPaymentFeedback(
        feedback,
        "Не получилось открыть оплату. Проверь связь и повтори или отправь /upgrade в чате.",
        "error",
      );
    });
}

// После успешного Stars invoice слегка поллим профиль: successful_payment может прийти
// в long-polling на секунду позже callback Mini App.
function pollForActivation() {
  activationPending = true;
  let attempts = 0;
  const tick = async () => {
    attempts += 1;
    try {
      const profile = await fetchProfile(true);
      if (profile && profile.is_paid) {
        activationPending = false;
        if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.notificationOccurred === "function")
          tg.HapticFeedback.notificationOccurred("success");
        setView(
          stateView(
            "Подписка активна",
            "Спасибо 🌑 Возвращайся в чат: продолжим твой путь без пауз, с того места, где остановились.",
            "✦",
            [{ label: "Вернуться в чат", onClick: closeToChat }],
          ),
        );
        return; // готово — поллинг прекращаем
      }
    } catch (e) {
      /* сеть моргнула — попробуем на следующем тике */
    }
    if (attempts < 18) {
      setTimeout(tick, 10000); // ~3 минуты ждём завершения оплаты
      return;
    }
    setView(
      stateView(
        "Проверим оплату ещё раз",
        "Telegram принял платёж, но активация задержалась. Обнови статус или вернись в чат и напиши /paysupport.",
        "○",
        [
          { label: "Обновить статус", onClick: pollForActivation },
          { label: "Вернуться в чат", onClick: closeToChat },
        ],
        "error",
      ),
    );
    activationPending = false;
  };
  setTimeout(tick, 8000); // первая проверка — после возможной быстрой оплаты
}

// Панель подписки (только для free): после показа реального образа продаём переход
// от понимания к действию, а память делает этот путь непрерывным. Существующие грани не прячем (это данные юзера,
// 152-ФЗ «ты хозяин данных») — показываем, что открывает подписка, и кнопку оплаты.
function upgradeSection(billing, access) {
  const sec = el("section", "upgrade");
  sec.appendChild(el("div", "upgrade-label", "Полный доступ"));
  sec.appendChild(el("h2", "upgrade-title serif", "Разговор с сохранением контекста"));
  sec.appendChild(
    el(
      "p",
      "upgrade-text",
      "Можно возвращаться к разговору с сохранённым контекстом, и раз в неделю я сам " +
        "напишу, что за неделю сходилось в одно. Твои данные остаются доступны и без подписки.",
    ),
  );
  const perks = el("ul", "upgrade-perks");
  // Канон обещания живёт в payments.py:subscription_comparison, здесь его зеркало
  // (JS не импортит Python). 19.09 все три места разошлись: обещались 30 сообщений
  // при живом лимите 20 и практики, снятые 18.09. Правится всюду одновременно.
  [
    "Письмо недели: раз в неделю я сам пишу, что за неделю сходилось в одно",
    "Полные разговоры без трёхдневных пауз, до 20 сообщений в день",
    "Память, которую можно проверить, исправить или поставить на паузу",
  ].forEach((t) => {
    const li = el("li", "upgrade-perk");
    li.appendChild(el("span", "perk-mark", "✓"));
    li.appendChild(el("span", "perk-text", t));
    perks.appendChild(li);
  });
  sec.appendChild(perks);
  const b = billing || {};
  const monthly = Number.isInteger(Number(b.monthly_xtr)) && Number(b.monthly_xtr) > 0
    ? Number(b.monthly_xtr)
    : null;
  const annual = Number.isInteger(Number(b.annual_xtr)) && Number(b.annual_xtr) > 0
    ? Number(b.annual_xtr)
    : null;
  const annualAvailable = b.annual_available === true && annual !== null;
  const paymentsAvailable = b.payments_available === true && monthly !== null;
  if (!paymentsAvailable) {
    const closed = el("div", "checkout-closed");
    closed.appendChild(el("strong", null, "Новое оформление временно закрыто"));
    closed.appendChild(
      el(
        "p",
        null,
        "Бесплатный режим работает. Если платёж уже был или нужен доступ, напиши /paysupport в чате.",
      ),
    );
    const terms = el("dl", "checkout-closed-terms");
    [
      ["30 дней", monthly === null ? "цена недоступна" : monthly + " Stars"],
      ["365 дней", annual === null ? "цена недоступна" : annual + " Stars · разово"],
    ].forEach(
      ([period, price]) => {
        const row = el("div", "checkout-closed-term");
        row.appendChild(el("dt", null, period));
        row.appendChild(el("dd", null, price));
        terms.appendChild(row);
      },
    );
    closed.appendChild(terms);
    closed.appendChild(
      el(
        "p",
        "checkout-closed-note",
        "Не покупай Stars специально для MindCoach, пока оформление закрыто. После открытия их можно будет пополнить через @PremiumBot и сверить сумму в счёте Telegram.",
      ),
    );
    const status = el("p", "command-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    closed.appendChild(commandAction("/paysupport", "Скопировать /paysupport", status, "paysupport", "Написать по оплате"));
    closed.appendChild(status);
    sec.appendChild(closed);
    return sec;
  }
  const plans = el("div", "upgrade-plans");
  const feedback = el("p", "payment-feedback");
  feedback.hidden = true;
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  const btn = el(
    "button",
    "upgrade-btn",
    "30 дней · " + monthly + " ⭐",
  );
  btn.type = "button";
  btn.addEventListener("click", () => startUpgrade(btn, "monthly", feedback));
  const monthlyPlan = el("div", "upgrade-plan");
  monthlyPlan.appendChild(btn);
  monthlyPlan.appendChild(el("p", "plan-terms", "Автопродление каждые 30 дней. Отключить: /cancel в чате или в настройках Telegram. Доступ сохранится до конца оплаченного срока."));
  plans.appendChild(monthlyPlan);
  if (annualAvailable) {
    const ybtn = el(
      "button",
      "upgrade-btn upgrade-btn-annual",
      "365 дней · " + annual + " ⭐",
    );
    ybtn.type = "button";
    if (annual === monthly * 10) {
      ybtn.appendChild(el("span", "upgrade-saving", "цена десяти месяцев"));
    }
    ybtn.addEventListener("click", () => startUpgrade(ybtn, "annual", feedback));
    const annualPlan = el("div", "upgrade-plan");
    annualPlan.appendChild(ybtn);
    annualPlan.appendChild(el("p", "plan-terms", "Один платёж за 365 дней. Без автопродления."));
    plans.appendChild(annualPlan);
  }
  sec.appendChild(plans);
  sec.appendChild(feedback);
  const guide = el("details", "stars-guide");
  guide.appendChild(el("summary", "stars-guide-title", "Как купить Stars"));
  const steps = el("ol", "stars-guide-steps");
  [
    "Открой @PremiumBot и нажми /start.",
    "Выбери «Звёзды Telegram».",
    "Пополни баланс минимум на " + monthly + " ⭐ для месяца" +
      (annualAvailable ? " или " + annual + " ⭐ для года." : "."),
    "Проверь рублёвую цену у платёжного провайдера.",
    "Вернись сюда, выбери тариф и сверь сумму в счёте Telegram.",
  ].forEach((instruction) => steps.appendChild(el("li", null, instruction)));
  guide.appendChild(steps);
  const premiumBtn = el("button", "premiumbot-btn", "Купить Stars в @PremiumBot");
  premiumBtn.type = "button";
  premiumBtn.addEventListener("click", () => {
    const url = "https://t.me/PremiumBot";
    if (tg && typeof tg.openTelegramLink === "function") tg.openTelegramLink(url);
    else window.open(url, "_blank");
  });
  guide.appendChild(premiumBtn);
  guide.appendChild(
    el(
      "p",
      "stars-guide-note",
      "Доступные пакеты и способы оплаты зависят от клиента Telegram и региона. " +
        "Остаток Stars останется на общем балансе Telegram: его можно потратить в других " +
        "ботах, мини-приложениях или на подарки. Это не скидка и не депозит MindCoach. " +
        "Если на дату автопродления Stars не хватит, Telegram предложит пополнение, " +
        "но продление может не пройти, пока средств недостаточно.",
    ),
  );
  sec.appendChild(guide);
  sec.appendChild(
    el(
      "p",
      "upgrade-hint",
      annualAvailable
        ? "Месяц продлевается каждые 30 дней. Год оплачивается один раз на 365 дней."
        : "Месяц продлевается каждые 30 дней. Отменить можно в настройках Telegram.",
    ),
  );
  return sec;
}


// --- блок «Сегодня» ---------------------------------------------------------

const CHANGE_EXPERIMENT_STATUSES = new Set([
  "planned",
  "attempted",
  "adjusted",
  "completed",
  "paused",
]);

function dateOnlyParts(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) return null;
  return { key: value, year, month, day };
}

function localDateKey(now) {
  const date = now || new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function fmtDateOnly(value) {
  const parsed = dateOnlyParts(value);
  if (!parsed) return null;
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return parsed.day + " " + months[parsed.month - 1];
}

function changeExperimentView(raw) {
  const experiment = objectOrEmpty(raw);
  const text = (value) => (typeof value === "string" ? value.trim() : "");
  const action = text(experiment.action);
  const trigger = text(experiment.trigger);
  const fallback = text(experiment.fallback);
  const successSignal = text(experiment.success_signal);
  const outcome = text(experiment.outcome);
  const learning = text(experiment.learning);
  const measurementKey = text(experiment.measurement_key);
  const status = CHANGE_EXPERIMENT_STATUSES.has(experiment.status)
    ? experiment.status
    : "";
  if (!action || !status) return null;

  const today = localDateKey();
  const planned = dateOnlyParts(experiment.planned_for);
  const checkIn = dateOnlyParts(experiment.check_in_on);
  let state = "Шаг согласован";
  let next = action;
  let cta = "Вернуться к плану";

  if (status === "attempted") {
    state = "Опыт уже есть";
    next = outcome
      ? "Ты отметил: " + outcome + " Разберём, что из этого взять дальше."
      : "Расскажи, что фактически получилось, а что оказалось трудным.";
    cta = "Разобрать результат";
  } else if (status === "adjusted") {
    state = "План скорректирован";
    next = action;
    cta = "Продолжить с поправкой";
  } else if (status === "completed") {
    state = "Эксперимент завершён";
    next = learning
      ? "Ты заметил: " + learning
      : "Можно оставить всё как есть. Новый шаг не обязателен.";
    cta = "Вернуться в чат";
  } else if (status === "paused") {
    state = "Пауза тоже часть пути";
    next = "«" + action + "» можно оставить на паузе или изменить, когда захочется.";
    cta = "Пересобрать без давления";
  } else if (outcome) {
    state = "Результат отмечен";
    next = "Можно уменьшить шаг «" + action + "», выбрать другое время или взять паузу.";
    cta = "Скорректировать план";
  } else if (checkIn && checkIn.key <= today) {
    state = "Время сверить результат";
    next = "Что фактически произошло с шагом: «" + action + "»?";
    cta = "Отметить, что получилось";
  } else if (planned && planned.key < today) {
    state = "Сохранённый шаг";
    next = "Получилось попробовать «" + action + "» или контекст оказался другим?";
    cta = "Рассказать без оценки";
  } else if (planned && planned.key === today) {
    state = "Маленький шаг на сегодня";
  } else if (planned) {
    state = "Шаг на " + fmtDateOnly(planned.key);
  }

  const details = [];
  if (trigger) details.push(["Когда", trigger]);
  if (fallback) details.push(["Минимум", fallback]);
  if (successSignal) details.push(["Признак", successSignal]);
  if (checkIn && status !== "paused") details.push(["Сверка", fmtDateOnly(checkIn.key)]);
  if (status !== "attempted" && outcome) {
    details.push(["Что произошло", outcome]);
  }
  if (status !== "completed" && learning) {
    details.push(["Что берём дальше", learning]);
  }
  const feedbackDue = Boolean(
    measurementKey && status !== "paused" && (
      ["attempted", "adjusted", "completed"].includes(status) ||
      (checkIn && checkIn.key <= today) ||
      (planned && planned.key < today)
    )
  );
  return { state, next, cta, details, measurementKey, feedbackDue };
}

function experimentDetails(rows) {
  if (!rows || !rows.length) return null;
  const list = el("dl", "experiment-grid");
  rows.forEach(([label, value]) => {
    const row = el("div", "experiment-row");
    row.appendChild(el("dt", "experiment-key", label));
    row.appendChild(el("dd", "experiment-value", value));
    list.appendChild(row);
  });
  return list;
}

function existingOutcome(feedback, event, point, subjectKey) {
  return (feedback || []).find((item) =>
    item.event === event &&
    item.measurement_point === point &&
    item.subject_key === subjectKey,
  ) || null;
}

function hasOutcome(feedback, event) {
  return (feedback || []).some((item) => item.event === event);
}

function outcomeQuestion({
  label,
  event,
  point,
  subjectKey,
  options,
  feedback,
}) {
  const group = el("fieldset", "outcome-question");
  const legend = el("legend", "outcome-question-label", label);
  group.appendChild(legend);
  const status = el("p", "outcome-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const saved = existingOutcome(feedback, event, point, subjectKey);
  if (saved) {
    const selected = options.find(([value]) => value === saved.value);
    status.textContent = selected
      ? "Ответ сохранён: " + selected[1].toLocaleLowerCase("ru-RU") + "."
      : "Ответ сохранён.";
    group.appendChild(status);
    return group;
  }

  const buttons = el("div", "outcome-options");
  options.forEach(([value, text]) => {
    const button = el("button", "outcome-option", text);
    button.type = "button";
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", async () => {
      const allButtons = Array.from(buttons.querySelectorAll("button"));
      allButtons.forEach((item) => { item.disabled = true; });
      button.setAttribute("aria-busy", "true");
      status.textContent = "Сохраняю…";
      try {
        await submitOutcome(event, value, point, subjectKey);
        button.removeAttribute("aria-busy");
        button.setAttribute("aria-pressed", "true");
        status.textContent = "Спасибо. Сохранился только этот вариант, без текста разговора.";
        const haptic = tg && tg.HapticFeedback;
        if (haptic && typeof haptic.notificationOccurred === "function") {
          haptic.notificationOccurred("success");
        }
      } catch (_) {
        allButtons.forEach((item) => { item.disabled = false; });
        button.removeAttribute("aria-busy");
        status.textContent = "Не удалось сохранить. Проверь связь и попробуй ещё раз.";
      }
    });
    buttons.appendChild(button);
  });
  group.appendChild(buttons);
  group.appendChild(status);
  return group;
}



// Один следующий шаг вместо двух слабых блоков «Сегодня» и «Мой путь».
// Показываем состояние реального цикла изменения, а не общий вопрос ради ежедневности.
function todayBlock(p) {
  const experiment = changeExperimentView(p.change_experiment);
  if (!experiment) return null;
  const step = experiment;
  const ctaLabel = experiment.cta;
  const labelText = "Сохранённый шаг";
  const showExperiment = true;
  const sec = el("section", "today");
  if (showExperiment) sec.classList.add("today--experiment");
  labelSection(sec, "today-heading", labelText, "today-label");
  sec.appendChild(el("strong", "today-state", step.state));
  sec.appendChild(el("p", "today-q", step.next));
  if (showExperiment) {
    const details = experimentDetails(experiment.details);
    if (details) sec.appendChild(details);
  }
  if (p.live_sync && p.live_sync.pending_profile_update) {
    sec.appendChild(
      el("p", "today-sync", "Последний разговор уже принят. Образ обновляется в фоне."),
    );
  }
  const btn = el("button", "today-cta", ctaLabel);
  btn.type = "button";
  btn.addEventListener("click", closeToChat);
  if (showExperiment && p.change_experiment.revision) {
    sec.appendChild(experimentControls(p, sec));
    btn.className = "experiment-chat";
    btn.textContent = "Обсудить в чате";
  }
  sec.appendChild(btn);
  return sec;
}

function experimentControls(p, section) {
  const step = p.change_experiment;
  const controls = el("div", "experiment-controls");
  const feedback = el("p", "experiment-feedback");
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  const editor = el("details", "experiment-editor");
  const editToggle = el("summary", "experiment-edit-toggle", "Изменить шаг или сроки");
  editor.appendChild(editToggle);
  const form = el("form", "experiment-form");
  form.appendChild(el("p", "experiment-hint", "Выбери посильную версию. Сроки необязательны. Изменения сохранятся только по кнопке."));
  const fields = {};
  const optional = el("details", "optional-tool");
  optional.appendChild(el("summary", null, "Сроки и уточнения, если нужны"));
  [
    ["action", "Маленькое действие", "textarea"],
    ["trigger", "Когда или в какой ситуации, необязательно", "text"],
    ["fallback", "Если сил мало, необязательно", "text"],
    ["success_signal", "Как замечу, что попробовал, необязательно", "text"],
    ["planned_for", "Когда попробую, необязательно", "date"],
    ["check_in_on", "Когда сверюсь, необязательно", "date"],
  ].forEach(([key, label, type]) => {
    const input = el(type === "textarea" ? "textarea" : "input", "memory-input");
    input.id = "experiment-" + key;
    input.name = key;
    if (type !== "textarea") input.type = type;
    if (type !== "date") {
      input.maxLength = 280;
      input.minLength = key === "action" ? 8 : 4;
    }
    input.required = key === "action";
    input.value = cleanText(step[key]);
    input.defaultValue = input.value;
    const labelNode = el("label", "memory-field-label", label);
    labelNode.htmlFor = input.id;
    (key === "action" ? form : optional).append(labelNode, input);
    input.addEventListener("invalid", () => { if (key !== "action") optional.open = true; });
    fields[key] = input;
  });
  form.appendChild(optional);
  form.addEventListener("input", () => { form.dataset.dirty = "true"; });
  optional.appendChild(el("p", "experiment-hint", "Даты шага и время напоминаний будут по местному времени этого устройства."));
  form.addEventListener("change", () => { form.dataset.dirty = "true"; });
  const save = el("button", "memory-primary", "Сохранить план");
  save.type = "submit";
  const cancel = el("button", "memory-secondary", "Отменить изменения");
  cancel.type = "button";
  cancel.addEventListener("click", () => {
    form.reset();
    delete form.dataset.dirty;
    editor.open = false;
    editToggle.focus();
    refreshProfileView();
  });
  form.append(save, cancel);
  editor.appendChild(form);

  async function commit(operation, payload, message) {
    if (controls.dataset.busy === "true") return;
    if (operation !== "edit" && form.dataset.dirty === "true") {
      feedback.textContent = "Сначала сохрани или отмени изменения плана. Черновик остаётся здесь.";
      editor.open = true;
      save.focus();
      return;
    }
    controls.dataset.busy = "true";
    experimentMutationEpoch++;
    controls.setAttribute("aria-busy", "true");
    const inputs = Array.from(controls.querySelectorAll("button, input, textarea"));
    inputs.forEach((node) => { node.disabled = true; });
    feedback.textContent = "Сохраняю…";
    try {
      const updated = await controlExperiment(operation, step.revision, payload);
      p.change_experiment = updated;
      if (p.movement) window.setTimeout(refreshProfileView, 0);
      const replacement = todayBlock(p);
      section.replaceWith(replacement);
      const readout = replacement.querySelector(".experiment-feedback");
      if (readout) readout.textContent = message;
      const focus = replacement.querySelector(".today-cta") || replacement.querySelector(".experiment-edit-toggle");
      if (focus) focus.focus();
      renderedProfileFingerprint = null;
      announceAction(message);
    } catch (error) {
      if (error.message === "http-409") {
        feedback.textContent = "План уже изменился, возможно, сохранение успело пройти. Черновик остаётся здесь. Отмени изменения, чтобы загрузить текущий план.";
        editor.open = true;
        form.dataset.dirty = "true";
      } else {
        const errors = {
          "http-401": "Сессия завершилась. Открой профиль заново из чата.",
          "http-400": "Проверь формулировки: от 8 символов для действия, от 4 для необязательных полей. Дата сверки должна быть не раньше попытки.",
          "http-422": "Эту формулировку нельзя сохранить как план. Можно обсудить её в чате. Ввод пока остаётся только на экране.",
        };
        feedback.textContent = errors[error.message] || "Не удалось подтвердить сохранение. Твой ввод остался здесь. Проверь связь и повтори.";
      }
      inputs.forEach((node) => { node.disabled = false; });
      if (error.message === "http-409") {
        controls.querySelectorAll("button").forEach((node) => { node.disabled = node !== cancel; });
      }
    } finally {
      experimentMutationEpoch++;
      delete controls.dataset.busy;
      controls.removeAttribute("aria-busy");
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (fields.planned_for.value && fields.check_in_on.value &&
        fields.check_in_on.value < fields.planned_for.value) {
      feedback.textContent = "Дата сверки должна быть в день попытки или позже.";
      optional.open = true;
      fields.check_in_on.focus();
      return;
    }
    const payload = Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value]));
    commit("edit", payload, "План сохранён. Можно пробовать в своём темпе.");
  });

  if (!["paused", "completed"].includes(step.status) &&
      !(p.movement && p.movement.entries.some(entry => entry.linked))) {
    const toggle = el("button", "today-cta", step.outcome ? "Уточнить результат" : "Отметить результат");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "experiment-check-in");
    const choices = el("fieldset", "outcome-question experiment-check-in");
    choices.id = "experiment-check-in";
    choices.hidden = true;
    choices.appendChild(el("legend", "outcome-question-label", "Удалось попробовать шаг?"));
    choices.appendChild(el("p", "experiment-hint", "Любой исход подходит. Отметку можно исправить."));
    const row = el("div", "outcome-options");
    [
      ["done", "Попробовал", "Попытка отмечена. Теперь можно обсудить, что помогло и что хочется изменить."],
      ["partly", "Частично", "Частичная попытка отмечена. Можно сделать шаг меньше или выбрать другое время."],
      ["not_yet", "Пока нет", "Отмечено без оценки. Можно уменьшить шаг, изменить сроки или взять паузу."],
    ].forEach(([value, label, message]) => {
      const button = el("button", "outcome-option", label);
      button.type = "button";
      button.addEventListener("click", () => commit("check_in", { value }, message));
      row.appendChild(button);
    });
    choices.appendChild(row);
    toggle.addEventListener("click", () => {
      choices.hidden = !choices.hidden;
      toggle.setAttribute("aria-expanded", String(!choices.hidden));
    });
    controls.append(toggle, choices);
  }
  controls.appendChild(editor);
  if (step.status !== "completed") {
    const paused = step.status === "paused";
    const pause = el("button", paused ? "today-cta" : "experiment-pause", paused ? "Вернуться к шагу" : "Поставить шаг на паузу");
    pause.type = "button";
    pause.addEventListener("click", () => commit(paused ? "resume" : "pause", {}, paused
      ? "Шаг снова открыт. Старые сроки убраны: выбери новые, если захочется."
      : "Шаг на паузе. Вернуться можно в любой момент."));
    controls.appendChild(pause);
  }
  controls.appendChild(feedback);
  return controls;
}

function closeToChat() {
  if (hasMemoryDraft()) {
    const draft = document.querySelector('[data-dirty="true"], [data-busy="true"]');
    let ancestor = draft;
    while (ancestor) {
      if (ancestor.tagName === "DETAILS") ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    const notice = "Сначала сохрани или отмени ввод. Если сохранение уже идёт, дождись результата.";
    announceAction(notice);
    let feedback = document.getElementById("draft-exit-feedback");
    if (!feedback) {
      feedback = el("p", "panel-intro", notice);
      feedback.id = "draft-exit-feedback";
      feedback.setAttribute("role", "status");
      (draft || panel || document.getElementById("app")).appendChild(feedback);
    }
    feedback.textContent = notice;
    feedback.scrollIntoView({block: "center", behavior: "instant"});
    return;
  }
  if (tg && typeof tg.close === "function") tg.close();
  else window.location.assign("./landing.html");
}

function topicHandoffFeedback(kind) {
  const haptic = tg && tg.HapticFeedback;
  if (haptic && typeof haptic.notificationOccurred === "function") {
    haptic.notificationOccurred(kind);
  }
}

function topicHandoffKey(item) {
  if (item && item.itemType === "facet" && FACET_GUIDE[item.key]) return item.key;
  if (item && item.itemType === "archetype") return "archetypes";
  return null;
}

function topicHandoffStatus(readout, text, kind) {
  const current = readout.querySelector(".topic-handoff-status");
  if (current) current.remove();
  const status = el("div", "topic-handoff-status topic-handoff-status--" + kind);
  status.setAttribute("role", kind === "error" ? "alert" : "status");
  status.appendChild(el("p", null, text));
  readout.appendChild(status);
  return status;
}


async function copyPlainText(text) {
  const clipboard = window.navigator && window.navigator.clipboard;
  if (!clipboard || typeof clipboard.writeText !== "function") return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch (_) {
    return false;
  }
}

function renderMemoryUpdate(updated, message) {
  announceAction(message);
  renderedProfileFingerprint = null;
  renderFetchedProfile(updated, true);
}

function hasMemoryDraft() {
  return Boolean(document.querySelector('.memory-form[data-dirty="true"], .experiment-form[data-dirty="true"], .experiment-controls[data-busy="true"], .movement-form[data-dirty="true"], .movement-card[data-busy="true"]'));
}

let nativeDraftProtected = null;
function syncDraftCloseProtection() {
  const protectedNow = hasMemoryDraft();
  if (nativeDraftProtected === protectedNow) return;
  const method = protectedNow ? "enableClosingConfirmation" : "disableClosingConfirmation";
  if (tg && typeof tg[method] === "function") tg[method]();
  nativeDraftProtected = protectedNow;
}

function protectMemoryDraft(form) {
  const mark = () => { form.dataset.dirty = "true"; };
  form.addEventListener("input", mark);
  form.addEventListener("change", mark);
  const cancel = el("button", "memory-secondary", "Отменить ввод");
  cancel.type = "button";
  cancel.addEventListener("click", () => {
    form.reset();
    delete form.dataset.dirty;
    const details = form.closest("details");
    if (details) details.open = false;
    refreshProfileView();
  });
  form.appendChild(cancel);
}

function memoryTypeSelect(types, selected) {
  const select = el("select", "memory-input");
  types.forEach((item) => {
    const option = el("option", null, item.label);
    option.value = item.value;
    option.selected = item.value === selected;
    select.appendChild(option);
  });
  return select;
}

function memoryEditForm(item, types) {
  const details = el("details", "memory-edit");
  details.appendChild(el("summary", "memory-edit-toggle", "Исправить"));
  const form = el("form", "memory-form");
  const typeId = "memory-edit-type-" + Math.random().toString(36).slice(2);
  const textId = "memory-edit-text-" + Math.random().toString(36).slice(2);
  const typeLabel = el("label", "memory-field-label", "Что это");
  typeLabel.htmlFor = typeId;
  const select = memoryTypeSelect(types, item.type);
  select.id = typeId;
  const textLabel = el("label", "memory-field-label", "Формулировка");
  textLabel.htmlFor = textId;
  const textarea = el("textarea", "memory-input memory-textarea");
  textarea.id = textId;
  textarea.maxLength = 280;
  textarea.required = true;
  textarea.value = item.content;
  textarea.defaultValue = item.content;
  const status = el("p", "memory-action-status");
  status.setAttribute("role", "status");
  const save = el("button", "memory-primary", "Сохранить исправление");
  save.type = "submit";
  form.append(typeLabel, select, textLabel, textarea, save, status);
  protectMemoryDraft(form);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    save.disabled = true;
    save.textContent = "Сохраняю…";
    try {
      const updated = await controlMemory("edit", {
        key: item.key,
        type: select.value,
        content: textarea.value,
      });
      renderMemoryUpdate(updated, "Запись исправлена.");
    } catch (_) {
      save.disabled = false;
      save.textContent = "Повторить";
      status.textContent = "Не удалось сохранить. Проверь формулировку и связь.";
    }
  });
  details.appendChild(form);
  return details;
}

function memoryRecord(item, types) {
  // Запись читается как строка текста, а не как коробка. Левая линия несёт
  // статус (сплошная — подтверждено, пунктир — ждёт решения, точки — догадка),
  // поэтому подпись не нужна глазу, чтобы понять, чему можно доверять.
  // Тип и дата — тихая метаинформация: при реальных данных типы повторяются
  // («цель, цель, предпочтение»), и яркие плашки превращались в шум.
  const card = el("article", "memory-record");
  if (item.is_guess) card.classList.add("is-guess");
  else if (item.needs_confirmation) card.classList.add("is-pending");

  const meta = el("div", "memory-meta");
  meta.appendChild(el("span", "memory-meta-type", item.type_label));
  const recorded = fmtDate(item.recorded_on);
  if (recorded) {
    meta.appendChild(el("span", "memory-meta-dot", "·"));
    meta.appendChild(el("span", "memory-meta-date", recorded));
  }
  if (item.is_guess) meta.appendChild(el("span", "memory-meta-state is-guess", "догадка"));
  else if (item.needs_confirmation) meta.appendChild(el("span", "memory-meta-state", "ждёт решения"));
  card.appendChild(meta);
  card.appendChild(el("p", "memory-record-text", item.content));

  const status = el("p", "memory-action-status");
  status.setAttribute("role", "status");

  const remove = el("button", "memory-danger-quiet", item.needs_confirmation ? "Отклонить" : "Удалить");
  remove.type = "button";
  remove.addEventListener("click", async () => {
    const ok = await confirmAction(
      item.needs_confirmation
        ? "Отклонить эту запись? Она не будет использоваться и не сохранится как факт."
        : "Удалить эту запись? Она перестанет использоваться. История разговора останется до полного сброса данных.",
    );
    if (!ok) return;
    remove.disabled = true;
    remove.textContent = "Удаляю…";
    try {
      const action = item.needs_confirmation ? "reject" : "delete";
      renderMemoryUpdate(
        await controlMemory(action, { key: item.key }),
        item.needs_confirmation ? "Запись отклонена." : "Запись удалена.",
      );
    } catch (_) {
      remove.disabled = false;
      remove.textContent = "Повторить";
      status.textContent = "Не удалось удалить. Проверь связь.";
    }
  });

  // Решение о записи — единственное, что стоит на виду: это осмысленный выбор,
  // а не разрушительное действие. Догадку подтвердить одним нажатием нельзя.
  if (item.needs_confirmation && !item.is_guess) {
    const actions = el("div", "memory-record-actions");
    const confirm = el("button", "memory-primary", "Оставить");
    confirm.type = "button";
    confirm.addEventListener("click", async () => {
      confirm.disabled = true;
      try {
        renderMemoryUpdate(await controlMemory("confirm", { key: item.key }), "Запись подтверждена.");
      } catch (error) {
        confirm.disabled = false;
        status.textContent =
          error && error.message === "unauthorized"
            ? "Сессия устарела. Открой профиль заново из чата."
            : "Не удалось подтвердить. Проверь связь.";
      }
    });
    actions.append(confirm, remove);
    card.appendChild(actions);
    card.appendChild(status);
    return card;
  }

  // Всё остальное живёт под одним раскрытием: провенанс и права на данные
  // никуда не делись, но не занимают три строки под каждой записью.
  const more = el("details", "memory-more");
  more.appendChild(el("summary", "memory-more-toggle", "откуда это"));
  const body = el("div", "memory-more-body");
  body.appendChild(el("p", "memory-more-line", item.source));
  body.appendChild(el("p", "memory-more-line", item.why));
  const dates = [];
  if (item.recorded_on) dates.push("Записано: " + fmtDate(item.recorded_on));
  if (item.expires_on) dates.push("Удалится автоматически: " + fmtDate(item.expires_on));
  if (dates.length) body.appendChild(el("p", "memory-more-date", dates.join(" · ")));
  if (item.editable) body.appendChild(memoryEditForm(item, types));
  body.appendChild(remove);
  more.appendChild(body);
  card.append(more, status);
  return card;
}

function memoryGroup(group, types) {
  if (!group.items.length) return null;
  const section = el("section", "memory-group");
  const head = el("div", "memory-group-head");
  const copy = el("div");
  copy.appendChild(el("h3", "memory-group-title serif", group.label));
  copy.appendChild(el("p", "memory-group-description", group.description));
  head.appendChild(copy);
  const clear = el("button", "memory-group-clear", "Удалить записи раздела");
  clear.type = "button";
  clear.addEventListener("click", async () => {
    const ok = await confirmAction(
      "Удалить все записи раздела «" + group.label + "»? Остальные разделы останутся.",
    );
    if (!ok) return;
    clear.disabled = true;
    try {
      renderMemoryUpdate(
        await controlMemory("delete_class", { class: group.class }),
        "Раздел памяти очищен.",
      );
    } catch (_) {
      clear.disabled = false;
      clear.textContent = "Повторить удаление";
    }
  });
  section.appendChild(head);
  const list = el("div", "memory-record-list");
  group.items.forEach((item) => list.appendChild(memoryRecord(item, types)));
  section.appendChild(list);
  // Массовое удаление остаётся доступным, но не висит красной кнопкой над списком.
  const clearWrap = el("details", "memory-manage memory-group-manage");
  clearWrap.appendChild(el("summary", "memory-manage-toggle", "Удалить весь раздел"));
  const clearBody = el("div", "memory-manage-body");
  clearBody.appendChild(el(
    "p",
    "memory-group-clear-hint",
    "Удалятся все записи раздела «" + group.label + "». Остальные разделы останутся.",
  ));
  clearBody.appendChild(clear);
  clearWrap.appendChild(clearBody);
  section.appendChild(clearWrap);
  return section;
}

function memoryAddBlock(types) {
  const details = el("details", "memory-add");
  details.appendChild(el("summary", "memory-add-toggle", "Добавить важное самому"));
  const intro = el(
    "p",
    "memory-add-intro",
    "Запиши устойчивый факт, который поможет не повторять важное. Временные чувства и секреты сюда лучше не добавлять.",
  );
  const form = el("form", "memory-form");
  const typeLabel = el("label", "memory-field-label", "Что это");
  typeLabel.htmlFor = "memory-add-type";
  const select = memoryTypeSelect(types, "goal");
  select.id = "memory-add-type";
  const textLabel = el("label", "memory-field-label", "Что помнить");
  textLabel.htmlFor = "memory-add-text";
  const textarea = el("textarea", "memory-input memory-textarea");
  textarea.id = "memory-add-text";
  textarea.maxLength = 280;
  textarea.minLength = 8;
  textarea.required = true;
  textarea.placeholder = "Например: мне помогает сначала записать один маленький следующий шаг";
  const submit = el("button", "memory-primary", "Добавить в память");
  submit.type = "submit";
  const status = el("p", "memory-action-status");
  status.setAttribute("role", "status");
  form.append(typeLabel, select, textLabel, textarea, submit, status);
  protectMemoryDraft(form);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    submit.textContent = "Добавляю…";
    try {
      renderMemoryUpdate(
        await controlMemory("add", { type: select.value, content: textarea.value }),
        "Запись добавлена тобой.",
      );
    } catch (_) {
      submit.disabled = false;
      submit.textContent = "Повторить";
      status.textContent = "Не удалось добавить. Нужно от 8 до 280 символов.";
    }
  });
  details.append(intro, form);
  return details;
}

// Conversation first. Internal tab keys preserve existing links and refresh state.

// Вкладок больше нет. Измерено 18.09 в production: мини-апп открывали 3 раза
// за всю жизнь продукта, а «Практики», «Движение», «Глубинные сессии» и
// «Сохранённый шаг» рендерили ключи, которых нет ни в одном из шести профилей.
// Три вкладки делили между собой пустоту. Экран один, и он показывает
// profiles.sections — единственное, что у людей действительно есть.

function jaguarMark() {
  const mark = el("span", "jaguar-mark");
  mark.setAttribute("aria-hidden", "true");
  mark.innerHTML =
    '<svg viewBox="0 0 48 36" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M8 13 5 5l10 5c2.7-1.3 5.7-2 9-2s6.3.7 9 2L43 5l-3 8c1.9 2.4 3 5.2 3 8.1C43 28.2 34.5 33 24 33S5 28.2 5 21.1C5 18.2 6.1 15.4 8 13Z"/>' +
    '<path d="M13 20c2.3-1.7 5.1-1.7 7.5 0M27.5 20c2.4-1.7 5.2-1.7 7.5 0M20 25h8l-4 3-4-3Z"/>' +
    '<circle cx="15" cy="15" r="1"/><circle cx="33" cy="15" r="1"/>' +
    '</svg>';
  return mark;
}



let activePracticeTab = null;
let openPracticeReminderKind = null;
let habitQueueOpen = false;



// Имя бота приходит с профилем. Держим его отдельно, чтобы deep-link собирался
// и в тех блоках, которым сам профиль не передаётся.
let botUsername = null;

// Telegram не позволяет мини-аппу отправить сообщение от имени человека, поэтому
// раньше здесь предлагалось скопировать команду и вставить её в чат руками. Deep-link
// `?start=<action>` решает то же самое одним нажатием: Telegram открывает чат, бот
// получает обычный /start с аргументом и сразу запускает сценарий. Копирование
// остаётся запасным путём, если имя бота недоступно.
function commandAction(command, label, statusNode, action, linkLabel) {
  const target = action || command.replace(/^\//, "");
  if (botUsername) {
    const button = el("button", "command-action", linkLabel || "Открыть в чате");
    button.type = "button";
    button.addEventListener("click", () => {
      const link = "https://t.me/" + botUsername + "?start=" + encodeURIComponent(target);
      statusNode.textContent = "Открываю чат…";
      if (tg && typeof tg.openTelegramLink === "function") tg.openTelegramLink(link);
      else window.open(link, "_blank");
    });
    return button;
  }
  const button = el("button", "command-action", label);
  button.type = "button";
  button.addEventListener("click", async () => {
    const copied = await copyPlainText(command);
    statusNode.textContent = copied
      ? "Команда " + command + " скопирована. Вернись в чат и вставь её."
      : "Не удалось скопировать автоматически. Отправь в чат команду " + command + ".";
    if (copied) button.textContent = "Скопировано";
  });
  return button;
}

function deepSessionPreparation(showUpgrade, safetyPause) {
  const sec = el("section", "session-prep");
  sec.appendChild(el("span", "section-eyebrow", "Перед началом"));
  sec.appendChild(el("h2", "session-prep-title serif", "Освободи место для разговора"));
  sec.appendChild(
    el(
      "p",
      "session-prep-intro",
      "Глубинная сессия помогает спокойно разобрать один актуальный вопрос: заметить триггер, проверить возможную связь и выбрать маленький шаг. Это не терапия и не диагностика.",
    ),
  );
  const list = el("ul", "session-checklist");
  [
    "Выдели 20–30 минут без срочных дел и отвлечений.",
    "Начинай трезвым, в безопасном спокойном месте, не за рулём и не на работе.",
    "Держи рядом воду и назови намерение одним предложением.",
    "Ты можешь замедлить или прекратить сессию в любой момент.",
  ].forEach((text) => {
    const item = el("li", "session-check");
    item.appendChild(el("span", "session-check-mark", "✓"));
    item.appendChild(el("span", null, text));
    list.appendChild(item);
  });
  sec.appendChild(list);
  sec.appendChild(
    el(
      "p",
      "session-safety",
      "Если сейчас небезопасно или нужна срочная помощь, не начинай сессию. Обратись к экстренной службе или к человеку рядом.",
    ),
  );
  const status = el("p", "command-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  if (safetyPause) {
    const urgent = el("div", "session-urgent");
    urgent.setAttribute("role", "alert");
    urgent.appendChild(el("strong", null, "Сейчас глубинную сессию лучше отложить"));
    urgent.appendChild(
      el(
        "p",
        null,
        "Вернись в чат за короткой поддержкой. Если есть непосредственная опасность для жизни, позвони 112 или обратись к человеку рядом.",
      ),
    );
    const emergency = el("a", "session-emergency", "Позвонить 112");
    emergency.href = "tel:112";
    urgent.appendChild(emergency);
    const back = el("button", "session-back", "Вернуться в чат");
    back.type = "button";
    back.addEventListener("click", closeToChat);
    urgent.appendChild(back);
    sec.appendChild(urgent);
  } else if (showUpgrade) {
    const upgrade = el("button", "session-start", "Открыть глубинные сессии");
    upgrade.type = "button";
    upgrade.dataset.openTab = "more";
    sec.appendChild(upgrade);
  } else {
    sec.appendChild(commandAction("/imagine", "Скопировать /imagine", status, "imagine", "Начать сессию в чате"));
    const back = el("button", "session-back", "Вернуться в чат");
    back.type = "button";
    back.addEventListener("click", closeToChat);
    sec.appendChild(back);
  }
  sec.appendChild(status);
  return sec;
}

const DEEP_SESSION_STATUS_LABELS = {
  preparing: "Подготовка",
  active: "Сессия идёт",
  integrating: "Интеграция",
  completed: "Завершена",
  aborted: "Остановлена",
};
const DEEP_SESSION_STAGE_LABELS = {
  prepare: "Подготовка",
  intention: "Намерение",
  explore: "Исследование",
  integrate: "Интеграция",
  confirm: "Подтверждение итога",
};

function fmtSessionDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

function deepSessionCard(session, feedback) {
  const card = el("article", "deep-session-card");
  card.dataset.status = session.status;
  const head = el("div", "deep-session-head");
  const heading = el("div", "deep-session-heading");
  heading.appendChild(el("span", "deep-session-status", DEEP_SESSION_STATUS_LABELS[session.status]));
  const date = fmtSessionDate(session.ended_at || session.started_at);
  if (date) heading.appendChild(el("span", "deep-session-date", date));
  head.appendChild(heading);
  if (session.stage && session.status !== "completed") {
    head.appendChild(el("span", "deep-session-stage", DEEP_SESSION_STAGE_LABELS[session.stage]));
  }
  card.appendChild(head);
  const result = session.result || {};
  if (result.title) card.appendChild(el("h4", "deep-session-title serif", result.title));
  if (session.intention) {
    const intention = el("div", "deep-session-intention");
    intention.appendChild(el("span", "deep-session-result-label", "Намерение"));
    intention.appendChild(el("p", null, session.intention));
    card.appendChild(intention);
  }

  if (["preparing", "active", "integrating"].includes(session.status)) {
    const copy = session.status === "integrating"
      ? "Собери словами то, что действительно откликается. В итог попадёт только подтверждённая тобой формулировка."
      : "Сессия продолжается в чате. Можно остановиться, попросить паузу или изменить темп.";
    card.appendChild(el("p", "deep-session-progress", copy));
    const back = el("button", "deep-session-continue", "Вернуться в чат");
    back.type = "button";
    back.addEventListener("click", closeToChat);
    card.appendChild(back);
  } else if (session.status === "aborted") {
    card.appendChild(el("p", "deep-session-progress", "Сессию остановили. Возвращаться к ней или начинать новую не обязательно."));
  } else {
    if (result.user_words && result.user_words.length) {
      const outcome = el("div", "deep-session-outcome");
      outcome.appendChild(el("span", "deep-session-result-label", "Дословно из твоих сообщений"));
      const words = el("ul", "deep-session-words");
      result.user_words.forEach((word) => words.appendChild(el("li", null, word)));
      outcome.appendChild(words);
      card.appendChild(outcome);
    } else if (result.takeaway) {
      const outcome = el("div", "deep-session-outcome");
      outcome.appendChild(el("span", "deep-session-result-label", "Итог, который ты подтвердил"));
      outcome.appendChild(el("p", "deep-session-takeaway", result.takeaway));
      card.appendChild(outcome);
    } else {
      card.appendChild(el("p", "deep-session-progress", "Подтверждённый итог пока не сохранён."));
    }
    if (result.model_hypothesis) {
      const hypothesis = el("details", "deep-session-hypothesis");
      hypothesis.appendChild(el("summary", null, "Гипотеза проводника, не факт"));
      hypothesis.appendChild(el("p", null, result.model_hypothesis));
      if (result.uncertainty) {
        hypothesis.appendChild(el("p", "deep-session-uncertainty", "Граница уверенности: " + result.uncertainty));
      }
      card.appendChild(hypothesis);
    }
    if (result.next_step) {
      const next = el("div", "deep-session-next");
      next.appendChild(el("span", "deep-session-result-label", "Следующий шаг"));
      next.appendChild(el("p", null, result.next_step));
      card.appendChild(next);
    }
    if (result.closing_question) {
      const question = el("div", "deep-session-question");
      question.appendChild(el("span", "deep-session-result-label", "Вопрос на возвращение"));
      question.appendChild(el("p", null, result.closing_question));
      card.appendChild(question);
    }
    const followUp = fmtSessionDate(
      session.follow_up_at || result.follow_up_at || result.check_in_on,
    );
    if (followUp) card.appendChild(el("p", "deep-session-followup", "Вернуться к этому: " + followUp));

    const immediate = existingOutcome(
      feedback,
      "deep_helpfulness",
      "session_close",
      session.id,
    );
    if (!immediate) {
      const measure = el("section", "deep-session-measure");
      measure.appendChild(outcomeQuestion({
        label: "Этот итог был полезен?",
        event: "deep_helpfulness",
        point: "session_close",
        subjectKey: session.id,
        options: [["yes", "Да"], ["partly", "Частично"], ["no", "Нет"]],
        feedback,
      }));
      card.appendChild(measure);
    } else {
      const due = dateOnlyParts(session.follow_up_at || result.check_in_on);
      const followupPoint = result.check_in_days > 4 ? "d7" : "d3";
      if (
        due && due.key <= localDateKey() &&
        !existingOutcome(feedback, "deep_followup", followupPoint, session.id)
      ) {
        const measure = el("section", "deep-session-measure");
        measure.appendChild(outcomeQuestion({
          label: "Спустя несколько дней итог помог действовать иначе?",
          event: "deep_followup",
          point: followupPoint,
          subjectKey: session.id,
          options: [
            ["helped", "Помог"],
            ["not_sure", "Пока неясно"],
            ["did_not_help", "Не помог"],
          ],
          feedback,
        }));
        card.appendChild(measure);
      }
    }
  }

  if (["completed", "aborted"].includes(session.status)) {
    const deleteStatus = el("p", "deep-session-delete-status");
    deleteStatus.setAttribute("role", "status");
    deleteStatus.setAttribute("aria-live", "polite");
    const remove = el("button", "deep-session-delete", "Удалить итог");
    remove.type = "button";
    remove.addEventListener("click", async () => {
      const ok = await confirmAction(
        "Удалить этот итог глубинной сессии? Связанный с ним текущий шаг тоже будет удалён. Действие нельзя отменить.",
      );
      if (!ok) return;
      remove.disabled = true;
      remove.setAttribute("aria-busy", "true");
      remove.textContent = "Удаляю…";
      try {
        const updated = await deleteDeepSession(session.id);
        renderedProfileFingerprint = null;
        renderFetchedProfile(updated);
        announceAction("Итог глубинной сессии удалён.");
        queueMicrotask(() => {
          const tab = document.getElementById("tab-memory");
          if (tab) tab.focus();
        });
      } catch (_) {
        remove.disabled = false;
        remove.removeAttribute("aria-busy");
        remove.textContent = "Повторить удаление";
        deleteStatus.textContent = "Не удалось удалить итог. Проверь связь и повтори.";
      }
    });
    card.appendChild(remove);
    card.appendChild(deleteStatus);
  }
  return card;
}


function memoryPauseBlock(center) {
  const section = el("section", "memory-pause");
  const copy = el("div", "memory-pause-copy");
  copy.appendChild(el("strong", null, center.writes_paused ? "Новые записи на паузе" : "Новые записи включены"));
  copy.appendChild(
    el(
      "span",
      null,
      center.writes_paused
        ? "Разговор продолжится, но Проводник не будет добавлять новую память."
        : "Проводник может сохранять только записи, прошедшие строгий отбор.",
    ),
  );
  const toggle = el("button", "memory-pause-toggle", center.writes_paused ? "Возобновить" : "Поставить на паузу");
  toggle.type = "button";
  toggle.setAttribute("aria-pressed", String(center.writes_paused));
  toggle.addEventListener("click", async () => {
    toggle.disabled = true;
    try {
      const action = center.writes_paused ? "resume" : "pause";
      renderMemoryUpdate(
        await controlMemory(action),
        center.writes_paused ? "Новая память снова включена." : "Новые записи поставлены на паузу.",
      );
    } catch (_) {
      toggle.disabled = false;
      toggle.textContent = "Повторить";
    }
  });
  section.append(copy, toggle);
  return section;
}

function memoryControlsBlock(center) {
  const sec = el("section", "memory-controls");
  sec.appendChild(el("h2", "memory-controls-title serif", "Ты управляешь памятью"));
  sec.appendChild(
    el(
      "p",
      "memory-controls-intro",
      "Можно забрать всё, что я помню, одним файлом в чат или удалить все записи прямо здесь. Отдельные темы и привычки снимаются выше, там же где они написаны.",
    ),
  );
  const status = el("p", "command-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const actions = el("div", "memory-global-actions");
  // «Скачать» обещало то, чего встроенный браузер Telegram не умеет. Кнопка говорит,
  // что произойдёт на самом деле: файл придёт в чат.
  const exportButton = el("button", "memory-secondary", "Прислать мою память в чат");
  exportButton.type = "button";
  exportButton.addEventListener("click", async () => {
    exportButton.disabled = true;
    exportButton.textContent = "Собираю…";
    status.textContent = "";
    try {
      await sendMemoryExportToChat();
      exportButton.disabled = false;
      exportButton.textContent = "Прислать ещё раз";
      status.textContent = "Готово: файл в нашем чате, открывается одним тапом.";
    } catch (error) {
      exportButton.disabled = false;
      exportButton.textContent = "Попробовать ещё раз";
      const reason = error && error.message;
      // Истёкший initData выглядел как сбой связи, и человек жал кнопку снова,
      // получая тот же отказ. Сессию чинит переоткрытие из чата, а не повтор.
      status.textContent =
        reason === "unauthorized" || reason === "no-init-data"
          ? "Сессия устарела. Открой профиль заново из чата, и я пришлю архив."
          : "Не получилось отправить. Попробуй ещё раз.";
    }
  });
  actions.appendChild(exportButton);
  const total = center.groups.reduce((sum, group) => sum + group.items.length, 0);
  const deleteAll = el("button", "memory-danger", "Удалить всю память");
  deleteAll.type = "button";
  deleteAll.disabled = total === 0;
  deleteAll.addEventListener("click", async () => {
    const ok = await confirmAction(
      "Удалить все записи памяти? Они перестанут использоваться. Профильные гипотезы и история чата очищаются отдельно через полный сброс.",
    );
    if (!ok) return;
    deleteAll.disabled = true;
    deleteAll.textContent = "Удаляю…";
    try {
      renderMemoryUpdate(await controlMemory("delete_all"), "Вся память удалена.");
    } catch (_) {
      deleteAll.disabled = false;
      deleteAll.textContent = "Повторить удаление";
      status.textContent = "Не удалось удалить память. Проверь связь.";
    }
  });
  actions.appendChild(deleteAll);
  sec.appendChild(actions);
  sec.appendChild(status);
  const back = el("button", "memory-chat", "Вернуться в чат");
  back.type = "button";
  back.addEventListener("click", closeToChat);
  sec.appendChild(back);
  return sec;
}


function legalLinks() {
  const nav = el("nav", "legal-links");
  nav.setAttribute("aria-label", "Условия и данные");
  [["./privacy.html", "Приватность"], ["./offer.html", "Оферта"], ["./refund.html", "Возврат"]].forEach(([href, label]) => {
    const link = el("a", null, label);
    link.href = href;
    link.rel = "noreferrer";
    link.addEventListener("click", (event) => {
      if (!tg || typeof tg.openLink !== "function") return;
      event.preventDefault();
      tg.openLink(new URL(href, window.location.href).href);
    });
    nav.appendChild(link);
  });
  return nav;
}


// Movement is an optional entry into the existing single-step loop.
const MOVEMENT_KINDS = {
  walk: ["Прогулка", "В удобном темпе, если место и самочувствие позволяют."],
  mobility: ["Мягкое движение", "Привычные удобные движения, можно сидя. Без боли и усилия."],
  break: ["Подвижная пауза", "Сменить положение и немного подвигаться, как сейчас удобно."],
  rest: ["Отдых", "Можно просто дать себе паузу. Двигаться не обязательно."],
};
const MOVEMENT_STATUS = {chosen: "Выбрано", attempted: "Попробовал", completed: "Завершено", declined: "Решил не пробовать"};


// Optional tools retain their saved records and paid access, away from the home screen.
function optionalBlock(title, node, key) {
  if (!node) return null;
  const details = el("details", "optional-tool");
  if (key) details.id = key;
  details.append(el("summary", null, title), node);
  return details;
}

// Главная — вход в разговор, а не витрина памяти. Раньше здесь висел список
// записей, который дословно повторял вкладку «Память»: один и тот же контент
// в двух местах, причём на реальных данных (95-156 символов, подряд
// одинаковые типы) он читался как стена текста с повторяющимися плашками.
// Память живёт в своём разделе целиком; здесь — тёплый вход и одна живая
// строка связи с прошлым разговором.
function lastTurnLine(p) {
  const raw = p.live_sync && p.live_sync.last_turn_at;
  if (!raw) return null;
  const then = new Date(raw);
  if (isNaN(then)) return null;
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return "Мы говорили сегодня.";
  if (days === 1) return "Мы говорили вчера.";
  if (days < 7) return "Мы говорили " + days + (days < 5 ? " дня" : " дней") + " назад.";
  return "Последний разговор — " + fmtDate(raw) + ".";
}




// --- сборка профиля ---------------------------------------------------------

// --- один экран ------------------------------------------------------------
// Измерено в production 18.09: мини-апп открывали 3 раза за всю жизнь продукта
// (profile_opened = 3, последний 20.07). Разделы «Практики», «Движение»,
// «Глубинные сессии», «Эксперименты» и «Сохранённый шаг» рендерили ключи,
// которых нет ни в одном из шести профилей. Вкладки делили пустоту на три
// части. Настоящее содержимое — profiles.sections: 29 записей у 6 человек,
// summary 90-419 символов, и повторяющийся theme, который сервер уже собирает
// в «нити». Экран теперь один, и показывает ровно это.

// Мотив-тег приходит машинным ключом (strah-nakazaniya). Человеку его нельзя
// показывать сырым, а придумывать за него название мотива — значит выдать
// догадку за вывод. Поэтому нить названа тем, что в ней бесспорно: сколькими
// разными сторонами разговора она всплыла.
function threadLine(thread) {
  const labels = (thread.members || [])
    .map((m) => m.label || m.name)
    .filter(Boolean);
  if (labels.length < 2) return null;
  const line = el("section", "thread");
  line.appendChild(el("span", "thread-eyebrow", "Кажется, это связано"));
  // Ярлык раздела сам может содержать «и» («Анима и Анимус»), и тогда
  // перечисление через «и» читается как сбой. Точка с запятой не спорит с
  // содержимым ярлыка, каким бы оно ни было.
  const names = labels.join("; ");
  line.appendChild(el("p", "thread-body", names + " — всё это всплывало в разговорах рядом друг с другом."));
  if (thread.need) line.appendChild(el("p", "thread-need", "Похоже, за этим стоит одно: " + thread.need));
  line.appendChild(el("p", "thread-caveat", "Это догадка, а не вывод. Если связи нет, так и скажи в разговоре."));
  return line;
}

// Одна тема — заголовок, текст и, если человек ещё не решил, два тихих выбора.
// Ни статуса, ни уверенности, ни счётчика наблюдений, ни глифа: девять
// элементов на запись и были той «колхозностью», которую владелец назвал.
function understandingItem(item) {
  const row = el("article", "understanding");
  if (item.user_confirmed) row.classList.add("understanding--confirmed");
  row.appendChild(el("h3", "understanding-title", item.label || item.name));
  row.appendChild(el("p", "understanding-body", item.summary));
  const ledger = evidenceBlock(item);
  if (ledger) row.appendChild(ledger);
  if (item.user_confirmed) {
    row.appendChild(el("p", "understanding-mark", "Ты подтвердил, что это про тебя."));
    return row;
  }
  row.classList.add("understanding--open");
  const ask = el("div", "understanding-ask");
  const status = el("p", "understanding-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const decide = (label, run) => {
    const b = el("button", "understanding-choice", label);
    b.type = "button";
    b.addEventListener("click", async () => {
      if (row.dataset.busy === "true") return;
      row.dataset.busy = "true";
      ask.querySelectorAll("button").forEach((n) => { n.disabled = true; });
      status.textContent = "Сохраняю…";
      try {
        await run(item.key);
      } catch (error) {
        // Причину нельзя прятать за «проверь связь»: истёкший initData (Telegram
        // не обновляет его у открытой мини-аппы) выглядел как сбой сети, и человек
        // жал кнопку снова, получая тот же отказ. Сессию чинит переоткрытие из чата,
        // а не повтор запроса.
        const reason = error && error.message;
        status.textContent =
          reason === "unauthorized" || reason === "no-init-data"
            ? "Сессия устарела. Открой профиль заново из чата, и подтверждение сохранится."
            : "Не получилось сохранить. Попробуй ещё раз.";
        row.dataset.busy = "false";
        ask.querySelectorAll("button").forEach((n) => { n.disabled = false; });
      }
    });
    return b;
  };
  ask.appendChild(decide("Да, это про меня", confirmSection));
  ask.appendChild(decide("Не про меня", dismissSection));
  row.appendChild(ask);
  row.appendChild(status);
  return row;
}

// Лента наблюдений под темой. Владелец 18.09: «потерялось очень много моих
// личных моментов… лучше бы они раскрывались полным списком, если бы я нажимал.
// Потому что это будет бесконечная лента. Пусть она будет, если человек её
// развернёт специально». Свёрнута по умолчанию, внутри — всё целиком, без
// ограничения сверху: это его записи, и молча их урезать значит повторить
// ту же потерю. 143 наблюдения у самого полного профиля.
function evidenceBlock(item) {
  const rows = (Array.isArray(item.evidence) ? item.evidence.filter((e) => e && e.observation) : [])
    // Порядок задаёт фронт, а не бэкенд: иначе стенд показывает одну
    // последовательность, а телефон другую, и проверка ничего не доказывает.
    // Свежее сверху — ленту читают как разговор.
    .slice()
    .sort((a, b) => String(b.observed_at || "").localeCompare(String(a.observed_at || "")));
  if (!rows.length) return null;
  const wrap = el("details", "evidence");
  const count = rows.length;
  wrap.appendChild(el(
    "summary",
    "evidence-toggle",
    "Из чего это сложилось: " + count + " " + pluralRu(count, "наблюдение", "наблюдения", "наблюдений"),
  ));
  const list = el("div", "evidence-list");
  rows.forEach((row) => {
    const entry = el("div", "evidence-row");
    const when = fmtDate(row.observed_at);
    if (when) entry.appendChild(el("span", "evidence-when", when));
    entry.appendChild(el("p", "evidence-text", row.observation));
    list.appendChild(entry);
  });
  wrap.appendChild(list);
  return wrap;
}

// Привычка — не строка трекера, а наблюдение о человеке, поэтому она живёт среди
// остальных тем, а не на своём экране. Трекер здесь уже пробовали: /habit запускали
// дважды, завершили ноль раз. Показываем то, чего нет в трекерах — чему привычка
// служит и какая замена обсуждалась. Кнопок «сделал» нет намеренно: срыв здесь
// материал для разговора, а не провал, и счётчик превратил бы его в провал.
function habitItem(habit) {
  const row = el("article", "understanding");
  row.classList.add(habit.user_confirmed ? "understanding--confirmed" : "understanding--open");
  row.appendChild(el("h3", "understanding-title", habit.name));
  if (habit.summary) row.appendChild(el("p", "understanding-body", habit.summary));
  // Порядок повторяет ход разговора: когда накрывает → чему служит → чем заменяли.
  [
    ["Когда накрывает", habit.trigger],
    ["Чему служит", habit.serves],
    ["Что пробовали вместо", habit.ritual],
  ].forEach(([label, text]) => {
    if (!text) return;
    const field = el("div", "habit-field");
    field.appendChild(el("div", "habit-field-label", label));
    field.appendChild(el("p", "habit-field-text", text));
    row.appendChild(field);
  });
  row.appendChild(el(
    "p",
    "understanding-mark",
    habit.user_confirmed
      ? "Ты подтвердил, что это про тебя."
      : "Это моё наблюдение о тебе.",
  ));
  // Снять привычку можно здесь. Раньше единственным способом её забыть был полный
  // сброс памяти: несоразмерная цена, поэтому ею не пользовались.
  const status = el("p", "understanding-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const drop = el("button", "understanding-choice", "Забыть эту привычку");
  drop.type = "button";
  drop.addEventListener("click", async () => {
    if (row.dataset.busy === "true") return;
    const ok = await confirmAction(
      "Забыть привычку «" + habit.name + "»? Она уйдёт с этого экрана и из моих выводов. " +
        "В копии твоих данных запись останется.",
    );
    if (!ok) return;
    row.dataset.busy = "true";
    drop.disabled = true;
    status.textContent = "Убираю…";
    try {
      await dismissHabit(habit.name);
      announceAction("Привычка забыта.");
    } catch (error) {
      row.dataset.busy = "false";
      drop.disabled = false;
      const reason = error && error.message;
      status.textContent =
        reason === "unauthorized" || reason === "no-init-data"
          ? "Сессия устарела. Открой профиль заново из чата."
          : "Не получилось убрать. Попробуй ещё раз.";
    }
  });
  const actions = el("div", "understanding-ask");
  actions.appendChild(drop);
  row.appendChild(actions);
  row.appendChild(status);
  return row;
}

function understandingScreen(p) {
  const panel = el("section", "screen");

  // Разговор остаётся главным, поэтому он первым и всегда, ещё до понимания.
  const talk = el("section", "talk");
  talk.appendChild(el("h2", "talk-title serif", "Можно просто поговорить"));
  const since = lastTurnLine(p);
  talk.appendChild(since
    ? el("p", "talk-since", since + " Я помню, о чём шла речь.")
    : el("p", "talk-since", "Расскажи, что сейчас у тебя на уме. Не нужно готовиться или заполнять профиль."));
  const chat = el("button", "talk-cta", "Вернуться в чат");
  chat.type = "button";
  chat.addEventListener("click", closeToChat);
  talk.appendChild(chat);
  panel.appendChild(talk);

  const sections = (p.sections || []).filter((s) => s && s.summary);
  // Привычки приходят отдельным массивом (бэкенд уже отсёк зависимости), но живут
  // на том же экране: для человека это одна и та же речь о нём, а не второй раздел.
  const habits = (p.habits || []).filter((h) => h && h.name);
  if (sections.length || habits.length) {
    const head = el("header", "screen-head");
    head.appendChild(el("h2", "screen-title serif", "Что я понял о тебе"));
    head.appendChild(el("p", "screen-intro", "Это то, что осталось у меня между разговорами. Не диагноз и не окончательный вывод: можно согласиться или снять."));
    panel.appendChild(head);

    // Нить сверху: она объясняет, почему темы ниже стоят рядом. Есть не у всех
    // (3 из 6 в production), поэтому блок условный, а не обязательный.
    const thread = (p.threads || []).find((t) => (t.members || []).length >= 2);
    if (thread) {
      const line = threadLine(thread);
      if (line) panel.appendChild(line);
    }

    // Неподтверждённое выше: только оно ждёт решения человека.
    const list = el("div", "understanding-list");
    const pending = sections.filter((s) => !s.user_confirmed);
    const settled = sections.filter((s) => s.user_confirmed);
    pending.concat(settled).forEach((s) => list.appendChild(understandingItem(s)));
    // Привычки после тем: они конкретнее и читаются как продолжение разговора,
    // а не как его оглавление.
    habits.forEach((h) => list.appendChild(habitItem(h)));
    panel.appendChild(list);
  } else {
    const empty = el("section", "screen-empty");
    empty.appendChild(el("h2", "screen-title serif", "Пока я мало что о тебе знаю"));
    empty.appendChild(el("p", "screen-intro", "Понимание появляется из разговоров, а не из анкеты. Напиши, что сейчас происходит, и оно соберётся само."));
    panel.appendChild(empty);
  }

  panel.appendChild(quietFooter(p));
  return panel;
}

// Подписка, приглашение и права на данные — заход раз в жизнь. Вкладки они не
// заслуживают, но и прятать их нельзя: удаление и экспорт данных обязаны
// оставаться достижимыми.
function quietFooter(p) {
  const foot = el("footer", "quiet-foot");
  if (p.show_upgrade) {
    const access = optionalBlock("Доступ и подписка", upgradeSection(p.billing, p.access));
    if (access) foot.appendChild(access);
  }
  if (p.invite_url) {
    const share = optionalBlock("Поделиться ботом", shareRow(p.referral, p.invite_url));
    if (share) foot.appendChild(share);
  }
  const data = optionalBlock("Мои данные", memoryControlsBlock(p.memory_center || {}));
  if (data) foot.appendChild(data);
  foot.appendChild(legalLinks());
  foot.appendChild(el("p", "quiet-foot-note", "MindCoach помогает с самонаблюдением, но не ставит диагнозов и не заменяет специалиста."));
  return foot;
}

function renderProfile(p) {
  const root = el("div", "profile");

  const top = el("header", "topbar");
  const identity = el("div", "brand");
  identity.appendChild(jaguarMark());
  const brandHeading = el("h1", "brand-heading");
  brandHeading.tabIndex = -1;
  brandHeading.dataset.viewHeading = "true";
  brandHeading.appendChild(el("span", "brand-name", "MindCoach"));
  brandHeading.appendChild(
    el("span", "brand-kicker", "Мой профиль · " + (p.pseudonym || "без имени")),
  );
  identity.appendChild(brandHeading);
  top.appendChild(identity);
  const updated = fmtDate(p.updated_at);
  if (updated) top.appendChild(el("div", "datepill", "обновлено " + updated));
  root.appendChild(top);

  root.appendChild(understandingScreen(p));
  attachVoiceEntry(root);
  return root;
}
function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const m = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return d.getDate() + " " + m[d.getMonth()];
}

function renderEmpty() {
  return stateView(
    "Здесь пока нет записей",
    "Можно начать с разговора в чате. Заполнять профиль и выбирать задание необязательно.",
    "○",
    [{ label: "Начать разговор", onClick: closeToChat }],
  );
}

let refreshTimer = null;
let refreshInFlight = null;
let refreshQueued = false;
let renderedProfileFingerprint = null;
let sessionExpired = false;
let movementLaunchHandled = false;
let activationPending = false;

function profileRenderFingerprint(profile) {
  if (!profile) return "null";
  // Dynamics timestamps are presentation-only and must not remount the whole page.
  const stable = { ...profile };
  delete stable.dynamics;
  if (stable.outcome_feedback) stable.outcome_feedback = stable.outcome_feedback.filter(row => row.measurement_point !== "movement");
  return JSON.stringify(stable);
}

function renderFetchedProfile(profile, replaceDrafts = false) {
  // Имя бота нужно кнопкам «Открыть в чате», поэтому обновляем его до рендера
  // и до раннего выхода по черновику.
  if (profile && typeof profile.bot_username === "string" && profile.bot_username) {
    botUsername = profile.bot_username;
  }
  // A background extraction can finish while the person is correcting memory.
  // Preserve their draft even if the field has lost focus or its tab is hidden.
  if (!replaceDrafts && hasMemoryDraft()) return false;
  // Polling/lifecycle events usually return the same document. Replacing the whole DOM
  // in that case resets scroll, focus and the star map, making a quiet refresh look like
  // a page reload. Only reconcile the view when the payload actually changed.
  const fingerprint = profileRenderFingerprint(profile);
  if (fingerprint === renderedProfileFingerprint) return false;
  renderedProfileFingerprint = fingerprint;
  setView(profile ? renderProfile(profile) : renderEmpty());
  if (!movementLaunchHandled && window.location.hash === "#movement" && document.getElementById("movement")) {
    movementLaunchHandled = true;
    openMovement();
  }
  return true;
}

function clearRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function refreshProfileView() {
  // focus, visibilitychange, Telegram activated и минутный таймер могут сработать
  // почти одновременно. Один запрос за раз не даёт более старому ответу перерисовать
  // уже свежий профиль и не создаёт лишнюю нагрузку перед трафиком.
  if (sessionExpired || activationPending) return Promise.resolve();
  if (refreshInFlight) {
    refreshQueued = true;
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const epoch = experimentMutationEpoch;
    try {
      const profile = await fetchProfile(true);
      if (epoch === experimentMutationEpoch) renderFetchedProfile(profile);
      scheduleRefresh(profile);
    } catch (error) {
      if (error && (error.message === "unauthorized" || error.message === "no-init-data")) {
        sessionExpired = true;
        clearRefreshTimer();
        setView(
          stateView(
            "Сессия завершилась",
            "Чтобы не показывать старые личные данные, открой «Мой профиль» заново из чата.",
            "○",
            [{ label: "Вернуться в чат", onClick: closeToChat }],
            "error",
          ),
        );
      } else {
        scheduleRefresh(null);
      }
    } finally {
      refreshInFlight = null;
      if (refreshQueued) {
        refreshQueued = false;
        queueMicrotask(refreshProfileView);
      }
    }
  })();
  return refreshInFlight;
}

function scheduleRefresh(profile) {
  clearRefreshTimer();
  if (sessionExpired || document.hidden) return;
  const pending = profile && profile.live_sync && profile.live_sync.pending_profile_update;
  const delay = pending ? 5000 : 60000;
  refreshTimer = setTimeout(refreshProfileView, delay);
}

// --- запуск -----------------------------------------------------------------

// Грузим config.js динамически с cache-buster. Telegram-webview агрессивно кэширует
// статичные ресурсы (~10 мин): при ротации туннеля телефон держал старый API_BASE и
// стучался в мёртвый origin. ?v=timestamp = свежий URL на каждое открытие → свежий config.
// Гейт: если JUNG_CONFIG уже задан инлайн (demo-стенд), ничего не грузим — стенд цел.
function loadConfig() {
  if (window.JUNG_CONFIG) return Promise.resolve();
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "./config.js?v=" + Date.now();
    s.onload = resolve;
    // Сбой загрузки config — не валим мини-апп: fetchProfile упадёт в понятное
    // «не дотянулся до профиля» и предложит переоткрыть.
    s.onerror = resolve;
    document.head.appendChild(s);
  });
}

function syncTelegramTheme() {
  const root = document.documentElement;
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const scheme = tg ? (tg.colorScheme === "dark" ? "dark" : "light") : (prefersDark ? "dark" : "light");
  root.dataset.telegramTheme = scheme;
  const params = objectOrEmpty(tg && tg.themeParams);
  const fallback = scheme === "dark" ? "#101915" : "#f5f4ed";
  const background = params.bg_color || fallback;
  const bottom = params.bottom_bar_bg_color || params.secondary_bg_color || background;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute("content", background);
  if (!tg) return;
  try {
    if (typeof tg.setHeaderColor === "function") tg.setHeaderColor(background);
    if (typeof tg.setBackgroundColor === "function") tg.setBackgroundColor(background);
    if (typeof tg.setBottomBarColor === "function") tg.setBottomBarColor(bottom);
  } catch (_) {
    /* Старые клиенты используют CSS-тему страницы. */
  }
}

async function main() {
  // Protect native Telegram close/swipe as well as our own chat button.
  const draftObserver = new MutationObserver(syncDraftCloseProtection);
  draftObserver.observe(document.getElementById("app"), {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ["data-dirty", "data-busy"],
  });
  window.addEventListener("beforeunload", event => {
    if (!hasMemoryDraft()) return;
    event.preventDefault();
    event.returnValue = "";
  });
  await loadConfig();
  syncTelegramTheme();
  if (tg) {
    tg.ready();
    tg.expand();
  }
  try {
    const profile = await fetchProfile();
    renderFetchedProfile(profile);
    scheduleRefresh(profile);
  } catch (e) {
    const msg =
      e.message === "unauthorized"
        ? "Не удалось подтвердить, что это ты. Открой мини-апп кнопкой из чата с ботом."
        : e.message === "no-init-data"
          ? "Эту страницу нужно открывать из Telegram — кнопкой «Мой профиль»."
          : "Не получилось дотянуться до профиля. Попробуй чуть позже.";
    const terminal = e.message === "unauthorized" || e.message === "no-init-data";
    sessionExpired = terminal;
    setView(
      stateView(
        terminal ? "Открой из чата" : "Не получилось загрузить профиль",
        msg,
        "✦",
        terminal
          ? [{ label: "Вернуться в чат", onClick: closeToChat }]
          : [
              { label: "Повторить", onClick: () => window.location.reload() },
              { label: "Вернуться в чат", onClick: closeToChat },
            ],
        "error",
      ),
    );
    if (!terminal) scheduleRefresh(null);
  }

  // Telegram 8.0+ явно сообщает, когда сохранённый WebView снова стал активным.
  // focus/visibility/pageshow остаются fallback для старых клиентов и браузеров.
  if (tg && typeof tg.onEvent === "function") {
    tg.onEvent("activated", refreshProfileView);
    tg.onEvent("themeChanged", syncTelegramTheme);
  }
  window.addEventListener("focus", refreshProfileView);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) refreshProfileView();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshProfileView();
  });
}

main();

// Owner rollout availability comes from the authenticated server, not public config.
function attachVoiceEntry(root) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  fetch(freshApiUrl('/api/voice/status'), {
    headers: apiHeaders(tg?.initData || '', false), signal: controller.signal,
  }).then(response => response.ok ? response.json() : null).then(data => {
    if (!data?.enabled || !root.isConnected) return;
    const button = el('button', 'voice-entry', 'Поговорить голосом');
    button.type = 'button';
    button.addEventListener('click', () => openVoiceScreen(data));
    // Voice sits in the first "talk" block, as the primary way to start talking.
    const talk = root.querySelector('.talk');
    const chat = talk?.querySelector('.talk-cta');
    if (talk && chat) {
      chat.classList.add('talk-cta-secondary');
      talk.insertBefore(button, chat);
      return;
    }
    const entry = el('section', 'voice-entry-section');
    entry.append(el('p', '', 'Можно просто поговорить'), button);
    root.append(entry);
  }).catch(() => { /* Unavailable optional feature stays hidden; profile remains usable. */ })
    .finally(() => clearTimeout(timer));
}

function openVoiceScreen(options = {}) {
  if (document.querySelector('.voice-screen')) return;
  const dialog = el('dialog', 'voice-screen');
  dialog.setAttribute('aria-labelledby', 'voice-title');
  const header = el('header', 'voice-header');
  const heading = el('div');
  const eyebrow = el('p', 'voice-eyebrow', 'MINDCOACH · ИИ-ПОДДЕРЖКА');
  const title = el('h2', 'serif', 'Разговор голосом');
  title.id = 'voice-title';
  heading.append(eyebrow, title);
  const settings = el('button', 'voice-small', 'Настройки');
  settings.type = 'button';
  settings.setAttribute('aria-expanded', 'false');
  header.append(heading, settings);
  const stage = el('div', 'voice-stage');
  const orb = el('div', 'voice-orb');
  orb.setAttribute('aria-hidden', 'true');
  orb.append(el('div', 'voice-orb-core'), el('div', 'voice-orb-light'));
  const status = el('p', 'voice-status', 'Можно говорить свободно');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const hint = el('p', 'voice-hint', 'Чтобы остановить ответ, скажи «стоп» или «подожди».');
  stage.append(orb, status, hint);
  const panel = el('section', 'voice-settings');
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Настройки разговора');
  const panelTitle = el('h3', 'serif', 'Как тебе комфортнее');
  const form = el('form');
  const addSelect = (name, label, choices, selected) => {
    const field = el('label', 'voice-field', label);
    const select = el('select');
    select.name = name;
    choices.forEach(choice => {
      const option = el('option', '', choice.label);
      option.value = choice.id;
      option.selected = choice.id === selected;
      select.append(option);
    });
    field.append(select); form.append(field);
    return select;
  };
  let prefs = options.preferences || {voice: 'sarah', style: 'warm'};
  // Every voice is a row with its own sample: choosing by description alone was odd.
  const voiceList = el('fieldset', 'voice-list');
  voiceList.append(el('legend', '', 'Голос'));
  const plays = [];
  (options.voices || [{id:'sarah',label:'Sarah · женский'}]).forEach(choice => {
    const [name, about = ''] = choice.label.split(' · ');
    const row = el('div', 'voice-option');
    const label = el('label');
    const radio = el('input');
    radio.type = 'radio'; radio.name = 'voice'; radio.value = choice.id;
    radio.checked = choice.id === prefs.voice;
    const text = el('span', 'voice-option-text');
    text.append(el('span', 'voice-option-name', name), el('span', 'voice-option-about', about));
    label.append(radio, text);
    const play = el('button', 'voice-play', '▶');
    play.type = 'button';
    play.dataset.voice = choice.id;
    play.setAttribute('aria-label', `Послушать голос ${name}`);
    play.setAttribute('aria-pressed', 'false');
    plays.push(play);
    row.append(label, play);
    voiceList.append(row);
  });
  form.append(voiceList);
  const selectedVoice = () => form.querySelector('input[name="voice"]:checked')?.value || prefs.voice;
  const style = addSelect('style', 'Стиль общения', options.styles || [{id:'warm',label:'Тёплый'}], prefs.style);
  const note = el('p', 'voice-hint', 'Стиль общий с чатом. Настройки применяются к следующей реплике.');
  const save = el('button', 'memory-chat', 'Сохранить настройки');
  save.type = 'submit';
  const saved = el('p', 'voice-settings-status');
  saved.setAttribute('role', 'status');
  form.append(note, save, saved);
  panel.append(panelTitle, form);
  const footer = el('footer', 'voice-footer');
  const start = el('button', 'memory-chat voice-start', 'Начать разговор');
  const controls = el('div', 'voice-controls');
  const mute = el('button', 'voice-control', 'Микрофон включён');
  mute.setAttribute('aria-pressed', 'false');
  const finish = el('button', 'voice-control voice-finish', 'Закончить');
  [start, mute, finish].forEach(button => { button.type = 'button'; });
  controls.append(mute, finish);
  const privacy = el('p', 'voice-privacy', 'Аудиозапись не сохраняется. Память работает по твоим настройкам. Это поддержка ИИ, не медицинская помощь.');
  footer.append(start, controls, privacy);
  let session, frame, lastFrame = 0, level = 0, preview = null, playing = null;
  const samples = new Map();
  const stopPreview = () => {
    preview?.stop(); preview = null;
    if (playing) { playing.textContent = '▶'; playing.setAttribute('aria-pressed', 'false'); playing = null; }
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sync = () => {
    const active = session && !session.closed;
    start.hidden = !!active;
    mute.disabled = !session?.ready;
    mute.textContent = session?.muted ? 'Микрофон выключен' : 'Микрофон включён';
    mute.setAttribute('aria-pressed', String(!!session?.muted));
    orb.dataset.state = !active ? 'idle' : session.sources.size ? 'playing' : session.muted ? 'muted' : session.awaiting ? 'thinking' : session.ready ? 'listening' : 'connecting';
  };
  session = new window.JungVoiceSession({
    base: window.JUNG_CONFIG.API_BASE, initData: tg.initData,
    status(text) { status.textContent = text; sync(); },
  });
  const animate = now => {
    if (!dialog.isConnected || document.hidden) return;
    if (now - lastFrame >= 33) {
      lastFrame = now; sync();
      const signal = session.closed ? 0 : Math.max(session.inputLevel || 0, session.outputLevel());
      level += (Math.min(1, signal * 5) - level) * .3;
      orb.style.setProperty('--voice-level', reducedMotion.matches ? 0 : level.toFixed(3));
    }
    frame = requestAnimationFrame(animate);
  };
  const stop = () => {
    stopPreview(); session.stop(); cancelAnimationFrame(frame);
    dialog.close(); dialog.remove();
    document.removeEventListener('visibilitychange', hidden);
  };
  const hidden = () => {
    cancelAnimationFrame(frame);
    if (document.hidden) {
      session.stop();
      status.textContent = 'Разговор остановлен. Нажми «Начать разговор», когда вернёшься.';
      sync();
    } else frame = requestAnimationFrame(animate);
  };
  const openSettings = () => {
    panel.hidden = false; stage.hidden = true; saved.textContent = '';
    settings.textContent = '← Назад';
    settings.setAttribute('aria-label', 'Вернуться к разговору');
    settings.setAttribute('aria-expanded', 'true');
    (form.querySelector('input[name="voice"]:checked') || form.querySelector('input[name="voice"]'))?.focus();
  };
  const closeSettings = message => {
    stopPreview();
    panel.hidden = true; stage.hidden = false;
    settings.textContent = 'Настройки';
    settings.removeAttribute('aria-label');
    settings.setAttribute('aria-expanded', 'false');
    if (message) status.textContent = message;
    (start.hidden ? settings : start).focus();
  };
  start.addEventListener('click', () => {
    closeSettings();
    session.retry = 0; session.start(); sync();
  });
  mute.addEventListener('click', () => {
    session.setMuted(!session.muted);
    status.textContent = session.muted ? 'Микрофон выключен. Ответ продолжит звучать.' : 'Слушаю тебя…';
    sync();
  });
  finish.addEventListener('click', stop);
  settings.addEventListener('click', () => { if (panel.hidden) openSettings(); else closeSettings(); });
  plays.forEach(play => play.addEventListener('click', async () => {
    const wasPlaying = playing === play;
    stopPreview();
    if (wasPlaying) return;
    playing = play; play.textContent = '■'; play.setAttribute('aria-pressed', 'true');
    saved.textContent = '';
    const id = play.dataset.voice;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
    try {
      if (!samples.has(id)) {
        const response = await fetch(freshApiUrl('/api/voice/preview'), {
          method: 'POST', headers: apiHeaders(tg.initData, true), signal: controller.signal,
          body: JSON.stringify({voice: id}),
        });
        if (!response.ok) throw new Error('Preview unavailable');
        samples.set(id, await response.json());
      }
      if (playing !== play) return;  // another voice was tapped while this one loaded
      const handle = await window.JungVoiceSession.playPreview(samples.get(id), () => {
        if (playing === play) stopPreview();
      });
      if (playing === play) preview = handle; else handle.stop();
    } catch {
      if (playing === play) stopPreview();
      saved.textContent = 'Не удалось включить пример. Попробуй ещё раз.';
    } finally { clearTimeout(timer); }
  }));
  form.addEventListener('submit', async event => {
    event.preventDefault(); save.disabled = true; saved.textContent = 'Сохраняю…';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
    try {
      const response = await fetch(freshApiUrl('/api/voice/settings'), {
        method: 'POST', headers: apiHeaders(tg.initData, true), signal: controller.signal,
        body: JSON.stringify({voice:selectedVoice(), style:style.value}),
      });
      if (!response.ok) throw new Error('Settings unavailable');
      prefs = (await response.json()).preferences; options.preferences = prefs;
      closeSettings(session.closed ? 'Сохранено. Можно начать разговор.' : 'Сохранено. Применится к следующей реплике.');
    } catch { saved.textContent = 'Не удалось сохранить. Попробуй ещё раз.'; }
    finally { clearTimeout(timer); save.disabled = false; }
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); stop(); });
  document.addEventListener('visibilitychange', hidden);
  dialog.append(header, stage, panel, footer);
  document.body.appendChild(dialog); dialog.showModal(); sync();
  frame = requestAnimationFrame(animate); start.focus();
}
