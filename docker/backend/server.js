const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_PATH = process.env.DATA_PATH || './data/data.json';

app.use(cors());
app.use(express.json());

// Initialize data file if it doesn't exist
const initializeData = () => {
  const defaultData = {
    projects: [],
    releases: [],
    release_models: [],
    app_config: []
  };
  
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(defaultData, null, 2));
    console.log('Created new data file at:', DATA_PATH);
  }
};

const readData = () => {
  try {
    const data = fs.readFileSync(DATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data:', error);
    return { projects: [], releases: [], release_models: [], app_config: [] };
  }
};

const writeData = (data) => {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data:', error);
    return false;
  }
};

// ===== S3 proxy routes =====
const s3Routes = require('./s3Routes');
app.use('/api/s3', s3Routes);

// ===== Test Suite routes (MUST be before generic /api/:table) =====
const TESTSUITE_ROOT = process.env.TESTSUITE_ROOT || path.join(__dirname, '..', '..', 'data', 'TEST_SUITE');
const CONFIG_DIR = process.env.TESTSUITE_CONFIG_DIR || path.join(__dirname, 'configs');

console.log(`[startup] TESTSUITE_ROOT = ${TESTSUITE_ROOT}`);
console.log(`[startup] TESTSUITE_ROOT exists = ${fs.existsSync(TESTSUITE_ROOT)}`);
if (fs.existsSync(TESTSUITE_ROOT)) {
  const topLevel = fs.readdirSync(TESTSUITE_ROOT);
  console.log(`[startup] TEST_SUITE contents: ${topLevel.join(', ')}`);
}

if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Health check for testsuite
app.get('/api/testsuite/health', (req, res) => {
  const exists = fs.existsSync(TESTSUITE_ROOT);
  let contents = [];
  if (exists) {
    try { contents = fs.readdirSync(TESTSUITE_ROOT); } catch (e) {}
  }
  res.json({ testsuite_root: TESTSUITE_ROOT, exists, contents, config_dir: CONFIG_DIR });
});

// List directories and files
app.get('/api/testsuite/list', (req, res) => {
  const relPath = req.query.path || '';
  const fullPath = path.join(TESTSUITE_ROOT, relPath);
  console.log(`[testsuite/list] path=${relPath} -> ${fullPath}`);

  try {
    if (!fs.existsSync(fullPath)) {
      return res.json({ folders: [], files: [] });
    }
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const folders = entries
      .filter(e => e.isDirectory())
      .map(e => ({ name: e.name, prefix: path.join(relPath, e.name).replace(/\\/g, '/') + '/' }));
    const files = entries
      .filter(e => e.isFile())
      .map(e => {
        const filePath = path.join(fullPath, e.name);
        const stats = fs.statSync(filePath);
        return {
          name: e.name,
          key: path.join(relPath, e.name).replace(/\\/g, '/'),
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
        };
      });
    res.json({ folders, files });
  } catch (err) {
    console.error('[testsuite/list] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Save test config JSON
app.post('/api/testsuite/config', (req, res) => {
  const { filename, config } = req.body;
  if (!filename || !config) {
    return res.status(400).json({ error: 'Missing filename or config' });
  }
  const configPath = path.join(CONFIG_DIR, filename);
  console.log(`[testsuite/config] Saving config: ${configPath}`);
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    res.json({ ok: true, path: configPath });
  } catch (err) {
    console.error('[testsuite/config] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Run tests: spawn handler.py locally with config
app.post('/api/testsuite/run', (req, res) => {
  const { config } = req.body;
  if (!config) {
    return res.status(400).json({ error: 'Missing config' });
  }

  const cePath = config.ce_python_path;
  if (!cePath) {
    return res.status(400).json({ error: 'Missing ce_python_path in config' });
  }

  // Save config to temp file
  const configPath = path.join(CONFIG_DIR, `run_${Date.now()}.json`);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`[testsuite/run] Config saved: ${configPath}`);

  // Determine handler.py location (lambda/ folder at project root)
  const projectRoot = process.env.PROJECT_ROOT || path.join(__dirname, '..', '..');
  const handlerPath = path.join(projectRoot, 'lambda', 'handler.py');

  if (!fs.existsSync(handlerPath)) {
    return res.status(500).json({ error: `handler.py not found at ${handlerPath}` });
  }

  // Build PYTHONPATH to include CategorizationEnginePython and CETestSuite
  const pythonPath = [
    cePath,
    path.join(cePath, 'CategorizationEngineTests', 'CETestSuite'),
  ].join(process.platform === 'win32' ? ';' : ':');

  console.log(`[testsuite/run] Spawning python handler.py with PYTHONPATH=${pythonPath}`);

  const { spawn } = require('child_process');
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const proc = spawn(pythonCmd, [handlerPath, '--config', configPath], {
    env: { ...process.env, PYTHONPATH: pythonPath },
    cwd: projectRoot,
  });

  // Immediately respond that the process started
  res.json({ ok: true, pid: proc.pid, configPath });

  // Log stdout/stderr
  proc.stdout.on('data', (data) => {
    console.log(`[testsuite/run:stdout] ${data.toString().trim()}`);
  });
  proc.stderr.on('data', (data) => {
    console.error(`[testsuite/run:stderr] ${data.toString().trim()}`);
  });
  proc.on('close', (code) => {
    console.log(`[testsuite/run] Process exited with code ${code}`);
    // Clean up config file
    try { fs.unlinkSync(configPath); } catch {}
  });
});

// List saved configs
app.get('/api/testsuite/configs', (req, res) => {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      return res.json({ configs: [] });
    }
    const files = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith('.json'));
    res.json({ configs: files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check output folder
app.get('/api/testsuite/output', (req, res) => {
  const relPath = req.query.path || '';
  const fullPath = path.join(TESTSUITE_ROOT, relPath);
  try {
    if (!fs.existsSync(fullPath)) {
      return res.json({ files: [] });
    }
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const files = entries.filter(e => e.isFile()).map(e => {
      const filePath = path.join(fullPath, e.name);
      const stats = fs.statSync(filePath);
      return {
        name: e.name,
        key: path.join(relPath, e.name).replace(/\\/g, '/'),
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
      };
    });
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download a file
app.get('/api/testsuite/download', (req, res) => {
  const relPath = req.query.path || '';
  const fullPath = path.join(TESTSUITE_ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.download(fullPath);
});

// Special endpoint for password validation
app.post('/api/validate-password', (req, res) => {
  const { password } = req.body;
  const data = readData();
  const config = data.app_config.find(c => c.key === 'shared_password');
  if (!config) {
    data.app_config.push({ key: 'shared_password', value: password });
    writeData(data);
    return res.json({ valid: true });
  }
  res.json({ valid: config.value === password });
});

// ===== Generic CRUD routes (AFTER specific routes) =====

// GET all data from a table
app.get('/api/:table', (req, res) => {
  const { table } = req.params;
  const data = readData();
  if (!data[table]) {
    return res.status(404).json({ error: `Table ${table} not found` });
  }
  res.json(data[table]);
});

// GET single item by id
app.get('/api/:table/:id', (req, res) => {
  const { table, id } = req.params;
  const data = readData();
  if (!data[table]) {
    return res.status(404).json({ error: `Table ${table} not found` });
  }
  const item = data[table].find(item => item.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.json(item);
});

// POST - Create new item
app.post('/api/:table', (req, res) => {
  const { table } = req.params;
  const data = readData();
  if (!data[table]) {
    return res.status(404).json({ error: `Table ${table} not found` });
  }
  const newItem = {
    ...req.body,
    id: req.body.id || crypto.randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  data[table].push(newItem);
  if (writeData(data)) {
    res.status(201).json(newItem);
  } else {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// PUT - Update item
app.put('/api/:table/:id', (req, res) => {
  const { table, id } = req.params;
  const data = readData();
  if (!data[table]) {
    return res.status(404).json({ error: `Table ${table} not found` });
  }
  const index = data[table].findIndex(item => item.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  data[table][index] = { ...data[table][index], ...req.body, updated_at: new Date().toISOString() };
  if (writeData(data)) {
    res.json(data[table][index]);
  } else {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// PATCH - Partial update
app.patch('/api/:table/:id', (req, res) => {
  const { table, id } = req.params;
  const data = readData();
  if (!data[table]) {
    return res.status(404).json({ error: `Table ${table} not found` });
  }
  const index = data[table].findIndex(item => item.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  data[table][index] = { ...data[table][index], ...req.body, updated_at: new Date().toISOString() };
  if (writeData(data)) {
    res.json(data[table][index]);
  } else {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// DELETE - Remove item
app.delete('/api/:table/:id', (req, res) => {
  const { table, id } = req.params;
  const data = readData();
  if (!data[table]) {
    return res.status(404).json({ error: `Table ${table} not found` });
  }
  const index = data[table].findIndex(item => item.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  data[table].splice(index, 1);
  if (writeData(data)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', dataPath: DATA_PATH, testsuiteRoot: TESTSUITE_ROOT });
});

initializeData();

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Data file location: ${path.resolve(DATA_PATH)}`);
  console.log(`TestSuite root: ${TESTSUITE_ROOT}`);
});
