import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../api/client'
import { StowagePlan, CargoOrder } from '../types'

export default function StowageDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<StowagePlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null)
  const [captainName, setCaptainName] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const refresh = () => {
    api.get(`/stowage/${id}`).then(r => setPlan(r.data.data)).finally(() => setLoading(false))
  }
  useEffect(() => { refresh() }, [id])

  const confirmByCaptain = async () => {
    if (!captainName.trim()) { setMsg({ type: 'error', text: '请输入船长姓名' }); return }
    try {
      const r = await api.post(`/stowage/${id}/confirm`, { captain_name: captainName.trim() })
      setMsg({ type: 'success', text: r.data.message })
      setShowConfirm(false)
      refresh()
      setTimeout(() => setMsg(null), 3000)
    } catch (err: any) { setMsg({ type: 'error', text: err.message }) }
  }

  const changeStatus = async (status: string) => {
    try {
      await api.post(`/stowage/${id}/status`, { status })
      refresh()
    } catch (err: any) { setMsg({ type: 'error', text: err.message }) }
  }

  const sevCls = (s: string) => ({
    critical: 'bg-red-50 text-red-700 border-red-200',
    high: 'bg-orange-50 text-orange-700 border-orange-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-sky-50 text-sky-700 border-sky-200',
  }[s] || '')
  const sevIcon = (s: string) => ({ critical: '🚨', high: '⚠️', medium: '⚡', low: 'ℹ️' }[s] || '')

  if (loading) return <div className="text-center py-20 text-slate-500">加载中...</div>
  if (!plan) return <div className="text-center py-20 text-slate-500">配载计划不存在</div>

  const orders = (plan.items || []).map((i: any) => i.order as CargoOrder).filter(Boolean)
  const severeConflicts = (plan.conflict_reports || []).filter((c: any) => c.severity === 'critical' || c.severity === 'high')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/stowage" className="btn-ghost !px-2">← 返回</Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">配载计划详情</h2>
            <p className="text-sm text-slate-500 mt-1 font-mono">{plan.plan_no} {plan.voyage_no && `· 航次 ${plan.voyage_no}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!plan.captain_confirmed ? (
            severeConflicts.length > 0 ? (
              <div className="text-sm text-red-600 font-medium">⚠ 存在 {severeConflicts.length} 个冲突，需先处理</div>
            ) : (
              <button className="btn-success" onClick={() => setShowConfirm(true)}>✓ 船长确认装船</button>
            )
          ) : (
            <div className="text-sm text-emerald-700 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg">
              ✅ {plan.captain_name} 已确认 · {plan.confirmed_at}
            </div>
          )}
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
            <div className="card-header"><h3 className="font-semibold text-slate-800">🚢 船只与航线</h3></div>
            <div className="card-body">
              {plan.vessel && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">船只</p>
                    <p className="font-semibold text-lg text-slate-800 mt-1">{plan.vessel.name}</p>
                    <p className="text-xs font-mono text-slate-500">{plan.vessel.imo_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">航线</p>
                    <p className="font-semibold mt-1"><span className="text-sea-700">{plan.origin_port}</span> <span className="text-slate-400 mx-1">→</span> <span className="text-sea-700">{plan.destination_port}</span></p>
                    <p className="text-xs text-slate-500 mt-0.5">常规：{plan.vessel.route}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">预计离港 ETD</p>
                    <p className="font-mono font-semibold text-amber-700 mt-1">{plan.etd || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">预计到港 ETA</p>
                    <p className="font-mono font-semibold text-emerald-700 mt-1">{plan.eta || '-'}</p>
                  </div>
                </div>
              )}
              {plan.tide_window && (
                <div className="mt-4 pt-4 border-t border-slate-100 p-3 rounded-lg bg-sea-50/60 border border-sea-100">
                  <p className="text-xs font-semibold text-sea-800 mb-1.5">🌊 选择潮汐窗口</p>
                  <p className="text-sm text-slate-700">
                    {plan.tide_window.port_name} · {plan.tide_window.date} {plan.tide_window.high_tide_start}-{plan.tide_window.high_tide_end} ({plan.tide_window.notes})
                    · 最大吃水 {plan.tide_window.max_draft}m
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-slate-800">📦 配载货物清单 ({orders.length}单)</h3>
              <div className="text-sm text-slate-500">
                总重 <b className="font-mono text-slate-800">{plan.total_weight.toLocaleString()}</b> 吨 ·
                总体积 <b className="font-mono text-slate-800">{plan.total_volume.toLocaleString()}</b> m³
              </div>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th><th>订单号</th><th>货主</th><th>货物</th><th>重量</th>
                    <th>港口</th><th>交货期</th><th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o: CargoOrder, i: number) => (
                    <tr key={o.id}>
                      <td className="text-slate-400 text-xs">{i + 1}</td>
                      <td className="font-mono text-xs text-sea-600 font-semibold">{o.order_no}</td>
                      <td>
                        <p className="font-medium">{o.customer_name}</p>
                        {o.customer_contact && <p className="text-xs text-slate-500">☎ {o.customer_contact}</p>}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <p>{o.cargo_name}</p>
                          {o.is_dangerous ? <span className="badge-danger text-[10px]">⚠ {o.dangerous_category}</span> : <span className="badge-secondary text-[10px]">{o.cargo_type}</span>}
                        </div>
                      </td>
                      <td className="font-mono text-right">{o.weight}吨</td>
                      <td className="text-xs whitespace-nowrap">{o.origin_port}<span className="text-slate-400">→</span>{o.destination_port}</td>
                      <td className="text-xs text-slate-600">{o.delivery_deadline || '-'}</td>
                      <td>
                        {o.status === 'stowed' && <span className="badge-info">已配载</span>}
                        {o.status === 'shipped' && <span className="badge-success">已发运</span>}
                        {o.status === 'pending' && <span className="badge-warning">待配载</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(plan.conflict_reports?.length || 0) > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-slate-800">⚠️ 冲突与警告报告 ({plan.conflict_reports!.length})</h3>
                {severeConflicts.length > 0 && <span className="badge-danger">{severeConflicts.length} 个严重冲突</span>}
              </div>
              <div className="card-body space-y-2">
                {plan.conflict_reports!.map((c: any, i: number) => (
                  <div key={i} className={`p-3 rounded-lg border ${sevCls(c.severity)}`}>
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{sevIcon(c.severity)}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{c.description}</p>
                        <p className="text-xs opacity-70 mt-1">#{c.type} · {c.severity.toUpperCase()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="card">
            <div className="card-header"><h3 className="font-semibold text-slate-800">📊 配载统计</h3></div>
            <div className="card-body space-y-3">
              {plan.vessel && (
                <>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">载重利用率</span>
                      <span className="font-mono font-semibold">{((plan.total_weight / plan.vessel.max_weight) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-sea-500 to-sea-600 rounded-full"
                        style={{ width: `${Math.min(100, (plan.total_weight / plan.vessel.max_weight) * 100)}%` }} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-mono">{plan.total_weight} / {plan.vessel.max_weight} 吨</p>
                  </div>
                  {plan.vessel.max_volume && (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">容积利用率</span>
                        <span className="font-mono font-semibold">{((plan.total_volume / plan.vessel.max_volume) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full"
                          style={{ width: `${Math.min(100, (plan.total_volume / plan.vessel.max_volume) * 100)}%` }} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1 font-mono">{plan.total_volume} / {plan.vessel.max_volume} m³</p>
                    </div>
                  )}
                </>
              )}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                <div className="p-2 rounded bg-slate-50">
                  <p className="text-slate-500">危险品</p>
                  <p className="font-mono font-bold text-lg text-red-600 mt-0.5">{orders.filter((o: CargoOrder) => o.is_dangerous).length}</p>
                </div>
                <div className="p-2 rounded bg-slate-50">
                  <p className="text-slate-500">涉及港口</p>
                  <p className="font-bold text-lg text-sea-600 mt-0.5">
                    {new Set([...orders.map((o: CargoOrder) => o.origin_port), ...orders.map((o: CargoOrder) => o.destination_port)]).size}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="font-semibold text-slate-800">📋 计划状态管理</h3></div>
            <div className="card-body space-y-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { k: 'draft', l: '草稿', cls: 'btn-secondary' },
                  { k: 'confirmed', l: '已确认', cls: 'btn-success' },
                  { k: 'sailed', l: '已开航', cls: 'btn-primary' },
                  { k: 'arrived', l: '已到港', cls: 'btn-secondary' },
                  { k: 'cancelled', l: '已取消', cls: 'btn-danger' },
                ].map(s => (
                  <button key={s.k} className={`${s.cls} !px-3 !py-1.5 text-xs ${plan.status === s.k ? 'ring-2 ring-offset-1 ring-sea-500' : ''}`}
                    onClick={() => changeStatus(s.k)}>
                    {s.l}
                  </button>
                ))}
              </div>
              {plan.notes && (
                <div className="p-3 rounded-lg bg-slate-50 text-sm">
                  <p className="text-xs text-slate-500 mb-1">备注</p>
                  <p className="text-slate-700">{plan.notes}</p>
                </div>
              )}
              <div className="text-xs text-slate-400 border-t border-slate-100 pt-2">
                创建于 {plan.created_at}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-lg text-slate-800">🧑‍✈️ 船长确认装船</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                请输入船长姓名以确认已完成装船作业，确认后将生成正式的 ETD/ETA 时间供客户查询。
              </p>
              <div>
                <label className="label">船长姓名 *</label>
                <input className="input" placeholder="请输入船长姓名" value={captainName} onChange={e => setCaptainName(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button className="btn-secondary" onClick={() => setShowConfirm(false)}>取消</button>
                <button className="btn-success" onClick={confirmByCaptain}>确认装船</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
