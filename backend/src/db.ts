import path from 'path';
import fs from 'fs';

const dataDir = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'stowage.json');

type TableName = 'vessels' | 'cargo_orders' | 'dangerous_goods_rules' | 'tide_windows' | 'stowage_plans' | 'stowage_plan_items' | 'conflict_reports';

interface DBData {
  vessels: any[];
  cargo_orders: any[];
  dangerous_goods_rules: any[];
  tide_windows: any[];
  stowage_plans: any[];
  stowage_plan_items: any[];
  conflict_reports: any[];
  sequences: Record<TableName, number>;
}

let _data: DBData = loadData();

function loadData(): DBData {
  if (fs.existsSync(dbPath)) {
    try {
      return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
      console.warn('读取数据库失败，重建', e);
    }
  }
  return {
    vessels: [], cargo_orders: [], dangerous_goods_rules: [], tide_windows: [],
    stowage_plans: [], stowage_plan_items: [], conflict_reports: [],
    sequences: { vessels: 0, cargo_orders: 0, dangerous_goods_rules: 0, tide_windows: 0, stowage_plans: 0, stowage_plan_items: 0, conflict_reports: 0 }
  };
}

function saveData() {
  fs.writeFileSync(dbPath, JSON.stringify(_data, null, 2), 'utf8');
}

function nowLocalStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function nextId(table: TableName): number {
  _data.sequences[table] = (_data.sequences[table] || 0) + 1;
  return _data.sequences[table];
}

class Statement {
  constructor(private sql: string) {}

  run(...params: any[]): { lastInsertRowid: number | bigint; changes: number } {
    const sql = this.sql.trim();

    if (sql.startsWith('INSERT INTO')) {
      const m = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (!m) throw new Error('Unsupported INSERT: ' + sql);
      const table = m[1] as TableName;
      const columns = m[2].split(',').map(s => s.trim());
      const placeholders = m[3].split(',').map(s => s.trim());
      let pIdx = 0;
      const row: Record<string, any> = {};
      const id = nextId(table);
      row.id = id;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const ph = placeholders[i];
        let val: any;
        if (ph === '?') { val = params[pIdx++]; }
        else if (ph.startsWith('datetime')) { val = nowLocalStr(); }
        else if (ph.startsWith("'") && ph.endsWith("'")) { val = ph.slice(1, -1); }
        else if (ph === 'NULL' || ph === 'null') { val = null; }
        else if (/^-?\d+(\.\d+)?$/.test(ph)) { val = parseFloat(ph); }
        else val = ph;
        if (col.includes('(')) continue;
        row[col] = val;
      }
      if (!row.created_at && _data[table][0] && 'created_at' in _data[table][0]) row.created_at = nowLocalStr();
      if (table === 'stowage_plan_items' && !row.created_at) row.created_at = nowLocalStr();
      if (table === 'conflict_reports' && !row.created_at) row.created_at = nowLocalStr();
      _data[table].push(row);
      saveData();
      return { lastInsertRowid: id, changes: 1 };
    }

    if (sql.startsWith('UPDATE')) {
      const m = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
      if (!m) throw new Error('Unsupported UPDATE: ' + sql);
      const table = m[1] as TableName;
      const setClause = m[2];
      const where = m[3];
      const pairs = splitTopLevel(setClause, ',');
      const setColVals: { col: string; val: any }[] = [];
      let pIdx = 0;
      for (const pair of pairs) {
        const eq = pair.indexOf('=');
        const col = pair.slice(0, eq).trim();
        const raw = pair.slice(eq + 1).trim();
        let val: any;
        if (raw === '?') { val = params[pIdx++]; }
        else if (raw.startsWith('COALESCE') || raw.startsWith('coalesce')) {
          const inner = raw.slice('COALESCE('.length, -1);
          const args = splitTopLevel(inner, ',');
          val = null;
          for (const a of args) {
            const av = a.trim();
            if (av === '?') { const v = params[pIdx++]; if (v !== null && v !== undefined) { val = v; break; } }
            else if (av.startsWith("'") && av.endsWith("'")) { const v = av.slice(1, -1); if (v !== null && v !== undefined) { val = v; break; } }
            else if (/^-?\d+(\.\d+)?$/.test(av)) { val = parseFloat(av); break; }
            else {
              const cm = av.match(/(\w+)\.(.+)/);
              if (cm) { /* col ref - skip */ }
              else { if (av !== null && av !== undefined && av !== 'NULL') { val = av; break; } }
            }
          }
        } else if (raw.startsWith('datetime')) { val = nowLocalStr(); }
        else if (raw.startsWith("'") && raw.endsWith("'")) { val = raw.slice(1, -1); }
        else if (raw === 'NULL' || raw === 'null') { val = null; }
        else if (/^-?\d+(\.\d+)?$/.test(raw)) { val = parseFloat(raw); }
        else val = raw;
        setColVals.push({ col, val });
      }
      const rows = where ? evalWhere(_data[table], where, () => params, () => pIdx, true) : _data[table];
      // reset param idx
      pIdx = countSetPlaceholders(setClause);
      let affected = 0;
      for (const row of rows) {
        for (const { col, val } of setColVals) row[col] = val;
        affected++;
      }
      saveData();
      return { lastInsertRowid: 0, changes: affected };
    }

    if (sql.startsWith('DELETE FROM')) {
      const m = sql.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i);
      if (!m) throw new Error('Unsupported DELETE: ' + sql);
      const table = m[1] as TableName;
      const where = m[2];
      let pIdx = 0;
      if (!where) {
        const n = _data[table].length;
        _data[table] = [] as any;
        saveData();
        return { lastInsertRowid: 0, changes: n };
      }
      const keep: any[] = [];
      let deleted = 0;
      for (const row of _data[table]) {
        if (matchWhere(row, where, () => params, () => pIdx, false)) deleted++;
        else keep.push(row);
      }
      _data[table] = keep as any;
      saveData();
      return { lastInsertRowid: 0, changes: deleted };
    }

    throw new Error('Unsupported SQL: ' + sql);
  }

  get(...params: any[]): any {
    const all = this.all(...params);
    return all[0];
  }

  all(...params: any[]): any[] {
    const sql = this.sql.trim();
    if (!sql.startsWith('SELECT')) throw new Error('Expected SELECT: ' + sql);

    // parse simple SELECT with optional JOIN, WHERE, ORDER, LIMIT
    const fromMatch = sql.match(/FROM\s+([\w\s,]+?)(?:\s+(?:LEFT|INNER|RIGHT|OUTER|WHERE|ORDER|GROUP|LIMIT)|$)/i);
    if (!fromMatch) throw new Error('Cannot parse FROM: ' + sql);

    // tables
    const tablesRaw = fromMatch[1].trim().split(/\s*,\s*/);
    const mainTableAlias: { table: TableName; alias?: string }[] = tablesRaw.map(t => {
      const parts = t.split(/\s+/);
      return { table: parts[0] as TableName, alias: parts[1] };
    });

    // check for JOIN
    const joins: { table: TableName; alias?: string; onL: string; onR: string; type: string }[] = [];
    const joinRegex = /(LEFT|INNER|RIGHT|OUTER)?\s*JOIN\s+(\w+)(?:\s+(\w+))?\s+ON\s+([\w.]+)\s*=\s*([\w.]+)/gi;
    let jm: RegExpExecArray | null;
    while ((jm = joinRegex.exec(sql)) !== null) {
      joins.push({ type: jm[1] || 'inner', table: jm[2] as TableName, alias: jm[3], onL: jm[4], onR: jm[5] });
    }

    // where
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+(?:ORDER|GROUP|LIMIT)|$)/i);
    const where = whereMatch ? whereMatch[1].trim() : null;

    // order
    const orderMatch = sql.match(/ORDER\s+BY\s+(.+?)(?:\s+(?:LIMIT)|$)/i);
    const order = orderMatch ? orderMatch[1].trim() : null;

    // limit
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1]) : null;

    let pIdx = 0;

    let rows: any[] = _data[mainTableAlias[0].table].map(r => ({ ...r }));
    // prefix main table
    const mainPrefix = mainTableAlias[0].alias || mainTableAlias[0].table;

    for (const j of joins) {
      const joinData = _data[j.table];
      const jPrefix = j.alias || j.table;
      const lKey = stripTable(j.onL);
      const rKey = stripTable(j.onR);
      const leftKey = j.onL.startsWith(mainPrefix + '.') || j.onL.startsWith(mainTableAlias[0].table + '.') ? lKey : rKey;
      const rightKey = leftKey === lKey ? rKey : lKey;
      const newRows: any[] = [];
      for (const left of rows) {
        const matched = joinData.filter(r => r[rightKey] === left[leftKey]);
        if (matched.length === 0 && (j.type.toUpperCase() === 'LEFT')) {
          const empty: any = {};
          for (const k of Object.keys(joinData[0] || {})) empty[k] = null;
          newRows.push({ ...left, ...empty });
        } else {
          for (const r of matched) newRows.push({ ...left, ...r });
        }
      }
      rows = newRows;
    }

    // WHERE using params by evaluating
    if (where) {
      rows = rows.filter(row => matchWhere(row, where, () => params, () => pIdx, false));
    }

    // ORDER BY (one column, simple)
    if (order) {
      const parts = order.split(/\s*,\s*/);
      rows.sort((a, b) => {
        for (const part of parts) {
          const [col, dir] = part.split(/\s+/);
          const key = stripTable(col);
          const av = a[key]; const bv = b[key];
          let cmp = 0;
          if (av === null && bv === null) cmp = 0;
          else if (av === null) cmp = 1;
          else if (bv === null) cmp = -1;
          else if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
          else cmp = String(av).localeCompare(String(bv));
          if (dir && dir.toUpperCase() === 'DESC') cmp = -cmp;
          if (cmp !== 0) return cmp;
        }
        return 0;
      });
    }

    // LIMIT
    if (limit) rows = rows.slice(0, limit);

    // SELECT columns
    const colMatch = sql.match(/SELECT\s+(.+?)\s+FROM\s+/i);
    if (colMatch) {
      const cols = splitTopLevel(colMatch[1], ',');
      if (cols[0].trim() !== '*') {
        rows = rows.map(r => {
          const out: any = {};
          for (const c of cols) {
            const trimmed = c.trim();
            if (trimmed === '*') { Object.assign(out, r); continue; }
            const asMatch = trimmed.match(/(.+?)(?:\s+(?:AS\s+)?(\w+))?$/i);
            if (!asMatch) continue;
            const expr = asMatch[1].trim();
            const alias = asMatch[2];
            let val: any;
            if (expr === 'COUNT(*)' || expr === 'count(*)') { val = rows.length; }
            else if (/\w+\(\*\)/.test(expr)) { val = rows.length; }
            else {
              const key = stripTable(expr);
              val = r[key];
            }
            out[alias || stripTable(expr)] = val;
          }
          return out;
        });
        // dedupe for aggregate
        if (cols.some(c => c.includes('COUNT('))) {
          rows = [rows[0]];
        }
      }
    }

    return rows;
  }
}

function stripTable(col: string): string {
  const i = col.indexOf('.');
  return i >= 0 ? col.slice(i + 1) : col;
}

function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  let inStr = false;
  let strCh = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      cur += ch;
      if (ch === strCh) inStr = false;
      continue;
    }
    if (ch === "'" || ch === '"') { inStr = true; strCh = ch; cur += ch; continue; }
    if (ch === '(') { depth++; } else if (ch === ')') { depth--; }
    if (ch === sep && depth === 0 && !inStr) {
      out.push(cur); cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function countSetPlaceholders(s: string): number {
  return (s.match(/\?/g) || []).length;
}

function evalWhere(rows: any[], where: string, getParams: () => any[], getPidxRef: () => number, incPIdxEvery: boolean): any[] {
  const p = getParams();
  let pIdx = 0;
  const result = rows.filter(r => matchWhere(r, where, () => p, () => pIdx, incPIdxEvery));
  return result;
}

function matchWhere(row: any, where: string, getParams: () => any[], getPidxRef: () => number, incEveryTime: boolean): boolean {
  const params = getParams();
  // split ORs toplevel
  const orParts = splitTopLevel(where, ' OR ');
  if (orParts.length > 1) return orParts.some(part => matchWhere(row, part.trim(), getParams, getPidxRef, incEveryTime));

  // AND parts
  const andParts = splitTopLevel(where, ' AND ');
  return andParts.every(part => evalCond(row, part.trim(), params));
}

function evalCond(row: any, cond: string, params: any[]): boolean {
  if (cond.startsWith('(') && cond.endsWith(')')) cond = cond.slice(1, -1).trim();

  // IN (?, ?, ?)
  const inM = cond.match(/([\w.]+)\s+(NOT\s+)?IN\s*\(([^)]+)\)/i);
  if (inM) {
    const key = stripTable(inM[1]);
    const not = !!inM[2];
    const valStrs = splitTopLevel(inM[3], ',');
    const values = valStrs.map(s => parseScalar(s.trim(), params, row));
    const cond_ = values.includes(row[key]);
    return not ? !cond_ : cond_;
  }

  // LIKE
  const likeM = cond.match(/([\w.]+)\s+LIKE\s+(("[^"]*")|('[^']*')|\?)/i);
  if (likeM) {
    const key = stripTable(likeM[1]);
    const pattern = parseScalar(likeM[2], params, row) as string;
    const regex = new RegExp('^' + pattern.replace(/[_%]/g, m => m === '%' ? '.*' : '.').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\.\\\*\\\./g, '.*') + '$');
    // Actually, need proper escape: first escape regex specials except % _ we replaced. Simpler way:
    const rePattern = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$';
    return new RegExp(rePattern, 'i').test(row[key] || '');
  }

  // IS NULL / IS NOT NULL
  if (/IS\s+NULL/i.test(cond)) {
    const key = stripTable(cond.split(/\s+IS\s+/i)[0].trim());
    return row[key] === null || row[key] === undefined;
  }
  if (/IS\s+NOT\s+NULL/i.test(cond)) {
    const key = stripTable(cond.split(/\s+IS\s+NOT\s+/i)[0].trim());
    return row[key] !== null && row[key] !== undefined;
  }

  const ops = ['=', '!=', '<>', '<=', '>=', '<', '>'];
  for (const op of ops) {
    const idx = cond.indexOf(op);
    if (idx >= 0 && (cond[idx - 1] === ' ' || cond[idx + op.length] === ' ' || true)) {
      // but ensure we don't match inside string
      const leftStr = cond.slice(0, idx).trim();
      const rightStr = cond.slice(idx + op.length).trim();
      if (!leftStr || !rightStr) continue;
      // Skip if this is inside a string: simple check for unbalanced quotes
      let inQ = false; let qc = '';
      for (let i = 0; i < idx; i++) {
        const ch = cond[i];
        if ((ch === "'" || ch === '"') && !inQ) { inQ = true; qc = ch; }
        else if (ch === qc && inQ) inQ = false;
      }
      if (inQ) continue;
      const left = resolveValue(leftStr, params, row);
      const right = resolveValue(rightStr, params, row);
      switch (op) {
        case '=': return left == right;
        case '!=': case '<>': return left != right;
        case '<': return (left as any) < (right as any);
        case '>': return (left as any) > (right as any);
        case '<=': return (left as any) <= (right as any);
        case '>=': return (left as any) >= (right as any);
      }
    }
  }
  return true;
}

function parseScalar(s: string, params: any[], _row: any): any {
  if (s === '?') return params.shift();
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  return s;
}

function resolveValue(s: string, params: any[], row: any): any {
  if (s === '?') return params.shift();
  if (s === 'NULL' || s === 'null') return null;
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  // column
  const key = stripTable(s);
  if (row && key in row) return row[key];
  return s;
}

export const db = {
  prepare(sql: string) { return new Statement(sql); },
  exec(sql: string) {
    // Split statements by ; and run
    const stmts = sql.split(/;\s*(?=\n|$)/).filter(s => s.trim().length > 0);
    for (const s of stmts) {
      if (s.trim().startsWith('--') || s.trim().length === 0) continue;
      try { new Statement(s).run(); } catch (e) { /* ignore CREATE TABLE errors in mock */ }
    }
  },
  pragma(_s: string) { /* noop */ },
  transaction(fn: Function) {
    return function wrapped(...args: any[]) {
      // simple - run, rollback not supported
      return fn(...args);
    };
  }
};

export function initDatabase() {
  const rulesCount = _data.dangerous_goods_rules.length;
  if (rulesCount === 0) {
    const dangerousRules: [string, string, string, string][] = [
      ['爆炸品', '易燃气体', 'critical', '爆炸品与易燃气体禁止同船装载'],
      ['爆炸品', '氧化性物质', 'critical', '爆炸品与氧化性物质禁止同船装载'],
      ['易燃气体', '毒性气体', 'critical', '易燃气体与毒性气体禁止同船装载'],
      ['易燃液体', '腐蚀性物质', 'high', '易燃液体与腐蚀性物质需隔离装载'],
      ['易燃固体', '氧化性物质', 'high', '易燃固体与氧化性物质需隔离装载'],
      ['氧化性物质', '有机过氧化物', 'critical', '氧化性物质与有机过氧化物禁止同船装载'],
      ['毒性物质', '食品类货物', 'critical', '毒性物质与食品类货物禁止同船装载'],
      ['放射性物质', '任何货物', 'critical', '放射性物质需单独专船运输'],
      ['腐蚀性物质', '易燃固体', 'high', '腐蚀性物质与易燃固体需隔离装载'],
    ];
    for (const rule of dangerousRules) {
      db.prepare(`
        INSERT INTO dangerous_goods_rules (category_a, category_b, conflict_level, rule_description)
        VALUES (?, ?, ?, ?)
      `).run(...rule);
    }
    console.log('✅ 已初始化危险品冲突规则');
  }

  if (_data.vessels.length === 0) {
    const demoVessels: any[] = [
      ['近海明珠号', 'IMO9876543', 5000, 25000, 8.5, '青岛-烟台-大连', 200, 100, 'active'],
      ['渤海之星号', 'IMO9876544', 3500, 18000, 7.0, '天津-秦皇岛-营口', 150, 75, 'active'],
      ['东海快线号', 'IMO9876545', 8000, 40000, 10.5, '上海-宁波-福州', 350, 175, 'active'],
      ['南海一号', 'IMO9876546', 12000, 60000, 12.0, '广州-深圳-海口', 500, 250, 'active'],
    ];
    for (const v of demoVessels) {
      db.prepare(`
        INSERT INTO vessels (name, imo_number, max_weight, max_volume, draft, route, capacity_20ft, capacity_40ft, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(...v);
    }
    console.log('✅ 已初始化示例船只数据');
  }

  if (_data.cargo_orders.length === 0) {
    const demoOrders: any[] = [
      ['ORD202606001', '青岛海洋食品有限公司', '13800138001', '冷冻海鲜集装箱', '冷藏货', 2500, 1200, '20FT', 10, 0, '', '', '青岛', '烟台', '2026-06-15', 'pending'],
      ['ORD202606002', '烟台化工集团', '13800138002', '乙醇桶装', '易燃液体', 800, 900, '20FT', 4, 1, '易燃液体', 'UN1170', '烟台', '大连', '2026-06-16', 'pending'],
      ['ORD202606003', '大连机械制造有限公司', '13800138003', '工业机械设备', '普通货', 3200, 5600, '40FT', 8, 0, '', '', '青岛', '大连', '2026-06-14', 'pending'],
      ['ORD202606004', '青岛农业合作社', '13800138004', '新鲜蔬菜', '食品类货物', 600, 1500, '20FT', 3, 0, '', '', '青岛', '大连', '2026-06-13', 'pending'],
      ['ORD202606005', '山东农药厂', '13800138005', '杀虫剂浓缩液', '毒性物质', 300, 400, '20FT', 2, 1, '毒性物质', 'UN2902', '青岛', '烟台', '2026-06-17', 'pending'],
      ['ORD202606006', '华东电子科技', '13800138006', '精密电子仪器', '贵重货', 1200, 800, '20FT', 5, 0, '', '', '上海', '宁波', '2026-06-15', 'pending'],
      ['ORD202606007', '宁波纺织集团', '13800138007', '成品布匹', '普通货', 1500, 4500, '40FT', 4, 0, '', '', '上海', '福州', '2026-06-16', 'pending'],
      ['ORD202606008', '广州建材市场', '13800138008', '建筑钢材', '普通货', 4500, 2200, '散货', 0, 0, '', '', '广州', '海口', '2026-06-18', 'pending'],
    ];
    for (const o of demoOrders) {
      db.prepare(`
        INSERT INTO cargo_orders (order_no, customer_name, customer_contact, cargo_name, cargo_type, weight, volume, container_type, container_count, is_dangerous, dangerous_category, un_number, origin_port, destination_port, delivery_deadline, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(...o);
    }
    console.log('✅ 已初始化示例订单数据');
  }

  if (_data.tide_windows.length === 0) {
    const today = new Date('2026-06-11');
    const ports = ['青岛', '烟台', '大连', '天津', '上海', '宁波', '福州', '广州', '深圳', '海口'];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      for (const port of ports) {
        const morningStart = `04:${String(30 + Math.floor(Math.random() * 30)).padStart(2, '0')}`;
        const morningEnd = `07:${String(Math.floor(Math.random() * 30)).padStart(2, '0')}`;
        const eveningStart = `16:${String(20 + Math.floor(Math.random() * 30)).padStart(2, '0')}`;
        const eveningEnd = `19:${String(Math.floor(Math.random() * 30)).padStart(2, '0')}`;
        const draft = (7 + Math.random() * 5);
        db.prepare(`INSERT INTO tide_windows (port_name, date, high_tide_start, high_tide_end, max_draft, notes) VALUES (?, ?, ?, ?, ?, ?)`).run(
          port, dateStr, morningStart, morningEnd, parseFloat(draft.toFixed(2)), '早潮'
        );
        db.prepare(`INSERT INTO tide_windows (port_name, date, high_tide_start, high_tide_end, max_draft, notes) VALUES (?, ?, ?, ?, ?, ?)`).run(
          port, dateStr, eveningStart, eveningEnd, parseFloat((draft * 0.95).toFixed(2)), '晚潮'
        );
      }
    }
    console.log('✅ 已初始化7天潮汐窗口数据');
  }

  saveData();
  console.log('🚢 数据库初始化完成');
}
