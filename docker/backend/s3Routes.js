const express = require('express');
const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const router = express.Router();

const S3_BUCKET = process.env.S3_BUCKET || 's3-crif-studio-wwcc1mnt-de-prd-stg';
const S3_PREFIX = process.env.S3_PREFIX || 'TEST_SUITE/';

function getS3Client() {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.');
  }

  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// List folders and files at a given path
router.get('/list', async (req, res) => {
  const relPath = req.query.path || '';
  const rawPrefix = S3_PREFIX + relPath;
  const prefix = rawPrefix.endsWith('/') || rawPrefix === S3_PREFIX ? rawPrefix : rawPrefix + '/';

  try {
    const client = getS3Client();
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
      Delimiter: '/',
    });

    const result = await client.send(command);

    const folders = (result.CommonPrefixes || []).map((cp) => {
      const full = cp.Prefix || '';
      const name = full.replace(prefix, '').replace(/\/$/, '');
      const rel = full.replace(S3_PREFIX, '');
      return { name, prefix: rel };
    });

    const files = (result.Contents || [])
      .filter((obj) => {
        const key = obj.Key || '';
        return key !== prefix && !key.endsWith('.gitkeep');
      })
      .map((obj) => {
        const key = obj.Key || '';
        const relKey = key.replace(S3_PREFIX, '');
        const name = key.split('/').pop() || '';
        return {
          name,
          key: relKey,
          size: obj.Size || 0,
          lastModified: obj.LastModified?.toISOString() || '',
        };
      });

    res.json({ folders, files });
  } catch (err) {
    console.error('[s3/list] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get presigned download URL
router.get('/download', async (req, res) => {
  const relPath = req.query.path || '';
  if (!relPath) {
    return res.status(400).json({ error: 'Missing path' });
  }

  try {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: S3_PREFIX + relPath,
    });

    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 900 });
    res.json({ url: presignedUrl });
  } catch (err) {
    console.error('[s3/download] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Direct content download (for report parsing)
router.get('/download-content', async (req, res) => {
  const relPath = req.query.path || '';
  if (!relPath) {
    return res.status(400).json({ error: 'Missing path' });
  }

  try {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: S3_PREFIX + relPath,
    });

    const result = await client.send(command);
    const chunks = [];
    for await (const chunk of result.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    res.set({
      'Content-Type': result.ContentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${relPath.split('/').pop()}"`,
    });
    res.send(buffer);
  } catch (err) {
    console.error('[s3/download-content] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Upload file to S3
router.post('/upload', express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  const relPath = req.query.path || '';
  if (!relPath) {
    return res.status(400).json({ error: 'Missing path' });
  }

  try {
    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: S3_PREFIX + relPath,
      Body: req.body,
      ContentType: req.headers['content-type'] || 'application/octet-stream',
    });

    await client.send(command);
    res.json({ ok: true, key: S3_PREFIX + relPath });
  } catch (err) {
    console.error('[s3/upload] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
