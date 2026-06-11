import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { Vessel } from '../types';

const router = Router();

const vesselSchema = z.object({
  name: z.string().min(1, '船名不能为空'),
  imo_number: z.string().optional().nullable(),
  max_weight: z.number().positive('最大载重必须大于0'),
  max_volume: z.number().optional().nullable(),
  draft: z.number().optional().nullable(),
  route: z.string().optional().nullable(),
  capacity_20ft: z.number().int().optional().nullable(),
  capacity_40ft: z.number().int().optional().nullable(),
  status: z.enum(['active', 'maintenance', 'inactive']).default('active'),
});

router.get('/', (_req: Request, res: Response) => {
  try {
    const vessels = db.prepare('SELECT * FROM vessels ORDER BY created_at DESC').all() as Vessel[];
    res.json({ success: true, data: vessels });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/active', (_req: Request, res: Response) => {
  try {
    const vessels = db.prepare("SELECT * FROM vessels WHERE status = 'active' ORDER BY name").all() as Vessel[];
    res.json({ success: true, data: vessels });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const vessel = db.prepare('SELECT * FROM vessels WHERE id = ?').get(req.params.id) as Vessel;
    if (!vessel) return res.status(404).json({ success: false, error: '船只不存在' });
    res.json({ success: true, data: vessel });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const validated = vesselSchema.parse(req.body);
    const info = db.prepare(`
      INSERT INTO vessels (name, imo_number, max_weight, max_volume, draft, route, capacity_20ft, capacity_40ft, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      validated.name, validated.imo_number ?? null, validated.max_weight,
      validated.max_volume ?? null, validated.draft ?? null, validated.route ?? null,
      validated.capacity_20ft ?? null, validated.capacity_40ft ?? null, validated.status
    );
    const vessel = db.prepare('SELECT * FROM vessels WHERE id = ?').get(info.lastInsertRowid) as Vessel;
    res.json({ success: true, data: vessel, message: '船只添加成功' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: '验证失败', details: error.errors });
    }
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ success: false, error: '船名已存在' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM vessels WHERE id = ?').get(req.params.id) as Vessel;
    if (!existing) return res.status(404).json({ success: false, error: '船只不存在' });
    const validated = vesselSchema.partial().parse(req.body);
    db.prepare(`
      UPDATE vessels SET
        name = COALESCE(?, name),
        imo_number = COALESCE(?, imo_number),
        max_weight = COALESCE(?, max_weight),
        max_volume = COALESCE(?, max_volume),
        draft = COALESCE(?, draft),
        route = COALESCE(?, route),
        capacity_20ft = COALESCE(?, capacity_20ft),
        capacity_40ft = COALESCE(?, capacity_40ft),
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(
      validated.name ?? null, validated.imo_number ?? null, validated.max_weight ?? null,
      validated.max_volume ?? null, validated.draft ?? null, validated.route ?? null,
      validated.capacity_20ft ?? null, validated.capacity_40ft ?? null, validated.status ?? null,
      req.params.id
    );
    const vessel = db.prepare('SELECT * FROM vessels WHERE id = ?').get(req.params.id) as Vessel;
    res.json({ success: true, data: vessel, message: '船只更新成功' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: '验证失败', details: error.errors });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM vessels WHERE id = ?').get(req.params.id) as Vessel;
    if (!existing) return res.status(404).json({ success: false, error: '船只不存在' });
    const used = db.prepare('SELECT COUNT(*) as count FROM stowage_plans WHERE vessel_id = ?').get(req.params.id) as { count: number };
    if (used.count > 0) {
      return res.status(400).json({ success: false, error: `该船只已被 ${used.count} 个配载计划使用，无法删除` });
    }
    db.prepare('DELETE FROM vessels WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '船只删除成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
