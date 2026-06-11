import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { StowagePlan } from '../types'

export default function StowagePlans() {
  const [plans, setPlans] = useState<StowagePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: 'all', confirmed: '' })
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null)
  const navigate = useNavigate()

  const refresh = () => {
    const p = new URLSearchParams()
    if (filters.status && filters.status !== 'all') p.set('status', filters.status)
    if (filters.confirmed) p.set('confirmed', filters.confirmed)
    api.get(`/stowage?${p}`).then(r => setPlans(r.data.data)).finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [filters])

  const remove = async (p: StowagePlan) => {
    if (!confirm(`确定删除配载计划「${p.plan_no}」？订单状态将恢复为待配载。`)) return
    try {
      const r = await api.delete(`/stowage/${p.id}`)
      setMsg({ type: 'success', text: r.data.message })
      refresh()
      setTimeout(() => setMsg(null), 3000)
    } catch (err: any) { setMsg({ type: 'error', text: err.message }) }
  }

  const statusMap: Record<string, { label: string; cls: string }> = {
    draft: { label: '草稿', cls: 'badge-secondary' },
    confirmed: { label: '已确认', cls: 'badge-success' },
    sailed: { label: '已开航', cls: 'badge-info' },
    arrived: { label: '已到港', cls: 'badge-secondary' },
    cancelled: { label: '已取消', cls: 'badge-danger' },
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">📋 配载计划</h2>
          <p className="text-sm text-slate-500 mt-1">管理所有船期配载计划，查看冲突报告、确认装船状态</p>
        </div>
        <Link to="/stowage/create" className="btn-primary">+ 创建配载计划</Link>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
          <select className="input w-36" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="confirmed">已确认</option>
            <option value="sailed">已开航</option>
            <option value="arrived">已到港</option>
          </select>
          <select className="input w-40" value={filters.confirmed} onChange={e => setFilters({ ...filters, confirmed: e.target.value })}>
            <option value="">船长确认状态</option>
            <option value="true">已确认</option>
            <option value="false">未确认</option>
          </select>
          <div className="ml-auto text-sm text-slate-500">共 {plans.length} 条</div>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>计划编号</th><th>船只</th><th>航线</th><th>ETD</th><th>ETA</th>
                <th>总重(吨)</th><th>船长确认</th><th>状态</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-400">加载中...</td></tr>
              ) : plans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16">
                    <div className="text-5xl mb-3">📋</div>
                    <p className="text-slate-500 mb-4">暂无配载计划，开始创建你的第一个船期计划吧</p>
                    <Link to="/stowage/create" className="btn-primary">+ 创建配载计划</Link>
                  </td>
                </tr>
              ) : plans.map(p => (
                <tr key={p.id} className="cursor-pointer" onClick={() => navigate(`/stowage/${p.id}`)}>
                  <td className="font-mono text-xs text-sea-600 font-semibold">{p.plan_no}</td>
                  <td>
                    <p className="font-semibold">{p.vessel_name}</p>
                    {p.voyage_no && <p className="text-xs text-slate-500 font-mono">航次：{p.voyage_no}</p>}
                  </td>
                  <td className="text-xs whitespace-nowrap"><span className="text-slate-700">{p.origin_port}</span> <span className="text-slate-400">→</span> <span className="text-slate-700">{p.destination_port}</span></td>
                  <td className="text-xs text-slate-600 whitespace-nowrap font-mono">{p.etd || '-'}</td>
                  <td className="text-xs text-slate-600 whitespace-nowrap font-mono">{p.eta || '-'}</td>
                  <td className="text-right font-mono">{p.total_weight.toLocaleString()}</td>
                  <td>
                    {p.captain_confirmed ? (
                      <div>
                        <span className="badge-success">✓ 已确认</span>
                        {p.captain_name && <p className="text-xs text-slate-500 mt-0.5">{p.captain_name}</p>}
                      </div>
                    ) : <span className="badge-warning">待确认</span>}
                  </td>
                  <td><span className={statusMap[p.status]?.cls}>{statusMap[p.status]?.label}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex gap-2">
                      <Link to={`/stowage/${p.id}`} className="text-sea-600 hover:text-sea-700 text-sm">查看</Link>
                      {!p.captain_confirmed && (
                        <button className="text-red-500 hover:text-red-600 text-sm" onClick={() => remove(p)}>删除</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
