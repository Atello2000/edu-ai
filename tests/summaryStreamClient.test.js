const fs = require('fs');
const vm = require('vm');
const path = require('path');
function harness() {
  const states = [], frames = new Map(), requests = [], events = [];
  let frameId = 0;
  const save = jest.fn();
  const context = {
    useState(initial) { const i = states.length; states.push(initial); return [initial, next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useRef: current => ({ current }), useCallback: fn => fn, useEffect: () => {},
    eventBus: { emit: (...args) => events.push(args) },
    localStorage: { getItem: () => null },
    requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    XMLHttpRequest: class {
      constructor() { this.responseText = ''; this.status = 200; requests.push(this); }
      open() {} setRequestHeader() {} send() {} abort() { this.onabort?.(); }
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '../client/src/hooks/useSummarize.js'), 'utf8')
    .replace(/^import .*;$/gm, '').replace('export function useSummarize', 'function useSummarize');
  vm.runInNewContext(source + '\nthis.create = useSummarize;', context);
  const api = context.create({ saveSession: save });
  api.summarize([{ name: 'course.pptx', text: 'course' }]);
  const current = () => requests.at(-1);
  const send = data => { current().responseText += 'data: ' + JSON.stringify(data) + '\n\n'; current().onprogress(); };
  function flush() { let n = 0; while (frames.size) { if (++n > 1000) throw Error('Animation never ends'); const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(f => f()); } }
  return { states, api, requests, current, send, flush, save, events };
}
test('provider failure removes the long-course spinner and progress', () => {
  const h = harness();
  h.send({ type: 'progress', name: 'course.pptx', message: '4 parties' });
  h.send({ type: 'error', message: 'Service indisponible' });
  h.current().onload();
  expect(h.states[1]).toEqual({}); expect(h.states[2]).toEqual({});
  expect(h.states[3]).toBe(false); expect(h.states[4]).toBe('Service indisponible');
  expect(h.save).not.toHaveBeenCalled();
});
test('HTTP rejection is displayed instead of leaving a loading card', () => {
  const h = harness(); h.current().status = 403;
  h.current().responseText = JSON.stringify({ error: 'Session invalide' }); h.current().onload();
  expect(h.states[3]).toBe(false); expect(h.states[4]).toBe('Session invalide');
});
test('network close before done rejects incomplete text and clears progress', () => {
  const h = harness();
  h.send({ type: 'start', name: 'course.pptx' }); h.send({ type: 'delta', name: 'course.pptx', text: 'partial' });
  h.current().onload(); h.flush();
  expect(h.states[3]).toBe(false); expect(h.states[1]).toEqual({});
  expect(h.states[4]).toMatch(/interrompue/); expect(h.save).not.toHaveBeenCalled();
});
test('load without progress events consumes final bytes, patch and CRLF frames', () => {
  const h = harness();
  h.current().responseText = [
    { type: 'start', name: 'course.pptx' }, { type: 'delta', name: 'course.pptx', text: 'Summary' },
    { type: 'patch', name: 'course.pptx', text: 'Repaired section' }, { type: 'done', name: 'course.pptx' }, { type: 'end' },
  ].map(d => 'data: ' + JSON.stringify(d)).join('\r\n\r\n') + '\r\n\r\n';
  h.current().onload(); h.flush();
  expect(h.states[0][0].summary).toBe('Summary\n\nRepaired section');
  expect(h.states[3]).toBe(false); expect(h.save).toHaveBeenCalledTimes(1);
});
test('done without end still finalizes completed text', () => {
  const h = harness(); h.send({ type: 'start', name: 'course.pptx' });
  h.send({ type: 'delta', name: 'course.pptx', text: 'Complete' }); h.send({ type: 'done', name: 'course.pptx' });
  h.flush(); h.current().onload(); h.flush();
  expect(h.states[3]).toBe(false); expect(h.states[4]).toBeNull(); expect(h.save).toHaveBeenCalledTimes(1);
});
test('an error preserves only completed files, never an unfinished result', () => {
  const h = harness(); h.send({ type: 'start', name: 'done.pdf' });
  h.send({ type: 'delta', name: 'done.pdf', text: 'Complete' }); h.send({ type: 'done', name: 'done.pdf' });
  h.send({ type: 'start', name: 'failed.pdf' }); h.send({ type: 'delta', name: 'failed.pdf', text: 'Incomplete' });
  h.send({ type: 'error', message: 'Failure' }); h.flush();
  expect(h.states[0]).toEqual([{ name: 'done.pdf', summary: 'Complete' }]);
  expect(h.states[1]).toEqual({}); expect(h.save).toHaveBeenCalledTimes(1);
});
test('old request callbacks cannot corrupt a restarted generation', () => {
  const h = harness(); const old = h.current();
  h.api.summarize([{ name: 'new.pdf', text: 'new' }]);
  old.onerror(); old.onabort(); old.onload();
  expect(h.states[3]).toBe(true); expect(h.states[4]).toBeNull();
});
test('file_error is visible and no longer leaves its progress active', () => {
  const h = harness(); h.send({ type: 'progress', name: 'course.pptx', message: 'Working' });
  h.send({ type: 'file_error', name: 'course.pptx', message: 'Document vide' }); h.send({ type: 'end' });
  expect(h.states[2]).toEqual({}); expect(h.states[3]).toBe(false); expect(h.states[4]).toBe('Document vide');
});
