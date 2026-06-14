import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { StowagePlan, CargoOrder, Vessel, TideWindow } from '../types';
import { StowageService } from '../stowageService';

const router = Router();

const createPlanSchema = z.object({
  vessel_id: z.number().int().positive('请选择船只'),
  voyage_no: z.string().optional().nullable(),
  origin_port: z.string().min(1, '起始港口不能为空'),
  destination_port: z.string().min(1, '目的港口不能为空'),
  tide_window_id: z.number().int().optional().nullable(),
  order_ids: z.array(z.number().int().positive()).min(1, '请至少选择一个订单'),
  notes: z.string().optional().nullable(),
});

function generatePlanNo(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `STW${y}${m}${d}`;
  const all = db.prepare("SELECT plan_no FROM stowage_plans").all() as { plan_no: string }[];
  const matches = all.filter(p => p.plan_no.startsWith(prefix)).map(p => p.plan_no).sort();
  let seq = 1;
  if (matches.length > 0) {
    const last = matches[matches.length - 1];
    seq = parseInt(last.slice(-3)) + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

router.get('/stats', (_req: Request, res: Response) => {
  try {
    const vessels = db.prepare("SELECT * FROM vessels").all() as any[];
    const orders = db.prepare("SELECT * FROM cargo_orders").all() as any[];
    const plans = db.prepare("SELECT * FROM stowage_plans").all() as any[];
    const tides = db.prepare("SELECT * FROM tide_windows").all() as any[];
    const totalVessels = vessels.filter(v => v.status === 'active').length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const draftPlans = plans.filter(p => p.status === 'draft').length;
    const confirmedPlans = plans.filter(p => p.captain_confirmed === 1 || p.captain_confirmed === true).length;
    const todayTides = tides.filter(t => t.date === '2026-06-11').length;
    const dangerousOrders = orders.filter(o => o.status === 'pending' && (o.is_dangerous === 1 || o.is_dangerous === true)).length;
    res.json({
      success: true,
      data: { totalVessels, pendingOrders, draftPlans, confirmedPlans, todayTides, dangerousOrders }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const { status, vessel_id, confirmed } = req.query as Record<string, string>;
    const plans = db.prepare("SELECT * FROM stowage_plans ORDER BY created_at DESC LIMIT 200").all() as any[];
    const vessels = db.prepare("SELECT * FROM vessels").all() as any[];
    const tides = db.prepare("SELECT * FROM tide_windows").all() as any[];
    const vesselsMap = new Map(vessels.map(v => [v.id, v]));
    const tidesMap = new Map(tides.map(t => [t.id, t]));
    const filtered = plans.filter(p => {
      if (status && status !== 'all' && p.status !== status) return false;
      if (vessel_id && String(p.vessel_id) !== String(vessel_id)) return false;
      if (confirmed === 'true' && !(p.captain_confirmed === 1 || p.captain_confirmed === true)) return false;
      if (confirmed === 'false' && (p.captain_confirmed === 1 || p.captain_confirmed === true)) return false;
      return true;
    });
    const data = filtered.map(p => {
      const v = vesselsMap.get(p.vessel_id);
      const t = p.tide_window_id ? tidesMap.get(p.tide_window_id) : undefined;
      return {
        ...p,
        vessel_name: v ? v.name : null,
        imo_number: v ? v.imo_number : null,
        tide_date: t ? t.date : null,
        high_tide_start: t ? t.high_tide_start : null,
        tide_port: t ? t.port_name : null,
      };
    });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const pid = Number(req.params.id);
    const plan = db.prepare('SELECT * FROM stowage_plans').all().find((p: any) => p.id === pid) as StowagePlan;
    if (!plan) return res.status(404).json({ success: false, error: '配载计划不存在' });

    const vessel = db.prepare('SELECT * FROM vessels').all().find((v: any) => v.id === Number(plan.vessel_id)) as Vessel;
    const tide_window = plan.tide_window_id ? (db.prepare('SELECT * FROM tide_windows').all().find((t: any) => t.id === Number(plan.tide_window_id)) as TideWindow) : undefined;
    const planItems = db.prepare('SELECT * FROM stowage_plan_items').all().filter((i: any) => i.plan_id === pid).sort((a: any, b: any) => a.loading_sequence - b.loading_sequence || a.id - b.id);
    const allOrders = db.prepare('SELECT * FROM cargo_orders').all() as any[];
    const orderMap = new Map(allOrders.map(o => [o.id, o]));
    const items = planItems.map((spi: any) => ({
      id: spi.id, plan_id: spi.plan_id, order_id: spi.order_id,
      stowage_position: spi.stowage_position, loading_sequence: spi.loading_sequence,
      created_at: spi.created_at,
      order: orderMap.get(spi.order_id) as CargoOrder
    }));
    const conflict_reports = db.prepare('SELECT * FROM conflict_reports').all()
      .filter((c: any) => c.plan_id === pid)
      .sort((a: any, b: any) => {
        const order = ['critical', 'high', 'medium', 'low'];
        return order.indexOf(a.severity) - order.indexOf(b.severity);
      });

    res.json({
      success: true,
      data: { ...plan, vessel, tide_window, items, conflict_reports }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/validate', (req: Request, res: Response) => {
  try {
    const { vessel_id, order_ids, tide_window_id } = req.body;
    if (!vessel_id || !order_ids || !Array.isArray(order_ids)) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    const result = StowageService.validatePlan(vessel_id, order_ids, tide_window_id || undefined);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const validated = createPlanSchema.parse(req.body);

    const validation = StowageService.validatePlan(
      validated.vessel_id, validated.order_ids, validated.tide_window_id || undefined
    );

    const plan_no = generatePlanNo();
    const { etd, eta } = StowageService.calculateETD_ETA(
      validated.origin_port, validated.destination_port, validated.tide_window_id || undefined
    );

    const insertPlan = db.prepare(`
      INSERT INTO stowage_plans (plan_no, vessel_id, voyage_no, etd, eta, origin_port, destination_port, tide_window_id, total_weight, total_volume, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `);
    const insertItem = db.prepare(`
      INSERT INTO stowage_plan_items (plan_id, order_id, loading_sequence)
      VALUES (?, ?, ?)
    `);
    const insertConflict = db.prepare(`
      INSERT INTO conflict_reports (plan_id, conflict_type, severity, description, involved_orders)
      VALUES (?, ?, ?, ?, ?)
    `);
    const updateOrderStatus = db.prepare("UPDATE cargo_orders SET status='stowed' WHERE id=?");

    const tx = db.transaction(() => {
      const info = insertPlan.run(
        plan_no, validated.vessel_id, validated.voyage_no ?? null, etd, eta,
        validated.origin_port, validated.destination_port, validated.tide_window_id ?? null,
        validation.summary.totalWeight, validation.summary.totalVolume, validated.notes ?? null
      );
      const planId = Number(info.lastInsertRowid);

      validated.order_ids.forEach((oid, idx) => {
        insertItem.run(planId, oid, idx + 1);
        updateOrderStatus.run(oid);
      });

      [...validation.conflicts, ...validation.warnings].forEach(c => {
        insertConflict.run(
          planId, c.type, c.severity, c.description,
          c.involvedOrders ? JSON.stringify(c.involvedOrders) : null
        );
      });

      return planId;
    });

    const planId = tx();
    const allPlans = db.prepare('SELECT * FROM stowage_plans ORDER BY id DESC LIMIT 5').all() as any[];
    const planData = allPlans.find(p => p.id === planId) || allPlans[0];
    const vesselData = db.prepare('SELECT * FROM vessels').all().find((v: any) => v.id === Number(planData.vessel_id)) as any;
    const plan = { ...planData, vessel_name: vesselData ? vesselData.name : null };

    res.json({
      success: true,
      data: plan,
      validation,
      message: validation.valid ? '配载计划创建成功，无冲突' : '配载计划创建成功，但检测到冲突，请处理'
    });
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, error: '验证失败', details: error.errors });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/confirm', (req: Request, res: Response) => {
  try {
    const { captain_name } = req.body;
    if (!captain_name) return res.status(400).json({ success: false, error: '请输入船长姓名' });
    const pid = Number(req.params.id);

    const plan = db.prepare('SELECT * FROM stowage_plans WHERE id = ?').get(pid) as StowagePlan;
    if (!plan) return res.status(404).json({ success: false, error: '配载计划不存在' });

    const allConflicts = db.prepare('SELECT * FROM conflict_reports WHERE plan_id = ?').all(pid) as any[];
    const conflicts = allConflicts.filter(c => c.severity === 'critical' || c.severity === 'high');
    if (conflicts.length > 0) {
      return res.status(400).json({
        success: false,
        error: `存在 ${conflicts.length} 个严重/高危冲突，必须先解决才能确认装船`,
        conflicts
      });
    }

    const planItems = db.prepare('SELECT order_id FROM stowage_plan_items WHERE plan_id = ?').all(pid) as any[];
    const itemOrderIds = planItems.map(i => i.order_id);

    const nowLocal = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const confirmedAt = `${nowLocal.getFullYear()}-${pad(nowLocal.getMonth()+1)}-${pad(nowLocal.getDate())} ${pad(nowLocal.getHours())}:${pad(nowLocal.getMinutes())}:${pad(nowLocal.getSeconds())}`;

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE stowage_plans SET captain_confirmed = 1, captain_name = ?, confirmed_at = ?, status = 'confirmed'
        WHERE id = ?
      `).run(captain_name, confirmedAt, pid);
      for (const oid of itemOrderIds) {
        db.prepare("UPDATE cargo_orders SET status='shipped' WHERE id = ?").run(oid);
      }
    });
    tx();

    const updatedPlanData = db.prepare('SELECT * FROM stowage_plans WHERE id = ?').get(pid) as any;
    const vesselForPlan = db.prepare('SELECT * FROM vessels WHERE id = ?').get(Number(updatedPlanData.vessel_id)) as any;
    const updatedPlan = { ...updatedPlanData, vessel_name: vesselForPlan ? vesselForPlan.name : null };
    res.json({ success: true, data: updatedPlan, message: '船长已确认装船，计划状态已更新' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/status', (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const pid = Number(req.params.id);
    const valid = ['draft', 'confirmed', 'sailed', 'arrived', 'cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ success: false, error: '无效状态' });
    db.prepare('UPDATE stowage_plans SET status = ? WHERE id = ?').run(status, pid);
    res.json({ success: true, message: `状态已更新为: ${status}` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const pid = Number(req.params.id);
    const allPlans = db.prepare('SELECT * FROM stowage_plans').all() as any[];
    const plan = allPlans.find(p => p.id === pid) as StowagePlan;
    if (!plan) return res.status(404).json({ success: false, error: '配载计划不存在' });
    if (plan.captain_confirmed >= 1) {
      return res.status(400).json({ success: false, error: '船长已确认的计划无法删除，请先取消确认' });
    }
    const planItems = db.prepare('SELECT * FROM stowage_plan_items').all().filter((i: any) => i.plan_id === pid) as any[];
    const itemOrderIds = planItems.map(i => i.order_id);
    const tx = db.transaction(() => {
      for (const oid of itemOrderIds) {
        db.prepare("UPDATE cargo_orders SET status='pending' WHERE id = ?").run(oid);
      }
      db.prepare('DELETE FROM stowage_plan_items WHERE plan_id = ?').run(pid);
      db.prepare('DELETE FROM conflict_reports WHERE plan_id = ?').run(pid);
      db.prepare('DELETE FROM stowage_plans WHERE id = ?').run(pid);
    });
    tx();
    res.json({ success: true, message: '配载计划已删除，订单状态已恢复为待配载' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/customer/search', (req: Request, res: Response) => {
  try {
    const { order_no, customer_name, phone } = req.query as Record<string, string>;
    if (!order_no && !customer_name && !phone) {
      return res.status(400).json({ success: false, error: '请提供订单号、货主名称或联系电话进行查询' });
    }

    const allOrders = db.prepare('SELECT * FROM cargo_orders ORDER BY created_at DESC').all() as CargoOrder[];
    const orders = allOrders.filter(o => {
      let match = true;
      if (order_no) match = match && (o.order_no === order_no);
      if (customer_name) match = match && !!(o.customer_name && o.customer_name.includes(customer_name));
      if (phone) match = match && !!(o.customer_contact && o.customer_contact.includes(phone));
      return match;
    }).slice(0, 50);

    if (orders.length === 0) {
      return res.json({ success: true, data: [], message: '未找到匹配的订单' });
    }

    const orderIds = new Set(orders.map(o => o.id));
    const allPlanItems = db.prepare('SELECT * FROM stowage_plan_items').all() as any[];
    const planItems = allPlanItems.filter(i => orderIds.has(i.order_id));
    const allPlans = db.prepare('SELECT * FROM stowage_plans').all() as any[];
    const allVessels = db.prepare('SELECT * FROM vessels').all() as any[];
    const plansMap = new Map(allPlans.map(p => [p.id, p]));
    const vesselsMap = new Map(allVessels.map(v => [v.id, v]));

    const itemsByOrder = new Map<number, any[]>();
    for (const spi of planItems) {
      const sp = plansMap.get(spi.plan_id);
      if (!sp) continue;
      const v = vesselsMap.get(sp.vessel_id);
      const record = {
        order_id: spi.order_id,
        plan_id: sp.id, plan_no: sp.plan_no, voyage_no: sp.voyage_no,
        etd: sp.etd, eta: sp.eta,
        origin_port: sp.origin_port, destination_port: sp.destination_port,
        plan_status: sp.status, captain_confirmed: sp.captain_confirmed,
        captain_name: sp.captain_name, confirmed_at: sp.confirmed_at, notes: sp.notes,
        vessel_name: v ? v.name : null,
        imo_number: v ? v.imo_number : null,
        route: v ? v.route : null,
      };
      if (!itemsByOrder.has(spi.order_id)) itemsByOrder.set(spi.order_id, []);
      itemsByOrder.get(spi.order_id)!.push(record);
    }

    const results = orders.map(o => ({
      order: {
        order_no: o.order_no, customer_name: o.customer_name, customer_contact: o.customer_contact,
        cargo_name: o.cargo_name, cargo_type: o.cargo_type, weight: o.weight, volume: o.volume,
        is_dangerous: o.is_dangerous, origin_port: o.origin_port, destination_port: o.destination_port,
        delivery_deadline: o.delivery_deadline, status: o.status
      },
      plans: itemsByOrder.get(o.id) || []
    }));

    res.json({ success: true, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
