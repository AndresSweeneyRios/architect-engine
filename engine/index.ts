import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import mime from 'mime';
import zlib from 'zlib';

const app = express();
const port = 8888;

const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, '../dist');

app.use(
  express.json({
    limit: '1000mb',
  })
);

app.use(cors());

interface Body {
  typescript: string;
  json: string;
}

app.use((req: Request, res: Response, next: NextFunction) => {
  let url = req.url || '';

  if (url.endsWith('/')) {
    url += 'index.html';
  }

  const acceptEncoding = req.headers['accept-encoding'] || '';
  const originalPath = path.join(distPath, url || '');
  const brotliPath = url.endsWith('.br') ? originalPath : `${originalPath}.br`;

  if (acceptEncoding.includes('br') && fs.existsSync(brotliPath)) {
    res.setHeader('Content-Encoding', 'br');
    const mimeType = mime.lookup(url || '');
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.sendFile(brotliPath);
  } else {
    next();
  }
});

app.use(express.static(distPath));

app.post<undefined, string, Body>('/update-animations', (req, res) => {
  try {
    console.log('Updating animations...');

    const animationsIndexPath = path.join(__dirname, '../src/assets/animations/index.ts');
    const animationsJsonPath = path.join(__dirname, '../public/3d/animations/animations.json.br');
    console.log(animationsIndexPath, animationsJsonPath);

    fs.writeFileSync(animationsIndexPath, req.body.typescript);

    const buffer = Buffer.from(req.body.json, 'utf8');
    const compressedData = zlib.brotliCompressSync(buffer, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      },
    });

    fs.writeFileSync(animationsJsonPath, compressedData);

    console.log('Animations updated successfully!');
    res.status(200).send('{}');
  } catch (error) {
    console.error('Error updating animations:', error);
    res.status(500).send(JSON.stringify(error));
  }
});

app.use((req: Request, res: Response) => {
  res.status(404).send('File not found');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
