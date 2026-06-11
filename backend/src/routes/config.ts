import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { DangerousGoodsRule, TideWindow } from '../types';

const router = Router();

const ruleSchema = z.object({
  category_a: z.string().min(1, '类别A不能为空'),
  category_b: z.string().min(1, '类别B不能为空'),
  conflict_level: z.enum(['critical', 'high', 'medium', 'low']),
  rule_description: z.string().min(1, '规则描述不能为空'),
});

router.get('/dangerous-rules', (_req: Request, res: Response) => {
  try {
    const rules = db.prepare('SELECT * FROM dangerous_goods_rules ORDER BY conflict_level, category_a').all() as DangerousGoodsRule[];
    res.json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/dangerous-rules', (req: Request, res: Response) => {
  try {
    const v = ruleSchema.parse(req.body);
    const info = db.prepare(`
      INSERT INTO dangerous_goods_rules (category_a, category_b, conflict_level, rule_description)
      VALUES (?, ?, ?, ?)
    `).run(v.category_a, v.category_b, v.conflict_level, v.rule_description);
    const rule = db.prepare('SELECT * FROM dangerous_goods_rules WHERE id = ?').get(info.lastInsertRowid) as DangerousGoodsRule;
    res.json({ success: true, data: rule, message: '危险品冲突规则添加成功' });
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, error: '验证失败', details: error.errors });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/dangerous-rules/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM dangerous_goods_rules WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '规则不存在' });
    db.prepare('DELETE FROM dangerous_goods_rules WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '规则删除成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const tideSchema = z.object({
  port_name: z.string().min(1, '港口名称不能为空'),
  date: z.string().min(1, '日期不能为空'),
  high_tide_start: z.string().min(1, '高潮开始时间不能为空'),
  high_tide_end: z.string().min(1, '高潮结束时间不能为空'),
  max_draft: z.number().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.get('/tide-windows', (req: Request, res: Response) => {
  try {
    const { port, date } = req.query as Record<string, string>;
    let sql = 'SELECT * FROM tide_windows WHERE 1=1';
    const params: any[] = [];
    if (port) { sql += ' AND port_name = ?'; params.push(port); }
    if (date) { sql += ' AND date = ?'; params.push(date); }
    sql += ' ORDER BY date, high_tide_start';
    const tides = db.prepare(sql).all(...params) as TideWindow[];
    res.json({ success: true, data: tides });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/tide-windows/available', (req: Request, res: Response) => {
  try {
    const { port } = req.query as Record<string, string>;
    const today = new Date('2026-06-11').toISOString().split('T')[0];
    let sql = `SELECT * FROM tide_windows WHERE date >= ?`;
    const params: any[] = [today];
    if (port) { sql += ' AND port_name = ?'; params.push(port); }
    sql += ' ORDER BY date, high_tide_start LIMIT 100';
    const tides = db.prepare(sql).all(...params) as TideWindow[];
    res.json({ success: true, data: tides });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/tide-windows/:id', (req: Request, res: Response) => {
  try {
    const tide = db.prepare('SELECT * FROM tide_windows WHERE id = ?').get(req.params.id) as TideWindow;
    if (!tide) return res.status(404).json({ success: false, error: '潮汐窗口不存在' });
    res.json({ success: true, data: tide });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/tide-windows', (req: Request, res: Response) => {
  try {
    const v = tideSchema.parse(req.body);
    const info = db.prepare(`
      INSERT INTO tide_windows (port_name, date, high_tide_start, high_tide_end, max_draft, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(v.port_name, v.date, v.high_tide_start, v.high_tide_end, v.max_draft ?? null, v.notes ?? null);
    const tide = db.prepare('SELECT * FROM tide_windows WHERE id = ?').get(info.lastInsertRowid) as TideWindow;
    res.json({ success: true, data: tide, message: '潮汐窗口添加成功' });
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, error: '验证失败', details: error.errors });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/tide-windows/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM tide_windows WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: '潮汐窗口不存在' });
    db.prepare('DELETE FROM tide_windows WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '潮汐窗口删除成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
