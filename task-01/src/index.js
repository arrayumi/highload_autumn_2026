const express = require("express");
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// In-memory storage (canonical CRUD store)
const store = new Map(); // key: id (string), value: item object
let nextId = 1;

// Helper to generate ID
function generateId() {
  const id = String(nextId++);
  return id;
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "task-01" });
});

// POST /items — создать запись
app.post("/items", (req, res) => {
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

  // Вернём 201 Created и сам объект
  res.status(201).json(item);
});

// GET /items/{id} — получить запись
app.get("/items/:id", (req, res) => {
  const { id } = req.params;
  const item = store.get(id);

  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  res.json(item);
});

// PUT /items/{id} — обновить запись
app.put("/items/:id", (req, res) => {
  const { id } = req.params;
  const existing = store.get(id);

  if (!existing) {
    return res.status(404).json({ error: "Item not found" });
  }

  const { name, description } = req.body;

  if (name === undefined && description === undefined) {
    // Если не передали ни name, ни description — можно считать пустым обновлением
    // По желанию можно вернуть 400, если хочешь требовать хотя бы одно поле.
    // Здесь просто возвращаем текущий объект без изменений.
    return res.json(existing);
  }

  const updated = {
    ...existing,
    name: name !== undefined ? name : existing.name,
    description: description !== undefined ? description : existing.description,
    updatedAt: new Date().toISOString(),
  };

  store.set(id, updated);
  res.json(updated);
});

// Handle 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`Service running on port ${PORT}`);
});
