const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.disable('x-powered-by');

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const server = http.createServer(app);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://localhost')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed'));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const ROLES = {
  MASTER: 'MASTER',
  SLAVE: 'SLAVE',
};

const isValidRole = (role) => Object.values(ROLES).includes(role);

io.on('connection', (socket) => {
  const forwardedFor = socket.handshake.headers['x-forwarded-for'];
  console.log(
    `[socket] connected id=${socket.id} ip=${socket.handshake.address} forwarded=${forwardedFor || '-'}`
  );

  socket.on('JOIN_MATCH', (payload = {}, ack) => {
    const matchId = String(payload.matchId || '').trim();
    const role = String(payload.role || '').trim().toUpperCase();

    if (!matchId || !isValidRole(role)) {
      const message = 'JOIN_MATCH requires matchId and role MASTER|SLAVE';
      if (typeof ack === 'function') {
        ack({ ok: false, error: message });
      }
      socket.emit('ERROR', { message });
      return;
    }

    socket.data.matchId = matchId;
    socket.data.role = role;
    socket.join(matchId);

    console.log(`[match:${matchId}] joined id=${socket.id} role=${role}`);

    const joinedPayload = { matchId, role, serverTs: Date.now() };
    if (typeof ack === 'function') {
      ack({ ok: true, ...joinedPayload });
    }
    socket.emit('JOINED_MATCH', joinedPayload);
  });

  socket.on('CAPTURE_MOMENT', (payload = {}, ack) => {
    const matchId = socket.data.matchId;
    const role = socket.data.role;

    if (!matchId) {
      const message = 'CAPTURE_MOMENT requires JOIN_MATCH first';
      if (typeof ack === 'function') {
        ack({ ok: false, error: message });
      }
      socket.emit('ERROR', { message });
      return;
    }

    if (role !== ROLES.MASTER) {
      const message = 'Only MASTER can trigger CAPTURE_MOMENT';
      if (typeof ack === 'function') {
        ack({ ok: false, error: message });
      }
      socket.emit('ERROR', { message });
      return;
    }

    const captureId = String(payload.captureId || `cap_${Date.now()}`);
    const serverTs = Date.now();

    const eventPayload = {
      matchId,
      captureId,
      serverTs,
      data: payload.data ?? null,
      from: socket.id,
    };

    socket.to(matchId).emit('CAPTURE_MOMENT', eventPayload);
    console.log(`[match:${matchId}] CAPTURE_MOMENT captureId=${captureId}`);

    if (typeof ack === 'function') {
      ack({ ok: true, captureId, serverTs });
    }
  });

  socket.on('SLAVE_ACK', (payload = {}, ack) => {
    const matchId = socket.data.matchId;
    const role = socket.data.role;

    if (!matchId) {
      const message = 'SLAVE_ACK requires JOIN_MATCH first';
      if (typeof ack === 'function') {
        ack({ ok: false, error: message });
      }
      socket.emit('ERROR', { message });
      return;
    }

    if (role !== ROLES.SLAVE) {
      const message = 'Only SLAVE can send SLAVE_ACK';
      if (typeof ack === 'function') {
        ack({ ok: false, error: message });
      }
      socket.emit('ERROR', { message });
      return;
    }

    const captureId = String(payload.captureId || '');
    const captureServerTs = Number(payload.captureServerTs || payload.serverTs || 0);
    const clientTs = Number(payload.clientTs || 0);
    const serverTs = Date.now();
    const latencyMs = captureServerTs ? serverTs - captureServerTs : null;

    console.log(
      `[match:${matchId}] SLAVE_ACK captureId=${captureId || '-'} slave=${socket.id} latencyMs=${latencyMs}`
    );

    socket.to(matchId).emit('SLAVE_ACK', {
      matchId,
      captureId,
      slaveId: socket.id,
      captureServerTs: captureServerTs || null,
      clientTs: clientTs || null,
      serverTs,
      latencyMs,
    });

    if (typeof ack === 'function') {
      ack({ ok: true, serverTs, latencyMs });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected id=${socket.id} reason=${reason}`);
  });
});

const port = Number(process.env.PORT || 8080);
server.listen(port, '0.0.0.0', () => {
  console.log(`Listening on port ${port}`);
});
