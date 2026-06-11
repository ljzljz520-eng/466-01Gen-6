import { useState } from 'react'
import api from '../api/client'

export default function CustomerSearch() {
  const [query, setQuery] = useState({ order_no: '', customer_name: '', phone: '' })
  const [results, setResults] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const search = async () => {
    if (!query.order_no && !query.customer_name && !query.phone) {
      alert('请至少输入一项查询条件')
      return
    }
    setLoading(true); setSearched(true)
    try {
      const params = new URLSearchParams()
      if (query.order_no) params.set('order_no', query.order_no.trim())
      if (query.customer_name) params.set('customer_name', query.customer_name.trim())
      if (query.phone) params.set('phone', query.phone.trim())
      const r = await api.get(`/stowage/customer/search?${params}`)
      setResults(r.data.data)
    } finally { setLoading(false) }
  }

  const demoQueries = [
    { label: '示例：按订单号查询', q: { order_no: 'ORD202606001', customer_name: '', phone: '' } },
    { label: '示例：按货主查询', q: { order_no: '', customer_name: '青岛海洋食品', phone: '' } },
    { label: '示例：按电话查询', q: { order_no: '', customer_name: '', phone: '13800138001' } },
  ]

  return (
    <div className="space-y-8 py-2">
      <div className="text-center">
        <div className="inline-flex items-center gap-3 px-6 py-4 rounded-3xl bg-gradient-to-br from-sea-50 via-sky-50 to-emerald-50 border border-sea-200 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sea-500 to-emerald-500 flex items-center justify-center text-3xl shadow-md">🧑‍💼</div>
          <div className="text-left">
            <h2 className="text-2xl font-bold text-slate-800">客户货期查询</h2>
            <p className="text-sm text-slate-500">输入订单信息，实时查询您的货物动态与船期安排</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="card p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">📦 订单号</label>
              <input className="input" placeholder="如：ORD202606001"
                value={query.order_no} onChange={e => setQuery({ ...query, order_no: e.target.value })} />
            </div>
            <div>
              <label className="label">🏢 货主名称</label>
              <input className="input" placeholder="如：青岛海洋食品"
                value={query.customer_name} onChange={e => setQuery({ ...query, customer_name: e.target.value })} />
            </div>
            <div>
              <label className="label">📞 联系电话</label>
              <input className="input" placeholder="如：13800138001"
                value={query.phone} onChange={e => setQuery({ ...query, phone: e.target.value })} />
            </div>
          </div>
          <button className="btn-primary w-full mt-5 !py-3 text-base" onClick={search} disabled={loading}>
            {loading ? '查询中...' : '🔍 查询我的货物'}
          </button>

          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2">快速体验：</p>
            <div className="flex flex-wrap gap-2">
              {demoQueries.map((d, i) => (
                <button key={i} className="btn-ghost text-xs !px-3 !py-1.5 bg-slate-50"
                  onClick={() => setQuery(d.q)}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {searched && !loading && (
        <div className="max-w-4xl mx-auto">
          {!results || results.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-slate-600 font-medium">未找到匹配的订单</p>
              <p className="text-sm text-slate-400 mt-1">请检查订单号、货主名称或联系电话是否正确</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">找到 <b className="text-sea-600">{results.length}</b> 个匹配订单：</p>
              {results.map((r, idx) => (
                <div key={idx} className="card overflow-hidden">
                  <div className="bg-gradient-to-r from-slate-50 to-sea-50/40 px-6 py-4 border-b border-slate-200 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-mono font-bold text-lg text-sea-700">{r.order.order_no}</h3>
                        {r.order.status === 'shipped' && <span className="badge-success">🚢 已发运</span>}
                        {r.order.status === 'stowed' && <span className="badge-info">📋 已配载</span>}
                        {r.order.status === 'pending' && <span className="badge-warning">⏳ 待配载</span>}
                        {r.order.status === 'delivered' && <span className="badge-secondary">✅ 已交付</span>}
                      </div>
                      <p className="text-sm text-slate-700 mt-1">
                        <b>{r.order.customer_name}</b> · {r.order.cargo_name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        📞 {r.order.customer_contact || '未留号码'} · 重量 {r.order.weight} 吨
                        {r.order.is_dangerous && <span className="ml-2 text-red-600 font-semibold">⚠ 危险品: {r.order.dangerous_category}</span>}
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-slate-500">起运港 → 目的港</p>
                      <p className="font-semibold text-base text-slate-800 mt-0.5">
                        <span className="text-sea-700">{r.order.origin_port}</span>
                        <span className="mx-2 text-slate-400">→</span>
                        <span className="text-emerald-700">{r.order.destination_port}</span>
                      </p>
                      {r.order.delivery_deadline && <p className="text-xs text-slate-500 mt-1">📅 交货期：{r.order.delivery_deadline}</p>}
                    </div>
                  </div>

                  <div className="p-6">
                    {r.plans.length === 0 ? (
                      <div className="py-6 text-center text-slate-500 bg-slate-50 rounded-xl">
                        <div className="text-3xl mb-2">⏳</div>
                        <p className="font-medium">该订单暂未安排船期</p>
                        <p className="text-xs text-slate-400 mt-1">码头调度员正在为您配载，请稍后再查</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {r.plans.map((p: any, pIdx: number) => (
                          <div key={pIdx} className="border border-slate-200 rounded-xl overflow-hidden">
                            <div className="bg-gradient-to-r from-sea-600 to-sky-600 text-white px-5 py-3 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <span className="text-xl">🚢</span>
                                <div>
                                  <p className="font-bold">{p.vessel_name}</p>
                                  <p className="text-xs text-sea-100 font-mono opacity-90">IMO {p.imo_number} · 航次 {p.voyage_no || '-'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{p.plan_no}</span>
                                {p.captain_confirmed ? <span className="text-xs bg-emerald-400 text-emerald-900 px-2 py-0.5 rounded-full font-semibold">✓ 船长已确认</span> : <span className="text-xs bg-amber-300 text-amber-900 px-2 py-0.5 rounded-full font-semibold">待确认</span>}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                              <div className="p-5">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-lg">🛫</div>
                                  <div>
                                    <p className="text-xs text-slate-500">预计离港时间 ETD</p>
                                    <p className={`font-mono font-bold text-lg ${p.captain_confirmed ? 'text-amber-700' : 'text-amber-600'}`}>
                                      {p.etd || '待确认'}
                                    </p>
                                  </div>
                                </div>
                                <div className="relative pl-4">
                                  <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gradient-to-b from-amber-300 via-slate-300 to-emerald-300" />
                                  <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-slate-400 border-2 border-white" />
                                </div>
                              </div>
                              <div className="p-5">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-lg">🛬</div>
                                  <div>
                                    <p className="text-xs text-slate-500">预计到港时间 ETA</p>
                                    <p className={`font-mono font-bold text-lg ${p.captain_confirmed ? 'text-emerald-700' : 'text-emerald-600'}`}>
                                      {p.eta || '待计算'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-xs text-slate-500">
                                  <p>航线：<span className="font-medium text-slate-700">{p.origin_port} → {p.destination_port}</span></p>
                                  <p className="mt-1">
                                    计划状态：
                                    {p.plan_status === 'confirmed' ? <span className="text-emerald-600 font-semibold">已确认</span> :
                                      p.plan_status === 'sailed' ? <span className="text-sea-600 font-semibold">已开航</span> :
                                        p.plan_status === 'arrived' ? <span className="text-slate-700 font-semibold">已到港</span> :
                                          <span className="text-amber-600 font-semibold">待确认</span>}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {p.captain_name && (
                              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex flex-wrap items-center gap-4">
                                <span>🧑‍✈️ 船长确认：<b className="text-slate-700">{p.captain_name}</b></span>
                                <span>🕐 确认时间：<b className="text-slate-700 font-mono">{p.confirmed_at}</b></span>
                              </div>
                            )}

                            {!p.captain_confirmed && (
                              <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-700">
                                ⏳ ETD/ETA 时间为预估值，待船长确认装船后将正式生效
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <footer className="max-w-4xl mx-auto text-center text-xs text-slate-400 pt-6 border-t border-slate-100">
        <p>近海小船船期配载系统 · 客户自助查询平台 © 2026</p>
        <p className="mt-1">如有疑问请联系码头调度中心</p>
      </footer>
    </div>
  )
}
