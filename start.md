# Local Start Guide (Windows 11 + Docker)

This guide shows how to run the project locally with HTTPS + WSS using Docker.

## 0) Prerequisites
- Docker Desktop is running (open the app and wait for "Engine running")
  - Quick check: `docker info` should work without errors.
  - If you see a `dockerDesktopLinuxEngine` error later, the engine isn't running yet.
- Node.js 18+ and Git are installed

## 1) Clone the repo
```powershell
git clone https://github.com/aggregat/nginx-ssl-nodejs-express-socketio websocket-server-setup
cd websocket-server-setup
```

## 2) Install Node dependencies (optional)
This is optional for Docker runs, but keeps `package-lock.json` up to date.
```powershell
cd nodejs_websocket_server
npm install
cd ..
```

## 3) Generate self-signed SSL certs (local only)
```powershell
New-Item -ItemType Directory -Force certs | Out-Null
docker run --rm -v "${PWD}/certs:/certs" alpine:3.19 sh -c "apk add --no-cache openssl >/dev/null && openssl req -x509 -nodes -newkey rsa:2048 -days 365 -keyout /certs/localhost.key -out /certs/localhost.crt -subj '/CN=localhost'"
```

## 4) Build images
```powershell
docker compose build
```

## 5) Start containers
```powershell
docker compose up -d
```
Optional quick check:
```powershell
docker compose ps
```

## 6) Accept the SSL cert in the browser
1. Open `https://localhost/health`.
2. If a warning appears:
   - Chrome/Edge: click "Advanced" -> "Proceed to localhost (unsafe)".
3. You should see: `{ "status": "ok" }`.

## 7) WebSocket testing (browser tabs)
### 7.1) Open 3 tabs
Tab 1 = MASTER, Tab 2 = SLAVE, Tab 3 = optional SLAVE.

### 7.2) Load socket.io client in each tab
Open DevTools console and run:
```js
const s = document.createElement('script');
s.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
s.onload = () => console.log('socket.io loaded');
document.head.appendChild(s);
```

### 7.3) Tab 1 (MASTER) join
```js
const socket = io('wss://localhost', { transports: ['websocket'] });
socket.on('connect', () => console.log('MASTER connected', socket.id));
socket.on('JOINED_MATCH', (data) => console.log('JOINED_MATCH', data));
socket.on('SLAVE_ACK', (data) => console.log('SLAVE_ACK', data));
socket.on('ERROR', (err) => console.warn('ERROR', err));
socket.emit('JOIN_MATCH', { matchId: 'match-1', role: 'MASTER' }, console.log);
```

### 7.4) Tab 2 (SLAVE) join + ACK logic
```js
const socket = io('wss://localhost', { transports: ['websocket'] });
socket.on('connect', () => console.log('SLAVE connected', socket.id));
socket.on('JOINED_MATCH', (data) => console.log('JOINED_MATCH', data));
socket.on('CAPTURE_MOMENT', (payload) => {
  console.log('CAPTURE_MOMENT', payload);
  const clientTs = Date.now();
  socket.emit('SLAVE_ACK', { captureId: payload.captureId, captureServerTs: payload.serverTs, clientTs }, console.log);
});
socket.on('ERROR', (err) => console.warn('ERROR', err));
socket.emit('JOIN_MATCH', { matchId: 'match-1', role: 'SLAVE' }, console.log);
```

### 7.5) Tab 3 (optional SLAVE)
Use the same code as Tab 2.

## 8) MASTER sends a capture event
In Tab 1 console:
```js
const captureId = `cap-${Date.now()}`;
socket.emit('CAPTURE_MOMENT', { captureId, data: { note: 'test' } }, console.log);
```
Expected:
- SLAVE tabs log `CAPTURE_MOMENT`
- MASTER tab logs `SLAVE_ACK` with `latencyMs`

## 9) View server logs (optional)
```powershell
docker compose logs -f nodejs_server
```

## 10) Stop containers
```powershell
docker compose down
```

## Troubleshooting
- Docker engine not reachable:
  - Error: `error during connect: ... dockerDesktopLinuxEngine`
  - Fix: start Docker Desktop, wait for "Engine running", then retry `docker compose up -d`.
- `nodejs_server` unhealthy:
  - Check logs: `docker compose logs -f nodejs_server`
  - Make sure the `/health` endpoint is reachable: `https://localhost/health`.
