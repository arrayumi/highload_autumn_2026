// server.js
const express = require('express');
const client = require('prom-client');

const app = express();

app.use((req, res, next) => {
  if (req.query.forceError === '500') {
    return res.status(500).json({ error: 'Artificial server error' });
  }
  next();
});

app.use(express.json());

const register = client.register;
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'endpoint', 'status_code'],
});

app.use((req, res, next) => {
  const method = req.method;
  const endpoint = req.path.split('/')[1] ? `/${req.path.split('/')[1]}` : '/';
  res.on('finish', () => {
    const statusCode = String(res.statusCode);
    httpRequestsTotal.labels(method, endpoint, statusCode).inc();
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

const store = new Map();
let nextId = 1;

function generateId() {
  return nextId++;
}

app.get('/items', (req, res) => {
  const items = Array.from(store.values());
  res.json(items);
});

app.post('/items', (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Field "name" is required' });
  }
  const id = generateId();
  const item = {
    id,
    name,
    description: description ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.set(id, item);
  res.status(201).json(item);
});

app.get('/items/:id', (req, res) => {
  const id = Number(req.params.id);
  const item = store.get(id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.json(item);
});

app.delete('/items/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!store.has(id)) {
    return res.status(404).json({ error: 'Item not found' });
  }
  store.delete(id);
  res.status(204).send();
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
