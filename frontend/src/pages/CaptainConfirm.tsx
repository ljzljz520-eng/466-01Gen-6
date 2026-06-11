import { useEffect, useState } from 'react'
import api from '../api/client'
import { StowagePlan, CargoOrder } from '../types'

export default function CaptainConfirm() {
  const [plans, setPlans] = useState<StowagePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<StowagePlan | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [captainName, setCaptainName] = useState('')
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [search, setSearch] = useState('')

  const loadList = () => {
    api.get('/stowage').then(r => setPlans(r.data.data)).finally(() => setLoading(false))
  }

  useEffect(() => { loadList() }, [])

  const pendingPlans = plans.filter(p => !p.captain_confirmed && p.status !== 'cancelled')
    .filter(p => !search || p.plan_no.includes(search) || (p.vessel_name || '').includes(search))
  const confirmedPlans = plans.filter(p => p.captain_confirmed)
    .filter(p => !search || p.plan_no.includes(search) || (p.vessel_name || '').includes(search))

  const selectPlan = async (p: StowagePlan) => {
    setSelected(p)
    const r = await api.get(`/stowage/${p.id}`)
    setDetail(r.data.data)
  }

  const confirm = async () => {
    if (!captainName.trim()) { setMsg({ type: 'error', text: '请输入船长姓名' }); return }
    if (!selected) return
    setConfirming(true)
    try {
      const r = await api.post(`/stowage/${selected.id}/confirm`, { captain_name: captainName.trim() })
      setMsg({ type: 'success', text: r.data.message })
      setCaptainName('')
      setSelected(null); setDetail(null)
      loadList()
      setTimeout(() => setMsg(null), 3500)
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message })
    } finally { setConfirming(false) }
  }

  const orders: CargoOrder[] = (detail?.items || []).map((i: any) => i.order).filter(Boolean)

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-sea-50 to-sky-50 border border-sea-200">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sea-500 to-sky-600 flex items-center justify-center text-2xl shadow-sm">🧑‍✈️</div>
          <div className="text-left">
            <h2 className="text-2xl font-bold text-slate-800">船长工作台</h2>
            <p className="text-sm text-slate-500">确认装船作业，核对货物清单与航行计划</p>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`max-w-3xl mx-auto p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-slate-800">📋 待确认计划 <span className="badge-warning ml-1">{pendingPlans.length}</span></h3>
              <input className="input !w-36 text-xs" placeholder="搜索..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="card-body p-0 max-h-[320px] overflow-y-auto">
              {loading ? <div className="text-center py-10 text-slate-400 text-sm">加载中...</div> :
                pendingPlans.length === 0 ? <div className="text-center py-10 text-slate-400 text-sm">✅ 没有待确认的计划</div> : (
                  <div className="divide-y divide-slate-100">
                    {pendingPlans.map(p => (
                      <button key={p.id} className={`w-full text-left px-4 py-3 hover:bg-sea-50 transition-colors ${selected?.id === p.id ? 'bg-sea-50 border-l-4 border-sea-500' : ''}`}
                        onClick={() => selectPlan(p)}>
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-sm text-sea-600 font-semibold">{p.plan_no}</p>
                          <span className="badge-warning text-[10px]">待确认</span>
                        </div>
                        <p className="font-semibold text-slate-800 mt-0.5">🚢 {p.vessel_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{p.origin_port} → {p.destination_port} · {p.total_weight}吨</p>
                        <p className="text-xs font-mono text-amber-700 mt-0.5">ETD {p.etd} / ETA {p.eta}</p>
                      </button>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {confirmedPlans.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="font-semibold text-slate-800">✅ 已确认 ({confirmedPlans.length})</h3></div>
              <div className="card-body p-0 max-h-[250px] overflow-y-auto">
                <div className="divide-y divide-slate-100">
                  {confirmedPlans.slice(0, 10).map(p => (
                    <button key={p.id} className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${selected?.id === p.id ? 'bg-slate-50 border-l-4 border-emerald-500' : ''}`}
                      onClick={() => selectPlan(p)}>
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-xs text-slate-600">{p.plan_no}</p>
                        <span className="badge-success text-[10px]">{p.captain_name}</span>
                      </div>
                      <p className="font-semibold text-sm text-slate-800 mt-0.5">{p.vessel_name} · {p.origin_port}→{p.destination_port}</p>
                      <p className="text-xs font-mono text-emerald-700 mt-0.5">ETA {p.eta}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          {!selected ? (
            <div className="card h-full flex items-center justify-center min-h-[480px]">
              <div className="text-center py-16">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-slate-500 mb-2">从左侧选择一个配载计划</p>
                <p className="text-sm text-slate-400">查看货物清单、核对信息、确认装船</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="font-semibold text-slate-800">{detail?.plan_no || selected.plan_no} · 装船确认</h3>
                  <p className="text-xs text-slate-500 mt-0.5">请仔细核对以下信息后完成确认</p>
                </div>
                {selected.captain_confirmed ? <span className="badge-success">✓ 已确认</span> : <span className="badge-warning">待确认</span>}
              </div>

              <div className="card-body space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-gradient-to-br from-sea-50 to-sky-50 border border-sea-100">
                  <div>
                    <p className="text-xs text-slate-500">船只</p>
                    <p className="font-bold text-lg text-slate-800 mt-1">{selected.vessel_name}</p>
                    <p className="text-xs font-mono text-slate-500">{detail?.vessel?.imo_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">航线</p>
                    <p className="font-bold mt-1"><span className="text-sea-700">{selected.origin_port}</span> <span className="text-slate-400">→</span> <span className="text-sea-700">{selected.destination_port}</span></p>
                    <p className="text-xs text-slate-500 mt-0.5">{detail?.vessel?.route}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">🛫 预计离港 ETD</p>
                    <p className="font-mono font-bold text-amber-700 mt-1">{selected.etd}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">🛬 预计到港 ETA</p>
                    <p className="font-mono font-bold text-emerald-700 mt-1">{selected.eta}</p>
                  </div>
                </div>

                {detail?.tide_window && (
                  <div className="p-3 rounded-lg bg-cyan-50 border border-cyan-200 text-sm flex items-center gap-3">
                    <span className="text-2xl">🌊</span>
                    <div>
                      <p className="font-semibold text-cyan-800">潮汐窗口</p>
                      <p className="text-xs text-cyan-700 mt-0.5">
                        {detail.tide_window.port_name} · {detail.tide_window.date} {detail.tide_window.high_tide_start}-{detail.tide_window.high_tide_end}
                        · 最大吃水 {detail.tide_window.max_draft}m {detail.tide_window.notes && `(${detail.tide_window.notes})`}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-slate-800">📦 货物清单 ({orders.length}单)</h4>
                    <p className="text-xs text-slate-500">
                      总重 <b className="font-mono">{selected.total_weight}</b> 吨 · 总体积 <b className="font-mono">{selected.total_volume}</b> m³
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="table text-xs">
                      <thead>
                        <tr><th>#</th><th>订单号</th><th>货主 / 货物</th><th>重量</th><th>目的地</th></tr>
                      </thead>
                      <tbody>
                        {orders.map((o: CargoOrder, i: number) => (
                          <tr key={o.id}>
                            <td className="text-slate-400">{i + 1}</td>
                            <td className="font-mono text-sea-600">{o.order_no}</td>
                            <td>
                              <p className="font-medium">{o.cargo_name}</p>
                              <p className="text-slate-500 text-[11px]">{o.customer_name}</p>
                              {o.is_dangerous && <span className="badge-danger text-[9px] mt-0.5">⚠ {o.dangerous_category}</span>}
                            </td>
                            <td className="font-mono text-right">{o.weight}吨</td>
                            <td>{o.destination_port}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selected.captain_confirmed ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                    <p className="text-3xl mb-1">✅</p>
                    <p className="font-semibold text-emerald-800">装船确认已完成</p>
                    <p className="text-xs text-emerald-700 mt-1">
                      船长 <b>{selected.captain_name}</b> · 确认时间 {selected.confirmed_at}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">客户现在可以查询到 ETD/ETA 预计到港时间</p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">✍️</span>
                      <div className="flex-1">
                        <label className="label text-xs font-semibold text-amber-900">船长签字确认 *</label>
                        <div className="flex gap-3 mt-2">
                          <input className="input bg-white" placeholder="请输入船长姓名"
                            value={captainName} onChange={e => setCaptainName(e.target.value)} />
                          <button className="btn-success shrink-0" onClick={confirm} disabled={confirming}>
                            {confirming ? '提交中...' : '✅ 确认装船'}
                          </button>
                        </div>
                        <p className="text-xs text-amber-700 mt-2">
                          确认后订单将标记为「已发运」，ETD/ETA时间将同步给货主客户查询。
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
