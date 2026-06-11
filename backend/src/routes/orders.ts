import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { CargoOrder } from '../types';

const router = Router();

const orderSchema = z.object({
  customer_name: z.string().min(1, '货主名称不能为空'),
  customer_contact: z.string().optional().nullable(),
  cargo_name: z.string().min(1, '货物名称不能为空'),
  cargo_type: z.string().optional().nullable(),
  weight: z.number().positive('货物重量必须大于0'),
  volume: z.number().optional().nullable(),
  container_type: z.string().optional().nullable(),
  container_count: z.number().int().default(0),
  is_dangerous: z.number().int().min(0).max(1).default(0),
  dangerous_category: z.string().optional().nullable(),
  un_number: z.string().optional().nullable(),
  origin_port: z.string().min(1, '起始港口不能为空'),
  destination_port: z.string().min(1, '目的港口不能为空'),
  delivery_deadline: z.string().optional().nullable(),
  special_requirements: z.string().optional().nullable(),
  status: z.enum(['pending', 'stowed', 'shipped', 'delivered', 'cancelled']).default('pending'),
});

router.get('/', (req: Request, res: Response) => {
  try {
    const { status, port, search, dangerous } = req.query as Record<string, string>;
    let sql = 'SELECT * FROM cargo_orders WHERE 1=1';
    const params: any[] = [];
    if (status && status !== 'all') { sql += ' AND status = ?'; params.push(status); }
    if (port) { sql += ' AND (origin_port LIKE ? OR destination_port LIKE ?)'; params.push(`%${port}%`, `%${port}%`); }
    if (search) { sql += ' AND (order_no LIKE ? OR customer_name LIKE ? OR cargo_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (dangerous === 'true') { sql += ' AND is_dangerous = 1'; }
    sql += ' ORDER BY created_at DESC LIMIT 500';
    const orders = db.prepare(sql).all(...params) as CargoOrder[];
    res.json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/pending', (_req: Request, res: Response) => {
  try {
    const orders = db.prepare("SELECT * FROM cargo_orders WHERE status = 'pending' ORDER BY delivery_deadline ASC, created_at DESC").all() as CargoOrder[];
    res.json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const order = db.prepare('SELECT * FROM cargo_orders WHERE id = ?').get(req.params.id) as CargoOrder;
    if (!order) return res.status(404).json({ success: false, error: '订单不存在' });
    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function generateOrderNo(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `ORD${y}${m}`;
  const all = db.prepare("SELECT order_no FROM cargo_orders").all() as { order_no: string }[];
  const matches = all.filter(o => o.order_no.startsWith(prefix)).map(o => o.order_no).sort();
  let seq = 1;
  if (matches.length > 0) {
    seq = parseInt(matches[matches.length - 1].slice(-3)) + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

router.post('/', (req: Request, res: Response) => {
  try {
    const validated = orderSchema.parse(req.body);
    const order_no = generateOrderNo();
    const info = db.prepare(`
      INSERT INTO cargo_orders (order_no, customer_name, customer_contact, cargo_name, cargo_type, weight, volume, container_type, container_count, is_dangerous, dangerous_category, un_number, origin_port, destination_port, delivery_deadline, special_requirements, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      order_no, validated.customer_name, validated.customer_contact ?? null, validated.cargo_name,
      validated.cargo_type ?? null, validated.weight, validated.volume ?? null,
      validated.container_type ?? null, validated.container_count, validated.is_dangerous,
      validated.dangerous_category ?? null, validated.un_number ?? null,
      validated.origin_port, validated.destination_port, validated.delivery_deadline ?? null,
      validated.special_requirements ?? null, validated.status
    );
    const order = db.prepare('SELECT * FROM cargo_orders WHERE id = ?').get(info.lastInsertRowid) as CargoOrder;
    res.json({ success: true, data: order, message: '订单创建成功' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: '验证失败', details: error.errors });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM cargo_orders WHERE id = ?').get(req.params.id) as CargoOrder;
    if (!existing) return res.status(404).json({ success: false, error: '订单不存在' });
    const validated = orderSchema.partial().parse(req.body);
    db.prepare(`
      UPDATE cargo_orders SET
        customer_name = COALESCE(?, customer_name),
        customer_contact = COALESCE(?, customer_contact),
        cargo_name = COALESCE(?, cargo_name),
        cargo_type = COALESCE(?, cargo_type),
        weight = COALESCE(?, weight),
        volume = COALESCE(?, volume),
        container_type = COALESCE(?, container_type),
        container_count = COALESCE(?, container_count),
        is_dangerous = COALESCE(?, is_dangerous),
        dangerous_category = COALESCE(?, dangerous_category),
        un_number = COALESCE(?, un_number),
        origin_port = COALESCE(?, origin_port),
        destination_port = COALESCE(?, destination_port),
        delivery_deadline = COALESCE(?, delivery_deadline),
        special_requirements = COALESCE(?, special_requirements),
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(
      validated.customer_name ?? null, validated.customer_contact ?? null, validated.cargo_name ?? null,
      validated.cargo_type ?? null, validated.weight ?? null, validated.volume ?? null,
      validated.container_type ?? null, validated.container_count ?? null, validated.is_dangerous ?? null,
      validated.dangerous_category ?? null, validated.un_number ?? null,
      validated.origin_port ?? null, validated.destination_port ?? null, validated.delivery_deadline ?? null,
      validated.special_requirements ?? null, validated.status ?? null, req.params.id
    );
    const order = db.prepare('SELECT * FROM cargo_orders WHERE id = ?').get(req.params.id) as CargoOrder;
    res.json({ success: true, data: order, message: '订单更新成功' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: '验证失败', details: error.errors });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM cargo_orders WHERE id = ?').get(req.params.id) as CargoOrder;
    if (!existing) return res.status(404).json({ success: false, error: '订单不存在' });
    const used = db.prepare('SELECT COUNT(*) as count FROM stowage_plan_items WHERE order_id = ?').get(req.params.id) as { count: number };
    if (used.count > 0) {
      return res.status(400).json({ success: false, error: `该订单已加入 ${used.count} 个配载计划，无法删除` });
    }
    db.prepare('DELETE FROM cargo_orders WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '订单删除成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
