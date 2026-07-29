/* Notification permission, delivery and click safety without a push server. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(HERE, '..', 'web');
const source = fs.readFileSync(path.join(WEB, 'notifications.js'), 'utf8');
const swSource = fs.readFileSync(path.join(WEB, 'sw.js'), 'utf8');
const passed = [], failed = [];
const ok = (condition, message) =>
  (condition ? passed : failed).push((condition ? 'PASS  ' : 'FAIL  ') + message);

function pageContext({
  permission = 'default',
  active = true,
  hidden = true,
  decision = 'granted',
  registration = null,
} = {}) {
  const storage = new Map();
  let permissionRequests = 0;
  const notifications = [];
  const reg = registration || {
    scope: 'https://keepclub.app/',
    async showNotification(title, options) {
      notifications.push({ title, options });
    },
  };
  const Notification = {
    permission,
    async requestPermission() {
      permissionRequests++;
      Notification.permission = decision;
      return decision;
    },
  };
  const context = vm.createContext({
    URL,
    Promise,
    Notification,
    navigator: {
      userActivation: { isActive: active },
      serviceWorker: { async getRegistration() { return reg; } },
    },
    document: { hidden },
    localStorage: {
      getItem: (key) => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
  });
  vm.runInContext(source, context, { filename: 'notifications.js' });
  return {
    api: context.KeepNotifications,
    storage,
    notifications,
    requests: () => permissionRequests,
  };
}

{
  const context = vm.createContext({
    URL,
    Promise,
    navigator: {},
    localStorage: { getItem: () => null, setItem: () => {} },
  });
  vm.runInContext(source, context);
  const state = context.KeepNotifications.status();
  ok(!state.supported && state.permission === 'unsupported' && !state.enabled,
    'unsupported browsers expose a safe, disabled state');
}

{
  const env = pageContext({ active: false });
  const state = await env.api.enable();
  ok(state.reason === 'user-gesture-required' && env.requests() === 0,
    'permission is not requested outside an explicit user gesture');
  ok(!state.preference, 'a failed gesture check does not opt the learner in');
}

{
  const env = pageContext();
  const state = await env.api.enable();
  ok(state.enabled && state.permission === 'granted' && env.requests() === 1,
    'a user-gesture enable grants permission and turns notifications on');
  ok(JSON.parse(env.storage.get(env.api.KEY)).enabled === true
      && env.api.KEY === 'keepclub/notifications/v1',
  'the opt-in uses a new versioned key without touching study progress');
  const off = env.api.disable();
  ok(!off.enabled && !off.preference,
    'notifications can be disabled without revoking browser permission');
}

{
  const env = pageContext({ hidden: false, permission: 'granted' });
  env.storage.set(env.api.KEY, '{"v":1,"enabled":true}');
  const result = await env.api.notifyAchievement({
    id: 'club-streak:30',
    title: '30 days in the club',
    body: 'Membership pays in memories.',
  });
  ok(result.reason === 'foreground' && env.notifications.length === 0,
    'the visible app owns its celebration instead of duplicating a system notification');
}

{
  const env = pageContext({ permission: 'granted' });
  env.storage.set(env.api.KEY, '{"v":1,"enabled":true}');
  const item = {
    id: 'club-streak:30',
    title: '  30   days in the club  ',
    body: '  Membership   pays in memories. ',
    url: 'https://outside.example/steal-progress',
  };
  const first = await env.api.notifyAchievement(item);
  const second = await env.api.notifyAchievement(item);
  const sent = env.notifications[0];
  ok(first.shown && second.reason === 'duplicate' && env.notifications.length === 1,
    'a stable achievement id and tag deduplicate repeated delivery');
  ok(sent.title === '30 days in the club'
      && sent.options.body === 'Membership pays in memories.'
      && sent.options.tag === 'keepclub-achievement-club-streak:30',
  'achievement copy is bounded and delivered with a stable tag');
  ok(sent.options.data.url === 'https://keepclub.app/'
      && sent.options.data.kind === 'achievement'
      && sent.options.icon === 'https://keepclub.app/icon-192.png',
  'notification data rejects cross-origin targets and uses installed app artwork');
}

{
  const env = pageContext({ permission: 'granted' });
  env.storage.set(env.api.KEY, '{"v":1,"enabled":true}');
  const result = await env.api.notifyAchievement({
    id: '../bad id',
    title: 'No',
    body: 'No',
  });
  ok(result.reason === 'invalid' && env.notifications.length === 0,
    'invalid achievement payloads cannot reach the operating system');
}

function workerContext(windows = []) {
  const handlers = {};
  const opened = [];
  const self = {
    registration: { scope: 'https://keepclub.app/' },
    addEventListener(type, handler) { handlers[type] = handler; },
    clients: {
      async matchAll() { return windows; },
      async openWindow(url) { opened.push(url); },
    },
  };
  const context = vm.createContext({
    self,
    location: new URL(self.registration.scope),
    URL,
    console,
    Response,
    Request,
    Set,
    Promise,
  });
  vm.runInContext(swSource, context, { filename: 'sw.js' });
  return { handlers, opened };
}

async function click(handler, data) {
  let work;
  let closed = false;
  handler({
    notification: {
      data,
      close() { closed = true; },
    },
    waitUntil(promise) { work = promise; },
  });
  await work;
  return closed;
}

{
  const app = {
    url: 'https://keepclub.app/?course=one',
    navigated: '',
    focused: false,
    async navigate(url) { this.navigated = url; },
    async focus() { this.focused = true; },
  };
  const worker = workerContext([app]);
  const closed = await click(worker.handlers.notificationclick, {
    url: 'https://outside.example/phish',
  });
  ok(closed && app.navigated === 'https://keepclub.app/' && app.focused,
    'a notification click closes the card and reuses the Keep Club window');
  ok(!app.navigated.includes('outside.example'),
    'the worker never navigates to a cross-origin notification target');
}

{
  const worker = workerContext([]);
  await click(worker.handlers.notificationclick, {
    url: 'https://keepclub.app/?course=day-skipper#progress',
  });
  ok(worker.opened[0] === 'https://keepclub.app/?course=day-skipper#progress',
    'a safe same-origin achievement target opens inside the app scope');
}

ok(swSource.includes("'notifications.js'"),
  'the notification API is part of the offline shell');
ok(swSource.includes("const SHELL_V = 'munin-shell-'")
    && swSource.includes("const courseV = (id) => 'munin-course-'"),
'notification support preserves the installed cache identities');

console.log(passed.concat(failed).join('\n'));
if (failed.length) {
  console.error(`\n${failed.length} failing`);
  process.exit(1);
}
console.log(`\nall ${passed.length} green`);
