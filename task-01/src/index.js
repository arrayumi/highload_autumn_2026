const express = require('express');
const { requestLatencyHistogram, requestTotalCounter, httpErrorsCounter, metricsEndpoint } = require('./metrics');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// In-memory хранилище
const store = new Map();
let nextId = 1;
function generateId() { return String(nextId++); }

// Middleware для сбора метрик (только для бизнес-ручек)
function metricsMiddleware(req, res, next) {
  const start = Date.now();
  const route = req.path; // например, /items или /items/:id
  const method = req.method;

  // Сохраняем оригинальные методы send/json/status, чтобы корректно считать код ответа
  const originalSend = res.send;
  const originalJson = res.json;
  const originalStatus = res.status;

  let statusCode = 200;

  res.status = (code) => {
    statusCode = code;
    return originalStatus.call(res, code);
  };

  res.send = (body) => {
    recordMetrics(method, route, statusCode, start);
    return originalSend.call(res, body);
  };

  res.json = (body) => {
    recordMetrics(method, route, statusCode, start);
    return originalJson.call(res, body);
  };

  next();
}

function recordMetrics(method, route, code, start) {
  const durationSeconds = (Date.now() - start) / 1000;

  // Считаем все запросы (для RPS)
  requestTotalCounter.inc({ method, route, code });

  // Если ошибка (4xx или 5xx), отдельно считаем в http_errors_total
  if (code >= 400) {
    httpErrorsCounter.inc({ method, route, code });
  }

  // Гистограмма latency для всех запросов (и успешных, и ошибочных)
  requestLatencyHistogram.observe(durationSeconds, { method, route, code });
}

// Health check — без метрик (по требованию)
app.get('/health', (req, res) => {
  console.log('>>> Health called');
  res.json({ status: 'ok', service: 'crud-service' });
});

// Prometheus metrics endpoint — тоже без бизнес-метрик
app.get('/metrics', metricsEndpoint);

// Все остальные ручки — с метриками
app.use(metricsMiddleware);

// POST /items
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
    updatedAt: new Date().toISOString()
  };
  store.set(id, item);
  res.status(201).json(item);
});

// GET /items/:id
app.get('/items/:id', (req, res) => {
  const item = store.get(req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.json(item);
});

// PUT /items/:id
app.put('/items/:id', (req, res) => {
  const existing = store.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const { name, description } = req.body;
  if (name === undefined && description === undefined) {
    return res.json(existing);
  }

  const updated = {
    ...existing,
    name: name !== undefined ? name : existing.name,
    description: description !== undefined ? description : existing.description,
    updatedAt: new Date().toISOString()
  };

  store.set(req.params.id, updated);
  res.json(updated);
});

app.listen(PORT, () => {
  console.log(`Service running on port ${PORT}`);
});
