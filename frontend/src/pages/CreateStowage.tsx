import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { Vessel, CargoOrder, TideWindow, ValidationResult } from '../types'

const ports = ['青岛', '烟台', '大连', '天津', '秦皇岛', '营口', '上海', '宁波', '福州', '广州', '深圳', '海口']

export default function CreateStowage() {
  const navigate = useNavigate()
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [allOrders, setAllOrders] = useState<CargoOrder[]>([])
  const [tideWindows, setTideWindows] = useState<TideWindow[]>([])
  const [form, setForm] = useState({
    vessel_id: 0, voyage_no: '', origin_port: '青岛', destination_port: '烟台',
    tide_window_id: 0 as number | '', order_ids: [] as number[], notes: ''
  })
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [validating, setValidating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null)
  const [portFilter, setPortFilter] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/vessels/active'),
      api.get('/orders/pending'),
      api.get('/config/tide-windows/available'),
    ]).then(([v, o, t]) => {
      setVessels(v.data.data)
      setAllOrders(o.data.data)
      setTideWindows(t.data.data)
      if (v.data.data.length > 0) setForm(f => ({ ...f, vessel_id: v.data.data[0].id }))
    })
  }, [])

  const selectedVessel = useMemo(() => vessels.find(v => v.id === form.vessel_id), [vessels, form.vessel_id])

  const filteredOrders = useMemo(() => {
    return allOrders.filter(o => {
      if (portFilter && o.origin_port !== portFilter && o.destination_port !== portFilter) return false
      if (o.origin_port !== form.origin_port && o.destination_port !== form.destination_port) {
        if (!portFilter) return true
      }
      return true
    })
  }, [allOrders, form.origin_port, form.destination_port, portFilter])

  const selectedOrders = useMemo(
    () => allOrders.filter(o => form.order_ids.includes(o.id)),
    [allOrders, form.order_ids]
  )

  const filteredTides = useMemo(
    () => tideWindows.filter(t => !form.origin_port || t.port_name === form.origin_port),
    [tideWindows, form.origin_port]
  )

  const toggleOrder = (id: number) => {
    setForm(f => ({
      ...f,
      order_ids: f.order_ids.includes(id) ? f.order_ids.filter(x => x !== id) : [...f.order_ids, id]
    }))
    setValidation(null)
  }

  const selectAllFiltered = () => {
    const ids = filteredOrders.map(o => o.id)
    const merged = [...new Set([...form.order_ids, ...ids])]
    setForm(f => ({ ...f, order_ids: merged }))
    setValidation(null)
  }
  const clearSelected = () => { setForm(f => ({ ...f, order_ids: [] })); setValidation(null) }

  const runValidation = async () => {
    if (!form.vessel_id || form.order_ids.length === 0) {
      setMsg({ type: 'error', text: '请先选择船只并至少选择一个订单' })
      return
    }
    setValidating(true)
    try {
      const r = await api.post('/stowage/validate', {
        vessel_id: form.vessel_id,
        order_ids: form.order_ids,
        tide_window_id: form.tide_window_id || undefined
      })
      setValidation(r.data.data)
      setMsg(null)
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setValidating(false)
    }
  }

  const submitPlan = async () => {
    if (!validation && !await (async () => { await runValidation(); return true })()) return
    if (submitting) return
    setSubmitting(true)
    try {
      const payload = { ...form, tide_window_id: form.tide_window_id || undefined }
      const r = await api.post('/stowage', payload)
      setMsg({ type: 'success', text: r.data.message })
      setTimeout(() => navigate(`/stowage/${r.data.data.id}`), 1200)
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message })
    } finally { setSubmitting(false) }
  }

  const sevCls = (s: string) => ({
    critical: 'bg-red-50 text-red-700 border-red-200',
    high: 'bg-orange-50 text-orange-700 border-orange-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-sky-50 text-sky-700 border-sky-200',
  }[s] || '')
  const sevIcon = (s: string) => ({ critical: '🚨', high: '⚠️', medium: '⚡', low: 'ℹ️' }[s] || '')
  const sevLabel = (s: string) => ({ critical: '严重', high: '高危', medium: '中等', low: '提示' }[s] || s)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">🧩 创建船期配载计划</h2>
          <p className="text-sm text-slate-500 mt-1">选择船只、货物订单和潮汐窗口，系统自动检查载重、危险品冲突和潮汐窗口</p>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card">
            <div className="card-header"><h3 className="font-semibold text-slate-800">🚢 选择船只与航线</h3></div>
            <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">船只 *</label>
                <select className="input" value={form.vessel_id} onChange={e => { setForm(f => ({ ...f, vessel_id: parseInt(e.target.value) })); setValidation(null) }}>
                  <option value={0}>-- 请选择船只 --</option>
                  {vessels.map(v => <option key={v.id} value={v.id}>{v.name} (载重{v.max_weight}吨 / {v.route || '无固定航线'})</option>)}
                </select>
                {selectedVessel && (
                  <div className="mt-3 p-3 rounded-lg bg-sea-50 border border-sea-100 text-xs space-y-1">
                    <p className="font-semibold text-sea-800 mb-1">📌 {selectedVessel.name} 详情</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
                      <p>IMO: <span className="font-mono">{selectedVessel.imo_number || '-'}</span></p>
                      <p>最大载重: <span className="font-mono">{selectedVessel.max_weight}吨</span></p>
                      <p>船舱容积: <span className="font-mono">{selectedVessel.max_volume?.toLocaleString() || '-'}m³</span></p>
                      <p>吃水深度: <span className="font-mono">{selectedVessel.draft || '-'}m</span></p>
                      <p>20'箱: <span className="font-mono">{selectedVessel.capacity_20ft || 0}</span></p>
                      <p>40'箱: <span className="font-mono">{selectedVessel.capacity_40ft || 0}</span></p>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label">起始港口 *</label>
                  <select className="input" value={form.origin_port} onChange={e => { setForm(f => ({ ...f, origin_port: e.target.value })); setValidation(null) }}>
                    {ports.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">目的港口 *</label>
                  <select className="input" value={form.destination_port} onChange={e => { setForm(f => ({ ...f, destination_port: e.target.value })); setValidation(null) }}>
                    {ports.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">航次编号</label>
                  <input className="input" placeholder="如 VOY2026-0601" value={form.voyage_no} onChange={e => setForm(f => ({ ...f, voyage_no: e.target.value }))} />
                </div>
                <div>
                  <label className="label">🌊 潮汐窗口（{form.origin_port}）</label>
                  <select className="input" value={form.tide_window_id} onChange={e => { setForm(f => ({ ...f, tide_window_id: e.target.value ? parseInt(e.target.value) : '' })); setValidation(null) }}>
                    <option value="">-- 不限制 / 稍后选择 --</option>
                    {filteredTides.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.date} {t.high_tide_start}-{t.high_tide_end} ({t.notes}) 最大吃水{t.max_draft}m
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="font-semibold text-slate-800">📦 选择配载货物订单</h3>
                <p className="text-xs text-slate-500 mt-0.5">已选择 <b className="text-sea-600">{form.order_ids.length}</b> 单</p>
              </div>
              <div className="flex items-center gap-2">
                <select className="input w-32 text-xs" value={portFilter} onChange={e => setPortFilter(e.target.value)}>
                  <option value="">全部港口</option>
                  {ports.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <button className="btn-ghost text-xs" onClick={selectAllFiltered}>全选筛选</button>
                <button className="btn-ghost text-xs" onClick={clearSelected}>清空</button>
              </div>
            </div>
            <div className="card-body p-0 max-h-[500px] overflow-y-auto">
              <table className="table">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="w-10">✓</th>
                    <th>订单号</th><th>货主/货物</th><th>重量</th><th>港口</th><th>交货期</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-slate-400">暂无待配载订单</td></tr>
                  ) : filteredOrders.map(o => {
                    const checked = form.order_ids.includes(o.id)
                    return (
                      <tr key={o.id} className={checked ? 'bg-sea-50/60' : ''}>
                        <td>
                          <input type="checkbox" className="w-4 h-4 rounded text-sea-600"
                            checked={checked} onChange={() => toggleOrder(o.id)} />
                        </td>
                        <td className="font-mono text-xs text-sea-600 font-semibold">{o.order_no}</td>
                        <td>
                          <p className="font-medium">{o.cargo_name}</p>
                          <p className="text-xs text-slate-500">{o.customer_name}</p>
                          {o.is_dangerous ? <span className="badge-danger text-[10px] mt-1">⚠ {o.dangerous_category}</span> : null}
                        </td>
                        <td className="font-mono text-right">{o.weight}吨</td>
                        <td className="text-xs whitespace-nowrap">{o.origin_port}<span className="text-slate-400">→</span>{o.destination_port}</td>
                        <td className="text-xs text-slate-600">{o.delivery_deadline || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card sticky top-24">
            <div className="card-header"><h3 className="font-semibold text-slate-800">🔍 校验与提交</h3></div>
            <div className="card-body space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-2">备注信息</p>
                <textarea className="input min-h-[70px] text-sm" placeholder="配载说明、特殊注意事项..."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs font-semibold text-slate-700 mb-2">📊 已选货物汇总</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">订单数</span><span className="font-mono font-semibold">{selectedOrders.length} 单</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">总重量</span><span className="font-mono font-semibold">{selectedOrders.reduce((s, o) => s + o.weight, 0)} 吨</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">总体积</span><span className="font-mono font-semibold">{selectedOrders.reduce((s, o) => s + (o.volume || 0), 0)} m³</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">危险品</span><span className={`font-mono font-semibold ${selectedOrders.some(o => o.is_dangerous) ? 'text-red-600' : 'text-slate-700'}`}>{selectedOrders.filter(o => o.is_dangerous).length} 单</span></div>
                </div>
              </div>

              <button className="btn-secondary w-full" onClick={runValidation} disabled={validating || !form.vessel_id || form.order_ids.length === 0}>
                {validating ? '校验中...' : '🧪 运行冲突检测'}
              </button>

              {validation && (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  <div className={`p-3 rounded-lg text-sm font-medium ${validation.valid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {validation.valid ? '✅ 校验通过，未发现严重冲突' : `❌ 发现 ${validation.conflicts.length} 个冲突问题`}
                  </div>

                  {validation.summary && (
                    <div className="p-3 rounded-lg bg-slate-50 text-xs space-y-1.5">
                      <p className="font-semibold text-slate-700 mb-2">📈 船只利用率</p>
                      <div>
                        <div className="flex justify-between text-slate-500 mb-1"><span>载重</span><span className="font-mono">{validation.summary.totalWeight}/{selectedVessel?.max_weight || 0}吨 ({validation.summary.weightUtilization.toFixed(1)}%)</span></div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${validation.summary.weightUtilization > 100 ? 'bg-red-500' : validation.summary.weightUtilization > 90 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, validation.summary.weightUtilization)}%` }} />
                        </div>
                      </div>
                      {selectedVessel?.max_volume && (
                        <div>
                          <div className="flex justify-between text-slate-500 mb-1 mt-2"><span>容积</span><span className="font-mono">{validation.summary.totalVolume}/{selectedVessel.max_volume}m³ ({validation.summary.volumeUtilization.toFixed(1)}%)</span></div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${validation.summary.volumeUtilization > 100 ? 'bg-red-500' : validation.summary.volumeUtilization > 90 ? 'bg-amber-500' : 'bg-sky-500'}`} style={{ width: `${Math.min(100, validation.summary.volumeUtilization)}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {validation.conflicts.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-700 mb-2">🚨 冲突 ({validation.conflicts.length})</p>
                      <div className="space-y-1.5">
                        {validation.conflicts.map((c, i) => (
                          <div key={`c${i}`} className={`p-2.5 rounded-lg border text-xs ${sevCls(c.severity)}`}>
                            <p className="font-semibold flex items-center gap-1">
                              <span>{sevIcon(c.severity)}</span>
                              <span>{sevLabel(c.severity)}</span>
                              <span className="ml-1 opacity-70">· {c.type}</span>
                            </p>
                            <p className="mt-1 leading-relaxed">{c.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {validation.warnings.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-700 mb-2">⚡ 警告 ({validation.warnings.length})</p>
                      <div className="space-y-1.5">
                        {validation.warnings.map((w, i) => (
                          <div key={`w${i}`} className={`p-2.5 rounded-lg border text-xs ${sevCls(w.severity)}`}>
                            <p className="font-semibold flex items-center gap-1">
                              <span>{sevIcon(w.severity)}</span>
                              <span>{sevLabel(w.severity)}</span>
                            </p>
                            <p className="mt-1 leading-relaxed">{w.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button className="btn-primary w-full" onClick={submitPlan} disabled={submitting || form.order_ids.length === 0 || !form.vessel_id}>
                {submitting ? '提交中...' : (validation ? (validation.valid ? '✅ 确认创建配载计划' : '⚠️ 仍要创建（存在冲突）') : '创建配载计划')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
