import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
// While the guide answers, only a spoken «стоп» confirmed by the server stops it.
// Owner phone test 2026-10-14: any sound cut the reply.
const source = await readFile(new URL('../voice.js', import.meta.url), 'utf8');
let time = 0;
let outputRms = 0;
function session() {
  const events = [];
  const binary = [];
  const sources = [];
  const timers = [];
  const context = { window: {}, URL, Map, Set, Float32Array, performance: { now: () => time },
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {} };
  vm.runInNewContext(source, context);
  const voice = new context.window.JungVoiceSession({ base: 'https://synthetic.test', initData: 'signed', status() {} });
  voice.closed = false;
  voice.ready = true;
  voice.ws = { readyState: 1, bufferedAmount: 0,
    send: data => (typeof data === 'string' ? events.push(JSON.parse(data)) : binary.push(data)) };
  voice.context = { currentTime: 0, destination: {},
    createBuffer: (_channels, n, rate) => ({ duration: n / rate, getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => { const s = { connect() {}, start() {}, stop() {} }; sources.push(s); return s; } };
  voice.analyser = { getFloatTimeDomainData: out => out.fill(outputRms) };
  voice.outputSamples = new Float32Array(256);
  voice.master = { gain: { value: 1 } };
  voice.message({ type: 'ready' });
  const frame = rms => { time += 20; voice.captureFrame({ pcm: new ArrayBuffer(960), rms }); };
  // One finished user turn, the guide starts speaking.
  for (let i = 0; i < 3; i++) frame(.1);
  time += 750; frame(0);
  voice.message({ type: 'phrase', turn: 1, phrase: 0, sample_rate: 24000 });
  voice.message({ type: 'audio', turn: 1, phrase: 0, pcm: 'AAAAAA==' });
  binary.length = 0;
  events.length = 0;
  return { voice, events, binary, sources, frame, timers };
}
const sent = (s, type) => s.events.filter(event => event.type === type).length;

// Owner 2026-10-14: a spoken «стоп» never worked reliably over the reply; the button
// «Остановить» stops it. While the guide answers, the microphone changes nothing.
let s = session();
for (let i = 0; i < 40; i++) s.frame(.3);
time += 750; s.frame(0);
assert.equal(sent(s, 'check'), 0, 'no stop checks any more');
assert.equal(sent(s, 'end'), 0, 'talking over the reply is not a turn');
assert.equal(sent(s, 'interrupt'), 0, 'and does not cut it');
assert.equal(s.voice.sources.size, 1, 'playback continues');
assert.equal(s.voice.master.gain.value, 1, 'and is not made quieter');
assert.equal(s.binary.length, 0, 'nothing said over the reply is sent');

// The button: playback stops here at once and the server is told.
s.voice.interrupt();
assert.equal(s.voice.sources.size, 0);
assert.equal(sent(s, 'interrupt'), 1);
for (let i = 0; i < 3; i++) s.frame(.1);
time += 750; s.frame(0);
assert.equal(sent(s, 'end'), 1, 'after the stop the person simply talks');

// A server `stopped` (older protocol) still stops local playback.
s = session();
s.voice.message({ type: 'stopped', turn: 1 });
assert.equal(s.voice.sources.size, 0);

// Owner 2026-10-14: answering right after the guide finished was lost. Once every phrase
// was sent and played, speech is the next turn.
s = session();
s.voice.message({ type: 'phrase_end', turn: 1, phrase: 0 });
s.voice.message({ type: 'generated', turn: 1 });
s.sources.forEach(source => source.onended?.());
time += 200;
for (let i = 0; i < 6; i++) s.frame(.1);
time += 750; s.frame(0);
assert.equal(sent(s, 'end'), 1, 'an answer after the reply is the next turn');

// The guide's last word echoing in the room right after playback does not start a turn.
s = session();
s.voice.message({ type: 'generated', turn: 1 });
s.sources.forEach(source => source.onended?.());
for (let i = 0; i < 4; i++) s.frame(.1);
time += 750; s.frame(0);
assert.equal(sent(s, 'end'), 0, 'echo tail is ignored');

// Between phrases the guide is still answering: speech there is ignored as well.
s = session();
s.sources.forEach(source => source.onended?.());
time += 200;
for (let i = 0; i < 10; i++) s.frame(.1);
time += 750; s.frame(0);
assert.equal(sent(s, 'end'), 0);

// The server took words for the next turn: the client follows its numbering.
s.voice.message({ type: 'heard_as_turn' });
assert.equal(s.voice.turn, 2);
assert.equal(s.voice.awaiting, true);

console.log('Voice reply: button stops it, talking over it is ignored, answers after it count: passed');
