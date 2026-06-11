import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { initDatabase } from './db';
import vesselsRouter from './routes/vessels';
import ordersRouter from './routes/orders';
import configRouter from './routes/config';
import stowageRouter from './routes/stowage';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/vessels', vesselsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/config', configRouter);
app.use('/api/stowage', stowageRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), app: '近海小船船期配载系统 API' });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, error: 'API 端点不存在' });
});

const frontendDist = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err);
  res.status(500).json({ success: false, error: '服务器内部错误', message: err.message });
});

function bootstrap() {
  try {
    initDatabase();
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log('  🚢  近海小船船期配载系统 API Server');
      console.log(`  📍  服务地址: http://localhost:${PORT}`);
      console.log(`  🔍  健康检查: http://localhost:${PORT}/api/health`);
      console.log(`  📚  API 前缀: /api/*`);
      console.log('='.repeat(60) + '\n');
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

bootstrap();
