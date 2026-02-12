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
  
  data[table][index] = {
    ...data[table][index],
    ...req.body,
    updated_at: new Date().toISOString()
  };
  
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
  
  data[table][index] = {
    ...data[table][index],
    ...req.body,
    updated_at: new Date().toISOString()
  };
  
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

// Special endpoint for password validation
app.post('/api/validate-password', (req, res) => {
  const { password } = req.body;
  const data = readData();
  
  const config = data.app_config.find(c => c.key === 'shared_password');
  if (!config) {
    // If no password set, accept any password and set it
    data.app_config.push({ key: 'shared_password', value: password });
    writeData(data);
    return res.json({ valid: true });
  }
  
  res.json({ valid: config.value === password });
});

// ===== Test Suite: Network Share Browsing =====
const TESTSUITE_ROOT = process.env.TESTSUITE_ROOT || String.raw`\\sassrv04\DA_WWCC1\1_Global_Analytics_Consultancy\R1_2\PRODUCT\CE\01_Data\TEST_SUITE`;
const CONFIG_DIR = process.env.TESTSUITE_CONFIG_DIR || path.join(__dirname, 'configs');

// Ensure config dir exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// List directories and files under a relative path in the network share
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

// Save test config JSON locally
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

// Check output folder for results
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

// Download a file from the network share
app.get('/api/testsuite/download', (req, res) => {
  const relPath = req.query.path || '';
  const fullPath = path.join(TESTSUITE_ROOT, relPath);

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(fullPath);
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
