const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const applicationId = process.argv[2];
if (!/^\d{17,20}$/.test(applicationId ?? '')) {
  console.error('Usage: node bridge.cjs <Discord Application ID>');
  process.exit(1);
}

const windows = process.platform === 'win32';
const appDataDirectory = windows
  ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
  : path.join(os.homedir(), 'Library', 'Application Support');
const stateDirectory = path.join(appDataDirectory, 'BetterDiscord', 'lastfm-rpc');
const socketDirectory = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR ||
  process.env.TMP || process.env.TEMP || '/tmp';
fs.mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
const stateFile = path.join(stateDirectory, 'activity.json');
let socket, ready, pending, acknowledged, buffer;
let nextSocket = 0;

function writeFrame(opcode, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  const header = Buffer.alloc(8);
  header.writeUInt32LE(opcode);
  header.writeUInt32LE(body.length, 4);
  socket.write(Buffer.concat([header, body]));
}

function connect() {
  const socketName = 'discord-ipc-' + nextSocket;
  const endpoint = windows
    ? `\\\\?\\pipe\\${socketName}`
    : path.join(socketDirectory, socketName);
  nextSocket = (nextSocket + 1) % 10;
  const connection = net.createConnection(endpoint);
  socket = connection;
  buffer = Buffer.alloc(0);
  connection.on('connect', () => writeFrame(0, { v: 1, client_id: applicationId }));
  connection.setTimeout(5000, () => connection.destroy());
  connection.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 8 && buffer.length >= 8 + buffer.readUInt32LE(4)) {
      const opcode = buffer.readUInt32LE(0);
      const length = buffer.readUInt32LE(4);
      let response;
      try {
        response = JSON.parse(buffer.subarray(8, 8 + length));
      } catch {
        connection.destroy();
        return;
      }
      buffer = buffer.subarray(8 + length);
      if (opcode === 3) {
        writeFrame(4, response);
      } else if (opcode === 2) {
        connection.destroy();
        return;
      } else if (response.evt === 'READY') {
        ready = true;
        connection.setTimeout(0);
        tick();
      } else if (pending && response.nonce === pending.nonce) {
        if (response.evt === 'ERROR') {
          console.error('SET_ACTIVITY rejected', response.data?.code, response.data?.message);
        } else {
          console.log('SET_ACTIVITY accepted', pending.key !== 'null' ? 'track' : 'clear',
            response.data?.assets?.large_image ? 'with artwork' : 'without artwork',
            'type=' + (response.data?.type ?? 'none'));
        }
        acknowledged = pending.key;
        pending = undefined;
      }
    }
  });
  connection.on('error', () => connection.destroy());
  connection.on('close', () => {
    socket = undefined;
    ready = false;
    pending = undefined;
    acknowledged = undefined;
  });
}

function tick() {
  let activity = null;
  try {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (Date.now() - state.updatedAt < 65000) activity = state.activity;
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Cannot read activity', error.code ?? error.name);
  }
  if (!socket && activity) connect();
  if (!ready) return;
  if (pending) {
    if (Date.now() - pending.sentAt > 5000) socket.destroy();
    return;
  }
  const key = JSON.stringify(activity);
  if (key === acknowledged || (activity === null && acknowledged === undefined)) return;
  pending = { key, nonce: randomUUID(), sentAt: Date.now() };
  writeFrame(1, { cmd: 'SET_ACTIVITY', nonce: pending.nonce, args: { pid: process.pid, activity } });
}

tick();
setInterval(tick, 1000);
