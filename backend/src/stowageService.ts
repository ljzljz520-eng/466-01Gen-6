import { db } from './db';
import { CargoOrder, Vessel, TideWindow, ValidationResult, ConflictItem, DangerousGoodsRule } from './types';

export class StowageService {
  static validatePlan(vesselId: number, orderIds: number[], tideWindowId?: number): ValidationResult {
    const conflicts: ConflictItem[] = [];
    const warnings: ConflictItem[] = [];

    const vessel = db.prepare('SELECT * FROM vessels WHERE id = ?').get(vesselId) as Vessel;
    if (!vessel) {
      conflicts.push({ type: 'vessel_not_found', severity: 'critical', description: '指定的船只不存在' });
      return { valid: false, conflicts, warnings, summary: this.emptySummary() };
    }

    const allOrders = db.prepare('SELECT * FROM cargo_orders').all() as CargoOrder[];
    const orders = allOrders.filter(o => orderIds.includes(o.id));

    if (orders.length === 0) {
      conflicts.push({ type: 'no_orders', severity: 'critical', description: '配载计划中没有任何货物订单' });
      return { valid: false, conflicts, warnings, summary: this.emptySummary() };
    }

    if (orders.length !== orderIds.length) {
      warnings.push({ type: 'partial_orders', severity: 'medium', description: '部分订单未找到，已跳过' });
    }

    const totalWeight = orders.reduce((sum, o) => sum + o.weight, 0);
    const totalVolume = orders.reduce((sum, o) => sum + (o.volume || 0), 0);
    const container20ft = orders.filter(o => o.container_type === '20FT').reduce((s, o) => s + o.container_count, 0);
    const container40ft = orders.filter(o => o.container_type === '40FT').reduce((s, o) => s + o.container_count, 0);
    const dangerousCount = orders.filter(o => o.is_dangerous === 1).length;

    const summary = {
      totalWeight,
      totalVolume,
      container20ft,
      container40ft,
      weightUtilization: vessel.max_weight > 0 ? (totalWeight / vessel.max_weight) * 100 : 0,
      volumeUtilization: vessel.max_volume ? (totalVolume / vessel.max_volume) * 100 : 0,
      dangerousCount,
    };

    if (totalWeight > vessel.max_weight) {
      conflicts.push({
        type: 'weight_exceeded',
        severity: 'critical',
        description: `货物总重量 ${totalWeight.toFixed(1)} 吨超过船只最大载重 ${vessel.max_weight.toFixed(1)} 吨，超出 ${(totalWeight - vessel.max_weight).toFixed(1)} 吨`,
      });
    } else if (summary.weightUtilization > 95) {
      warnings.push({
        type: 'weight_warning',
        severity: 'medium',
        description: `货物重量已达船只载重的 ${summary.weightUtilization.toFixed(1)}%，接近满载`,
      });
    }

    if (vessel.max_volume && totalVolume > vessel.max_volume) {
      conflicts.push({
        type: 'volume_exceeded',
        severity: 'high',
        description: `货物体积 ${totalVolume.toFixed(1)} m³ 超过船舱容积 ${vessel.max_volume.toFixed(1)} m³`,
      });
    } else if (vessel.max_volume && summary.volumeUtilization > 95) {
      warnings.push({
        type: 'volume_warning',
        severity: 'low',
        description: `货物体积已达船舱容积的 ${summary.volumeUtilization.toFixed(1)}%`,
      });
    }

    if (vessel.capacity_20ft && container20ft > vessel.capacity_20ft) {
      conflicts.push({
        type: 'container_20ft_exceeded',
        severity: 'high',
        description: `20英尺集装箱数量 ${container20ft} 超过船只容量 ${vessel.capacity_20ft}`,
      });
    }
    if (vessel.capacity_40ft && container40ft > vessel.capacity_40ft) {
      conflicts.push({
        type: 'container_40ft_exceeded',
        severity: 'high',
        description: `40英尺集装箱数量 ${container40ft} 超过船只容量 ${vessel.capacity_40ft}`,
      });
    }

    this.checkDangerousConflicts(orders, conflicts, warnings);
    this.checkPortCompatibility(orders, vessel, conflicts, warnings);
    this.checkDeliveryDeadlines(orders, warnings);

    if (tideWindowId) {
      this.checkTideWindow(vessel, tideWindowId, conflicts, warnings);
    }

    return {
      valid: conflicts.length === 0,
      conflicts,
      warnings,
      summary,
    };
  }

  private static checkDangerousConflicts(orders: CargoOrder[], conflicts: ConflictItem[], warnings: ConflictItem[]) {
    const dangerousOrders = orders.filter(o => o.is_dangerous === 1);
    if (dangerousOrders.length === 0) return;

    const rules = db.prepare('SELECT * FROM dangerous_goods_rules').all() as DangerousGoodsRule[];

    for (let i = 0; i < dangerousOrders.length; i++) {
      for (let j = i + 1; j < dangerousOrders.length; j++) {
        const catA = dangerousOrders[i].dangerous_category || '';
        const catB = dangerousOrders[j].dangerous_category || '';

        const matchedRule = rules.find(r =>
          (r.category_a === catA && r.category_b === catB) ||
          (r.category_a === catB && r.category_b === catA) ||
          r.category_a === '任何货物' && r.category_b === catB ||
          r.category_a === '任何货物' && r.category_b === catA
        );

        if (matchedRule) {
          const conflict: ConflictItem = {
            type: 'dangerous_conflict',
            severity: matchedRule.conflict_level as any,
            description: matchedRule.rule_description + ` (订单 ${dangerousOrders[i].order_no} 与 ${dangerousOrders[j].order_no})`,
            involvedOrders: [dangerousOrders[i].id, dangerousOrders[j].id],
          };
          if (matchedRule.conflict_level === 'critical' || matchedRule.conflict_level === 'high') {
            conflicts.push(conflict);
          } else {
            warnings.push(conflict);
          }
        }
      }
    }

    const foodOrders = orders.filter(o =>
      (o.cargo_type === '食品类货物' || o.cargo_type === '冷藏货' || o.cargo_name.includes('海鲜') || o.cargo_name.includes('蔬菜') || o.cargo_name.includes('食品')) &&
      o.is_dangerous === 0
    );

    for (const dangerous of dangerousOrders) {
      const cat = dangerous.dangerous_category;
      if (cat === '毒性物质' || cat === '放射性物质' || cat === '腐蚀性物质') {
        for (const food of foodOrders) {
          conflicts.push({
            type: 'food_contamination_risk',
            severity: 'critical',
            description: `危险品「${dangerous.cargo_name}」(${cat}) 与食品类货物「${food.cargo_name}」禁止同船，存在污染风险 (订单 ${dangerous.order_no} 与 ${food.order_no})`,
            involvedOrders: [dangerous.id, food.id],
          });
        }
      }
    }
  }

  private static checkPortCompatibility(orders: CargoOrder[], vessel: Vessel, conflicts: ConflictItem[], warnings: ConflictItem[]) {
    const originPorts = [...new Set(orders.map(o => o.origin_port))];
    const destPorts = [...new Set(orders.map(o => o.destination_port))];

    if (originPorts.length > 2) {
      warnings.push({
        type: 'multiple_origin_ports',
        severity: 'medium',
        description: `货物涉及 ${originPorts.length} 个起始港口: ${originPorts.join('、')}，可能需要安排多港挂靠`,
      });
    }

    if (destPorts.length > 3) {
      warnings.push({
        type: 'multiple_dest_ports',
        severity: 'medium',
        description: `货物涉及 ${destPorts.length} 个目的港口: ${destPorts.join('、')}，请规划合理的靠港顺序`,
      });
    }

    if (vessel.route) {
      const routePorts = vessel.route.split(/[-–—]/).map(p => p.trim());
      const allPorts = [...originPorts, ...destPorts];
      const unmatchedPorts = allPorts.filter(p => !routePorts.includes(p));
      if (unmatchedPorts.length > 0) {
        warnings.push({
          type: 'route_mismatch',
          severity: 'low',
          description: `港口 ${[...new Set(unmatchedPorts)].join('、')} 不在船只常规航线「${vessel.route}」范围内`,
        });
      }
    }
  }

  private static checkDeliveryDeadlines(orders: CargoOrder[], warnings: ConflictItem[]) {
    const now = new Date('2026-06-11');
    for (const order of orders) {
      if (order.delivery_deadline) {
        const deadline = new Date(order.delivery_deadline);
        const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          warnings.push({
            type: 'deadline_passed',
            severity: 'high',
            description: `订单 ${order.order_no} 交货期已过 ${Math.abs(diffDays)} 天`,
            involvedOrders: [order.id],
          });
        } else if (diffDays <= 2) {
          warnings.push({
            type: 'urgent_delivery',
            severity: 'medium',
            description: `订单 ${order.order_no} 交货期紧迫，仅剩 ${diffDays} 天`,
            involvedOrders: [order.id],
          });
        }
      }
    }
  }

  private static checkTideWindow(vessel: Vessel, tideWindowId: number, conflicts: ConflictItem[], warnings: ConflictItem[]) {
    const tide = db.prepare('SELECT * FROM tide_windows WHERE id = ?').get(tideWindowId) as TideWindow;
    if (!tide) {
      warnings.push({ type: 'tide_not_found', severity: 'medium', description: '指定的潮汐窗口不存在' });
      return;
    }

    if (vessel.draft && tide.max_draft && vessel.draft > tide.max_draft) {
      conflicts.push({
        type: 'draft_exceeded',
        severity: 'critical',
        description: `船只吃水深度 ${vessel.draft}m 超过该潮汐窗口允许的最大吃水 ${tide.max_draft}m，无法安全进出港`,
      });
    } else if (vessel.draft && tide.max_draft) {
      const margin = tide.max_draft - vessel.draft;
      if (margin < 0.5) {
        warnings.push({
          type: 'draft_margin_small',
          severity: 'high',
          description: `吃水余量仅 ${margin.toFixed(2)}m，小于安全余量 0.5m，需谨慎操作`,
        });
      }
    }
  }

  private static emptySummary() {
    return { totalWeight: 0, totalVolume: 0, container20ft: 0, container40ft: 0, weightUtilization: 0, volumeUtilization: 0, dangerousCount: 0 };
  }

  static calculateETD_ETA(originPort: string, destPort: string, tideWindowId?: number): { etd: string | null; eta: string | null } {
    let etd: string | null = null;
    let eta: string | null = null;

    if (tideWindowId) {
      const tide = db.prepare('SELECT * FROM tide_windows WHERE id = ?').get(tideWindowId) as TideWindow;
      if (tide) {
        etd = `${tide.date} ${tide.high_tide_start}`;
      }
    }

    if (!etd) {
      const today = new Date('2026-06-11');
      today.setDate(today.getDate() + 1);
      etd = `${today.toISOString().split('T')[0]} 10:00`;
    }

    const portDistanceMap: Record<string, number> = {
      '青岛-烟台': 8, '烟台-青岛': 8, '青岛-大连': 24, '大连-青岛': 24,
      '烟台-大连': 15, '大连-烟台': 15, '天津-秦皇岛': 6, '秦皇岛-天津': 6,
      '天津-营口': 18, '营口-天津': 18, '上海-宁波': 10, '宁波-上海': 10,
      '上海-福州': 30, '福州-上海': 30, '宁波-福州': 22, '福州-宁波': 22,
      '广州-深圳': 5, '深圳-广州': 5, '广州-海口': 20, '海口-广州': 20,
      '深圳-海口': 18, '海口-深圳': 18,
    };

    const key = `${originPort}-${destPort}`;
    const hours = portDistanceMap[key] || 36;

    try {
      const [datePart, timePart] = etd.split(' ');
      const [y, mo, d] = datePart.split('-').map(Number);
      const [h, mi] = (timePart || '10:00').split(':').map(Number);
      const date = new Date(y, mo - 1, d, h, mi + hours * 60);
      const p = (n: number) => String(n).padStart(2, '0');
      eta = `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
    } catch (_e) {
      eta = etd;
    }

    return { etd, eta };
  }
}
