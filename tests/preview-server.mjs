// Local, synthetic QA only. No Telegram token, production API or user data.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const files = new Set(["app.js", "styles.css", "today-prompt.js", "favicon.svg", "admin.js", "admin.css", "voice.js", "voice-worklet.js"]);
const mime = { js: "text/javascript", css: "text/css", svg: "image/svg+xml" };
let revision = 0;

function fixture(paid = false) {
  return {
    pseudonym: "Тестовый профиль",
    updated_at: new Date(Date.now() + revision++ * 1000).toISOString(),
    completeness: { percent: 0, missing: ["Детские раны"] },
    path: { activation: { stage: "portrait_ready" } },
    live_sync: { last_turn_at: "2026-09-05T12:00:00Z", pending_profile_update: false },
    outcome_prompts: { conversation_key: "synthetic-conversation-01" },
    // Реальная форма из production 18.09 (Supabase, только метрики — не текст):
    // 9 видимых разделов у самого полного профиля, summary 139-305 символов,
    // theme повторяется на четырёх разделах и собирается сервером в одну нить.
    // Прежняя фикстура НЕ содержала sections/threads вовсе, поэтому две сессии
    // подряд снимали скриншоты экрана без настоящего содержимого продукта.
    sections: [
      { key: "shadow", label: "Тень", group: "core", status: "confirmed_by_user", confidence: "medium", user_confirmed: true, evidence_count: 21, theme: "strah-nakazaniya",
        summary: "Похоже, ты привык быть тем, на кого можно положиться, и почти не оставляешь себе права быть слабым или несобранным. Всё, что не помещается в образ надёжного человека, ты убираешь подальше и стараешься не показывать даже близким, хотя оно никуда не девается.", evidence: [
          { observation: "Сказал, что снова взялся доделывать всё сам, потому что просить неудобно", observed_at: "2026-07-01T10:00:00.000Z", confidence: "high" },
          { observation: "Упомянул, что откладывает отдых до момента, когда продукт заработает", observed_at: "2026-08-02T10:00:00.000Z", confidence: "medium" },
          { observation: "Заметил за собой, что первым делом ищет свою ошибку, а не внешнюю причину", observed_at: "2026-09-03T10:00:00.000Z", confidence: "low" },
          { observation: "Рассказал про вечер, когда не стал писать близким, хотя было тяжело", observed_at: "2026-07-04T10:00:00.000Z", confidence: "high" },
          { observation: "Сказал, что злится на себя за несобранность сильнее, чем на кого-либо", observed_at: "2026-08-05T10:00:00.000Z", confidence: "medium" },
          { observation: "Вспомнил, как в детстве за ошибку ругали, а не помогали разобраться", observed_at: "2026-09-06T10:00:00.000Z", confidence: "low" },
          { observation: "Отметил, что ему проще заботиться, чем принимать заботу", observed_at: "2026-07-07T10:00:00.000Z", confidence: "high" },
          { observation: "Сказал, что снова взялся доделывать всё сам, потому что просить неудобно", observed_at: "2026-08-08T10:00:00.000Z", confidence: "medium" },
          { observation: "Упомянул, что откладывает отдых до момента, когда продукт заработает", observed_at: "2026-09-09T10:00:00.000Z", confidence: "low" },
          { observation: "Заметил за собой, что первым делом ищет свою ошибку, а не внешнюю причину", observed_at: "2026-07-10T10:00:00.000Z", confidence: "high" },
          { observation: "Рассказал про вечер, когда не стал писать близким, хотя было тяжело", observed_at: "2026-08-11T10:00:00.000Z", confidence: "medium" },
          { observation: "Сказал, что злится на себя за несобранность сильнее, чем на кого-либо", observed_at: "2026-09-12T10:00:00.000Z", confidence: "low" },
          { observation: "Вспомнил, как в детстве за ошибку ругали, а не помогали разобраться", observed_at: "2026-07-13T10:00:00.000Z", confidence: "high" },
          { observation: "Отметил, что ему проще заботиться, чем принимать заботу", observed_at: "2026-08-14T10:00:00.000Z", confidence: "medium" },
          { observation: "Сказал, что снова взялся доделывать всё сам, потому что просить неудобно", observed_at: "2026-09-15T10:00:00.000Z", confidence: "low" },
          { observation: "Упомянул, что откладывает отдых до момента, когда продукт заработает", observed_at: "2026-07-16T10:00:00.000Z", confidence: "high" },
          { observation: "Заметил за собой, что первым делом ищет свою ошибку, а не внешнюю причину", observed_at: "2026-08-17T10:00:00.000Z", confidence: "medium" },
          { observation: "Рассказал про вечер, когда не стал писать близким, хотя было тяжело", observed_at: "2026-09-18T10:00:00.000Z", confidence: "low" },
          { observation: "Сказал, что злится на себя за несобранность сильнее, чем на кого-либо", observed_at: "2026-07-19T10:00:00.000Z", confidence: "high" },
          { observation: "Вспомнил, как в детстве за ошибку ругали, а не помогали разобраться", observed_at: "2026-08-20T10:00:00.000Z", confidence: "medium" },
          { observation: "Отметил, что ему проще заботиться, чем принимать заботу", observed_at: "2026-09-21T10:00:00.000Z", confidence: "low" },
        ] },
      { key: "life_context", label: "Жизненный контекст", group: "core", status: "working", confidence: "high", user_confirmed: false, evidence_count: 20, theme: "produktovoe-myshlenie",
        summary: "Сейчас много сил уходит на продукт, который ты делаешь один, и это занимает почти всё внимание. Отдых откладывается на потом.", evidence: [
          { observation: "Упомянул, что откладывает отдых до момента, когда продукт заработает", observed_at: "2026-07-01T10:00:00.000Z", confidence: "high" },
          { observation: "Заметил за собой, что первым делом ищет свою ошибку, а не внешнюю причину", observed_at: "2026-08-02T10:00:00.000Z", confidence: "medium" },
          { observation: "Рассказал про вечер, когда не стал писать близким, хотя было тяжело", observed_at: "2026-09-03T10:00:00.000Z", confidence: "low" },
          { observation: "Сказал, что злится на себя за несобранность сильнее, чем на кого-либо", observed_at: "2026-07-04T10:00:00.000Z", confidence: "high" },
          { observation: "Вспомнил, как в детстве за ошибку ругали, а не помогали разобраться", observed_at: "2026-08-05T10:00:00.000Z", confidence: "medium" },
          { observation: "Отметил, что ему проще заботиться, чем принимать заботу", observed_at: "2026-09-06T10:00:00.000Z", confidence: "low" },
          { observation: "Сказал, что снова взялся доделывать всё сам, потому что просить неудобно", observed_at: "2026-07-07T10:00:00.000Z", confidence: "high" },
          { observation: "Упомянул, что откладывает отдых до момента, когда продукт заработает", observed_at: "2026-08-08T10:00:00.000Z", confidence: "medium" },
          { observation: "Заметил за собой, что первым делом ищет свою ошибку, а не внешнюю причину", observed_at: "2026-09-09T10:00:00.000Z", confidence: "low" },
          { observation: "Рассказал про вечер, когда не стал писать близким, хотя было тяжело", observed_at: "2026-07-10T10:00:00.000Z", confidence: "high" },
          { observation: "Сказал, что злится на себя за несобранность сильнее, чем на кого-либо", observed_at: "2026-08-11T10:00:00.000Z", confidence: "medium" },
          { observation: "Вспомнил, как в детстве за ошибку ругали, а не помогали разобраться", observed_at: "2026-09-12T10:00:00.000Z", confidence: "low" },
          { observation: "Отметил, что ему проще заботиться, чем принимать заботу", observed_at: "2026-07-13T10:00:00.000Z", confidence: "high" },
          { observation: "Сказал, что снова взялся доделывать всё сам, потому что просить неудобно", observed_at: "2026-08-14T10:00:00.000Z", confidence: "medium" },
          { observation: "Упомянул, что откладывает отдых до момента, когда продукт заработает", observed_at: "2026-09-15T10:00:00.000Z", confidence: "low" },
          { observation: "Заметил за собой, что первым делом ищет свою ошибку, а не внешнюю причину", observed_at: "2026-07-16T10:00:00.000Z", confidence: "high" },
          { observation: "Рассказал про вечер, когда не стал писать близким, хотя было тяжело", observed_at: "2026-08-17T10:00:00.000Z", confidence: "medium" },
          { observation: "Сказал, что злится на себя за несобранность сильнее, чем на кого-либо", observed_at: "2026-09-18T10:00:00.000Z", confidence: "low" },
          { observation: "Вспомнил, как в детстве за ошибку ругали, а не помогали разобраться", observed_at: "2026-07-19T10:00:00.000Z", confidence: "high" },
          { observation: "Отметил, что ему проще заботиться, чем принимать заботу", observed_at: "2026-08-20T10:00:00.000Z", confidence: "medium" },
        ] },
      { key: "patterns", label: "Паттерны", group: "core", status: "working", confidence: "high", user_confirmed: false, evidence_count: 20, theme: "strah-nakazaniya",
        summary: "Когда что-то идёт не по плану, ты сначала ищешь, что сделал не так сам, и только потом смотришь на обстоятельства.", evidence: [
          { observation: "Заметил за собой, что первым делом ищет свою ошибку, а не внешнюю причину", observed_at: "2026-07-01T10:00:00.000Z", confidence: "high" },
          { observation: "Рассказал про вечер, когда не стал писать близким, хотя было тяжело", observed_at: "2026-08-02T10:00:00.000Z", confidence: "medium" },
          { observation: "Сказал, что злится на себя за несобранность сильнее, чем на кого-либо", observed_at: "2026-09-03T10:00:00.000Z", confidence: "low" },
          { observation: "Вспомнил, как в детстве за ошибку ругали, а не помогали разобраться", observed_at: "2026-07-04T10:00:00.000Z", confidence: "high" },
          { observation: "Отметил, что ему проще заботиться, чем принимать заботу", observed_at: "2026-08-05T10:00:00.000Z", confidence: "medium" },
          { observation: "Сказал, что снова взялся доделывать всё сам, потому что просить неудобно", observed_at: "2026-09-06T10:00:00.000Z", confidence: "low" },
          { observation: "Упомянул, что откладывает отдых до момента, когда продукт заработает", observed_at: "2026-07-07T10:00:00.000Z", confidence: "high" },
          { observation: "Заметил за собой, что первым делом ищет свою ошибку, а не внешнюю причину", observed_at: "2026-08-08T10:00:00.000Z", confidence: "medium" },
          { observation: "Рассказал про вечер, когда не стал писать близким, хотя было тяжело", observed_at: "2026-09-09T10:00:00.000Z", confidence: "low" },
          { observation: "Сказал, что злится на себя за несобранность сильнее, чем на кого-либо", observed_at: "2026-07-10T10:00:00.000Z", confidence: "high" },
          { observation: "Вспомнил, как в детстве за ошибку ругали, а не помогали разобраться", observed_at: "2026-08-11T10:00:00.000Z", confidence: "medium" },
          { observation: "Отметил, что ему проще заботиться, чем принимать заботу", observed_at: "2026-09-12T10:00:00.000Z", confidence: "low" },
          { observation: "Сказал, что снова взялся доделывать всё сам, потому что просить неудобно", observed_at: "2026-07-13T10:00:00.000Z", confidence: "high" },
          { observation: "Упомянул, что откладывает отдых до момента, когда продукт заработает", observed_at: "2026-08-14T10:00:00.000Z", confidence: "medium" },
          { observation: "Заметил за собой, что первым делом ищет свою ошибку, а не внешнюю причину", observed_at: "2026-09-15T10:00:00.000Z", confidence: "low" },
          { observation: "Рассказал про вечер, когда не стал писать близким, хотя было тяжело", observed_at: "2026-07-16T10:00:00.000Z", confidence: "high" },
          { observation: "Сказал, что злится на себя за несобранность сильнее, чем на кого-либо", observed_at: "2026-08-17T10:00:00.000Z", confidence: "medium" },
          { observation: "Вспомнил, как в детстве за ошибку ругали, а не помогали разобраться", observed_at: "2026-09-18T10:00:00.000Z", confidence: "low" },
          { observation: "Отметил, что ему проще заботиться, чем принимать заботу", observed_at: "2026-07-19T10:00:00.000Z", confidence: "high" },
          { observation: "Сказал, что снова взялся доделывать всё сам, потому что просить неудобно", observed_at: "2026-08-20T10:00:00.000Z", confidence: "medium" },
        ] },
      { key: "childhood_wounds", label: "Детские раны", group: "core", status: "confirmed_by_user", confidence: "high", user_confirmed: true, evidence_count: 17, theme: "strah-nakazaniya",
        summary: "В детстве ошибка часто означала, что тебя будут ругать, а не что тебе помогут разобраться. Ты научился предугадывать недовольство заранее и стараться не давать поводов.", evidence: [
          { observation: "Рассказал про вечер, когда не стал писать близким, хотя было тяжело", observed_at: "2026-07-01T10:00:00.000Z", confidence: "high" },
          { observation: "Сказал, что злится на себя за несобранность сильнее, чем на кого-либо", observed_at: "2026-08-02T10:00:00.000Z", confidence: "medium" },
          { observation: "Вспомнил, как в детстве за ошибку ругали, а не помогали разобраться", observed_at: "2026-09-03T10:00:00.000Z", confidence: "low" },
          { observation: "Отметил, что ему проще заботиться, чем принимать заботу", observed_at: "2026-07-04T10:00:00.000Z", confidence: "high" },
          { observation: "Сказал, что снова взялся доделывать всё сам, потому что просить неудобно", observed_at: "2026-08-05T10:00:00.000Z", confidence: "medium" },
          { observation: "Упомянул, что откладывает отдых до момента, когда продукт заработает", observed_at: "2026-09-06T10:00:00.000Z", confidence: "low" },
          { observation: "Заметил за собой, что первым делом ищет свою ошибку, а не внешнюю причину", observed_at: "2026-07-07T10:00:00.000Z", confidence: "high" },
          { observation: "Рассказал про вечер, когда не стал писать близким, хотя было тяжело", observed_at: "2026-08-08T10:00:00.000Z", confidence: "medium" },
          { observation: "Сказал, что злится на себя за несобранность сильнее, чем на кого-либо", observed_at: "2026-09-09T10:00:00.000Z", confidence: "low" },
          { observation: "Вспомнил, как в детстве за ошибку ругали, а не помогали разобраться", observed_at: "2026-07-10T10:00:00.000Z", confidence: "high" },
          { observation: "Отметил, что ему проще заботиться, чем принимать заботу", observed_at: "2026-08-11T10:00:00.000Z", confidence: "medium" },
          { observation: "Сказал, что снова взялся доделывать всё сам, потому что просить неудобно", observed_at: "2026-09-12T10:00:00.000Z", confidence: "low" },
          { observation: "Упомянул, что откладывает отдых до момента, когда продукт заработает", observed_at: "2026-07-13T10:00:00.000Z", confidence: "high" },
          { observation: "Заметил за собой, что первым делом ищет свою ошибку, а не внешнюю причину", observed_at: "2026-08-14T10:00:00.000Z", confidence: "medium" },
          { observation: "Рассказал про вечер, когда не стал писать близким, хотя было тяжело", observed_at: "2026-09-15T10:00:00.000Z", confidence: "low" },
          { observation: "Сказал, что злится на себя за несобранность сильнее, чем на кого-либо", observed_at: "2026-07-16T10:00:00.000Z", confidence: "high" },
          { observation: "Вспомнил, как в детстве за ошибку ругали, а не помогали разобраться", observed_at: "2026-08-17T10:00:00.000Z", confidence: "medium" },
        ] },
      { key: "fears", label: "Страхи", group: "core", status: "confirmed_by_user", confidence: "high", user_confirmed: true, evidence_count: 20, theme: "strah-nakazaniya",
        summary: "Больше всего беспокоит мысль, что если перестать стараться, то люди рядом отвернутся и останешься один.", evidence: [
          { observation: "Сказал, что злится на себя за несобранность сильнее, чем на кого-либо", observed_at: "2026-07-01T10:00:00.000Z", confidence: "high" },
          { observation: "Вспомнил, как в детстве за ошибку ругали, а не помогали разобраться", observed_at: "2026-08-02T10:00:00.000Z", confidence: "medium" },
          { observation: "Отметил, что ему проще заботиться, чем принимать заботу", observed_at: "2026-09-03T10:00:00.000Z", confidence: "low" },
          { observation: "Сказал, что снова взялся доделывать всё сам, потому что просить неудобно", observed_at: "2026-07-04T10:00:00.000Z", confidence: "high" },
          { observation: "Упомянул, что откладывает отдых до момента, когда продукт заработает", observed_at: "2026-08-05T10:00:00.000Z", confidence: "medium" },
          { observation: "Заметил за собой, что первым делом ищет свою ошибку, а не внешнюю причину", observed_at: "2026-09-06T10:00:00.000Z", confidence: "low" },
          { observation: "Рассказал про вечер, когда не стал писать близким, хотя было тяжело", observed_at: "2026-07-07T10:00:00.000Z", confidence: "high" },
          { observation: "Сказал, что злится на себя за несобранность сильнее, чем на кого-либо", observed_at: "2026-08-08T10:00:00.000Z", confidence: "medium" },
          { observation: "Вспомнил, как в детстве за ошибку ругали, а не помогали разобраться", observed_at: "2026-09-09T10:00:00.000Z", confidence: "low" },
          { observation: "Отметил, что ему проще заботиться, чем принимать заботу", observed_at: "2026-07-10T10:00:00.000Z", confidence: "high" },
          { observation: "Сказал, что снова взялся доделывать всё сам, потому что просить неудобно", observed_at: "2026-08-11T10:00:00.000Z", confidence: "medium" },
          { observation: "Упомянул, что откладывает отдых до момента, когда продукт заработает", observed_at: "2026-09-12T10:00:00.000Z", confidence: "low" },
          { observation: "Заметил за собой, что первым делом ищет свою ошибку, а не внешнюю причину", observed_at: "2026-07-13T10:00:00.000Z", confidence: "high" },
          { observation: "Рассказал про вечер, когда не стал писать близким, хотя было тяжело", observed_at: "2026-08-14T10:00:00.000Z", confidence: "medium" },
          { observation: "Сказал, что злится на себя за несобранность сильнее, чем на кого-либо", observed_at: "2026-09-15T10:00:00.000Z", confidence: "low" },
          { observation: "Вспомнил, как в детстве за ошибку ругали, а не помогали разобраться", observed_at: "2026-07-16T10:00:00.000Z", confidence: "high" },
          { observation: "Отметил, что ему проще заботиться, чем принимать заботу", observed_at: "2026-08-17T10:00:00.000Z", confidence: "medium" },
          { observation: "Сказал, что снова взялся доделывать всё сам, потому что просить неудобно", observed_at: "2026-09-18T10:00:00.000Z", confidence: "low" },
          { observation: "Упомянул, что откладывает отдых до момента, когда продукт заработает", observed_at: "2026-07-19T10:00:00.000Z", confidence: "high" },
          { observation: "Заметил за собой, что первым делом ищет свою ошибку, а не внешнюю причину", observed_at: "2026-08-20T10:00:00.000Z", confidence: "medium" },
        ] },
      { key: "anima_animus", label: "Анима и Анимус", group: "enrichment", status: "confirmed_by_user", confidence: "high", user_confirmed: true, evidence_count: 8, theme: "strah-nakazaniya",
        summary: "В близких отношениях тебе проще заботиться, чем принимать заботу, и просьба о помощи даётся тяжелее всего.", evidence: [
          { observation: "Отметил, что ему проще заботиться, чем принимать заботу", observed_at: "2026-07-01T10:00:00.000Z", confidence: "high" },
          { observation: "Сказал, что снова взялся доделывать всё сам, потому что просить неудобно", observed_at: "2026-08-02T10:00:00.000Z", confidence: "medium" },
          { observation: "Упомянул, что откладывает отдых до момента, когда продукт заработает", observed_at: "2026-09-03T10:00:00.000Z", confidence: "low" },
          { observation: "Заметил за собой, что первым делом ищет свою ошибку, а не внешнюю причину", observed_at: "2026-07-04T10:00:00.000Z", confidence: "high" },
          { observation: "Рассказал про вечер, когда не стал писать близким, хотя было тяжело", observed_at: "2026-08-05T10:00:00.000Z", confidence: "medium" },
          { observation: "Сказал, что злится на себя за несобранность сильнее, чем на кого-либо", observed_at: "2026-09-06T10:00:00.000Z", confidence: "low" },
          { observation: "Вспомнил, как в детстве за ошибку ругали, а не помогали разобраться", observed_at: "2026-07-07T10:00:00.000Z", confidence: "high" },
          { observation: "Отметил, что ему проще заботиться, чем принимать заботу", observed_at: "2026-08-08T10:00:00.000Z", confidence: "medium" },
        ] },
    ],
    threads: [
      { theme: "strah-nakazaniya", need: null, members: [
        { kind: "facet", key: "shadow", label: "Тень" },
        { kind: "facet", key: "childhood_wounds", label: "Детские раны" },
        { kind: "facet", key: "fears", label: "Страхи" },
        { kind: "facet", key: "anima_animus", label: "Анима и Анимус" },
      ] },
    ],
    archetypes: [],
    // Привычка в реальной форме: длинный summary, все три поля заполнены, и вторая
    // запись без ритуала (замена ещё не найдена) — иначе стенд показывал бы только
    // удобный случай. Зависимости сюда не попадают: их отсекает бэкенд.
    habits: [
      {
        name: "листание ленты перед сном",
        summary: "Перед сном залипает в телефоне по часу и дольше, потом винит себя за недосып и разбитое утро, но вечером всё повторяется.",
        trigger: "тишина в комнате, когда все уже легли и никто ничего не просит",
        serves: "побыть в пространстве, где от него ничего не требуют и можно не быть хорошим",
        ritual: "чай и десять страниц бумажной книги на том же месте",
        user_confirmed: true,
      },
      {
        // Привычка про вещества: стенд обязан показывать, что она ВИДНА наравне с
        // остальными (19.09.2026: ничего от человека не скрываем).
        name: "вечерний бокал вина",
        summary: "Каждый вечер бокал, чтобы выключить тревогу после рабочего дня, и утром об этом жалеет.",
        trigger: "момент, когда рабочий день формально закончился, а голова нет",
        serves: "поставить точку в дне, когда иначе она не ставится",
        user_confirmed: false,
      },
      {
        name: "откладывает трудные письма",
        summary: "Ответы, которые требуют неприятного разговора, лежат до последнего, пока срок не начинает жечь.",
        trigger: "письмо, где придётся с кем-то не согласиться",
        serves: "отодвинуть момент, когда придётся занять сторону и выдержать чужое недовольство",
        user_confirmed: false,
      },
    ],
    // Реальная форма данных из production 18.09: 95-156 символов на запись,
    // подряд одинаковые типы (цель, цель, предпочтение). Синтетика с короткими
    // разнотипными строками скрывала то, что владелец увидел сразу.
    memory_center: {
      writes_paused: false,
      manual_types: [{ value: "goal", label: "Цель" }, { value: "preference", label: "Предпочтение" }],
      groups: [
        { class: "semantic", label: "Важное о тебе", description: "Устойчивые факты, которые помогают не переспрашивать важное.",
          items: [
            { key: "m1", type: "goal", type_label: "Цель", editable: true,
              content: "Хочет довести продукт до состояния, когда им пользуются каждый день и он приносит устойчивый доход",
              source: "Ты прямо сказал это в разговоре.", why: "Чтобы не терять важную цель или договорённость.",
              recorded_on: "2026-09-05" },
            { key: "m2", type: "goal", type_label: "Цель", editable: true,
              content: "Планирует закончить переезд до конца осени и не откладывать это на зиму",
              source: "Ты прямо сказал это в разговоре.", why: "Чтобы не терять важную цель или договорённость.",
              recorded_on: "2026-09-08" },
            { key: "m3", type: "preference", type_label: "Предпочтение", editable: true,
              content: "Предпочитает прямую и короткую обратную связь без лишней мягкости, ему важнее точность формулировки, чем бережность тона",
              source: "Ты уточнил или исправил эту запись.", why: "Чтобы не просить тебя повторять важное.",
              recorded_on: "2026-09-12" },
            { key: "m4", type: "boundary", type_label: "Граница", editable: true, needs_confirmation: true,
              content: "Не обсуждать рабочие задачи по выходным, это время для семьи",
              source: "Ты прямо сказал это в разговоре.", why: "Чтобы учитывать обозначенную тобой границу.",
              recorded_on: "2026-09-15" },
            { key: "m5", type: "preference", type_label: "Предпочтение", editable: true, is_guess: true,
              content: "Похоже, тебе легче начинать с самого маленького шага, когда задача кажется слишком большой",
              source: "Это догадка Проводника, а не твои слова.", why: "Чтобы помнить, что уже помогало.",
              recorded_on: "2026-09-16" },
          ] },
        { class: "working", label: "Открытые нити", description: "Незавершённые темы, к которым можно вернуться. Они удаляются автоматически.",
          items: [
            { key: "m6", type: "open_thread", type_label: "Открытая тема",
              content: "Решить, продолжать ли текущий проект после отпуска или свернуть его и взяться за другое",
              source: "Ты прямо сказал это в разговоре.", why: "Чтобы вернуться к незавершённой теме.",
              recorded_on: "2026-09-16", expires_on: "2026-12-15" },
          ] },
        { class: "episodic", label: "Что происходило", description: "Значимые события, решения, попытки и результаты с ограниченным сроком.",
          items: [
            { key: "m7", type: "result", type_label: "Результат",
              content: "Попробовалговорить с руководителем про выходные, в итоге договорились не писать после шести",
              source: "Ты прямо сказал это в разговоре.", why: "Чтобы помнить, что уже происходило и к чему это привело.",
              recorded_on: "2026-09-14", expires_on: "2027-03-13" },
          ] },
      ],
    },
    show_upgrade: !paid,
    is_paid: paid,
    billing: { monthly_xtr: 500, annual_xtr: 5000, annual_available: true, payments_available: true },
    access: { mode: "free" },
  };
}

const runtime = `
  const query = new URLSearchParams(location.search);
  window.JUNG_CONFIG = {API_BASE: location.origin + '/fixture/' + (query.get('state') || 'profile')};
  window.Telegram = {WebApp: {
    initData: 'synthetic-preview-only', colorScheme: query.get('theme') || 'light', themeParams: {},
    ready() {}, expand() {}, onEvent() {}, setHeaderColor() {}, setBackgroundColor() {},
    setBottomBarColor() {}, close() {document.getElementById('preview-status').textContent = 'Возврат в чат';},
    BackButton: {show(){}, hide(){}, onClick(){}}, HapticFeedback: {selectionChanged(){}},
    openInvoice(url, done) {done('cancelled');}
  }};
  if (query.get('voice') === 'denied') window.AudioContext = class { async resume() {} async close() {} };
  if (query.get('voice') === 'denied') Object.defineProperty(navigator, 'mediaDevices', {value: {getUserMedia: async () => {throw new DOMException('Synthetic denial', 'NotAllowedError');}}});
  if (document.getElementById('preview-refresh')) document.getElementById('preview-refresh').onclick = () => refreshProfileView();
`;

createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:8765");
  res.setHeader("Cache-Control", "no-store");
  try {
    if (url.pathname.startsWith("/fixture/")) {
      res.setHeader("Content-Type", "application/json");
      if (url.pathname === "/fixture/admin/api/admin/overview") {
        res.end(JSON.stringify({outcomes: {step_attempt: {done: 2, partly: 1, not_yet: 3}}})); return;
      }
      if (url.pathname.startsWith("/fixture/step")) {
        if (req.method === "POST" && url.pathname.startsWith("/fixture/step-offline/")) {
          res.writeHead(503); res.end('{}'); return;
        }
        if (req.method === "POST" && url.pathname.startsWith("/fixture/step-conflict/")) {
          res.writeHead(409); res.end('{}'); return;
        }
        // Real local API + in-memory synthetic profile. Never proxy production.
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const backend = await fetch("http://127.0.0.1:8766" + url.pathname.replace(/^\/fixture\/[^/]+/, "") + url.search, {
          method: req.method,
          headers: {Authorization: "tma synthetic", "Content-Type": "application/json"},
          body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
        });
        res.writeHead(backend.status);
        res.end(await backend.text()); return;
      }
      if (url.pathname.includes("/error/")) { res.writeHead(503); res.end('{}'); return; }
      if (url.pathname.includes("/unauthorized/")) { res.writeHead(401); res.end('{}'); return; }
      if (url.pathname.includes("/empty/")) { res.end('{"profile":null}'); return; }
      if (req.method === "POST") {
        if (url.pathname.endsWith("/voice/preview")) {
          res.end(JSON.stringify({sample_rate: 24000, gain: 1.2, pcm: Buffer.alloc(4800).toString("base64")})); return;
        }
        if (url.pathname.endsWith("/voice/settings")) {
          res.end(JSON.stringify({preferences: {voice: "alice", style: "warm"}})); return;
        }
        if (url.pathname.endsWith("/invoice")) {
          res.end(JSON.stringify({url: "https://t.me/$synthetic-invoice"})); return;
        }
        res.end(JSON.stringify({profile: fixture(), recorded: true})); return;
      }
      if (url.pathname.endsWith("/voice/status")) { res.end(JSON.stringify({enabled: true, preferences:{voice:"sarah",style:"warm"}, voices:[{id:"sarah",label:"Sarah · женский"},{id:"alice",label:"Alice · женский"},{id:"george",label:"George · мужской"},{id:"brian",label:"Brian · мужской"}],styles:[{id:"warm",label:"Тёплый"},{id:"direct",label:"Прямой"},{id:"friendly",label:"Дружеский"},{id:"raw",label:"С характером"}]})); return; }
      res.end(JSON.stringify({profile: fixture(url.pathname.includes("/paid/"))})); return;
    }
    if (url.pathname === "/preview-runtime.js") {
      res.setHeader("Content-Type", "text/javascript"); res.end(runtime); return;
    }
    if (url.pathname === "/admin-preview") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      const html = (await readFile(new URL("admin.html", root), "utf8"))
        .replace(/<link[\s\S]*?>/g, match => match.includes("fonts.google") ? "" : match)
        .replace('<script src="https://telegram.org/js/telegram-web-app.js"></script>', "")
        .replace(/\.\/config\.js\?v=[^\"]+/, "/preview-runtime.js")
        .replace('<body>', '<body><aside style="padding:8px">Синтетический стенд. Все числа вымышлены.</aside>');
      res.end(html); return;
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; script-src 'self'; img-src 'self' data:");
      res.end(`<!doctype html><html lang="ru"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
        <title>Синтетическая проверка MindCoach</title><link rel="icon" href="/favicon.svg">
        <link rel="stylesheet" href="/styles.css"></head><body>
        <aside style="font:12px system-ui;padding:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">Синтетический стенд. Все данные вымышлены.
        <button type="button" id="preview-refresh">Смоделировать обновление</button>
        <span id="preview-status" role="status"></span></aside>
        <main class="app" id="app"></main><p id="action-status" class="sr-only" role="status" aria-live="polite"></p>
        <script src="/preview-runtime.js"></script><script src="/today-prompt.js"></script><script src="/voice.js"></script><script src="/app.js"></script>
        </body></html>`); return;
    }
    const name = url.pathname.slice(1);
    if (!files.has(name)) { res.writeHead(404); res.end(); return; }
    res.setHeader("Content-Type", mime[name.split('.').pop()]);
    res.end(await readFile(new URL(name, root)));
  } catch (_) { res.writeHead(500); res.end(); }
}).listen(8765, "127.0.0.1", () => {
  console.log("Synthetic preview: http://127.0.0.1:8765/?theme=light&state=profile");
});
