import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { Stats, StowagePlan, CargoOrder } from '../types'

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentPlans, setRecentPlans] = useState<StowagePlan[]>([])
  const [urgentOrders, setUrgentOrders] = useState<CargoOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/stowage/stats'),
      api.get('/stowage?confirmed=false&status=draft'),
      api.get('/orders?status=pending'),
    ]).then(([s, p, o]) => {
      setStats(s.data.data)
      setRecentPlans(p.data.data.slice(0, 6))
      const ords: CargoOrder[] = o.data.data
      const today = new Date('2026-06-11').getTime()
      const urgent = ords
        .filter(x => x.delivery_deadline && new Date(x.delivery_deadline).getTime() - today <= 5 * 86400000)
        .sort((a, b) => new Date(a.delivery_deadline!).getTime() - new Date(b.delivery_deadline!).getTime())
        .slice(0, 6)
      setUrgentOrders(urgent)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-20 text-slate-500">加载中...</div>

  const statCards = stats ? [
    { label: '在役船只', value: stats.totalVessels, icon: '🚢', color: 'from-blue-500 to-indigo-500', to: '/vessels' },
    { label: '待配载订单', value: stats.pendingOrders, icon: '📦', color: 'from-amber-500 to-orange-500', to: '/orders' },
    { label: '待确认计划', value: stats.draftPlans, icon: '📋', color: 'from-purple-500 to-pink-500', to: '/stowage' },
    { label: '已确认计划', value: stats.confirmedPlans, icon: '✅', color: 'from-emerald-500 to-teal-500', to: '/stowage?confirmed=true' },
    { label: '今日潮汐窗口', value: stats.todayTides, icon: '🌊', color: 'from-cyan-500 to-sky-500', to: '/config' },
    { label: '待处理危险品', value: stats.dangerousOrders, icon: '⚠️', color: 'from-red-500 to-rose-500', to: '/orders?dangerous=true' },
  ] : []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">调度工作台</h2>
        <p className="text-sm text-slate-500 mt-1">实时掌握船只、订单与配载计划状态，今天是 2026-06-11 周四</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map(c => (
          <Link key={c.label} to={c.to} className="stat-card hover:shadow-md transition-shadow group">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-xl shadow-sm`}>
              {c.icon}
            </div>
            <p className="stat-label mt-3">{c.label}</p>
            <div className="flex items-baseline gap-1">
              <p className="stat-value">{c.value}</p>
              <span className="text-slate-400 text-xs group-hover:text-sea-600">→</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-800">📋 待确认配载计划</h3>
            <Link to="/stowage/create" className="text-sm text-sea-600 hover:text-sea-700 font-medium">+ 新建</Link>
          </div>
          <div className="card-body p-0">
            {recentPlans.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">暂无待确认计划</div>
            ) : (
              <table className="table">
                <thead><tr><th>计划编号</th><th>船只</th><th>航线</th><th>总重</th><th>状态</th></tr></thead>
                <tbody>
                  {recentPlans.map(p => (
                    <tr key={p.id} className="cursor-pointer" onClick={() => window.location.href = `/stowage/${p.id}`}>
                      <td className="font-mono text-xs text-sea-600 font-semibold">{p.plan_no}</td>
                      <td>{p.vessel_name}</td>
                      <td className="text-xs text-slate-500">{p.origin_port} → {p.destination_port}</td>
                      <td>{p.total_weight.toFixed(0)}吨</td>
                      <td>
                        {p.captain_confirmed ? <span className="badge-success">已确认</span> : <span className="badge-warning">待确认</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-800">🚨 交货期紧迫订单</h3>
            <Link to="/orders" className="text-sm text-sea-600 hover:text-sea-700 font-medium">查看全部</Link>
          </div>
          <div className="card-body p-0">
            {urgentOrders.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">暂无紧迫订单 👍</div>
            ) : (
              <table className="table">
                <thead><tr><th>订单号</th><th>货主/货物</th><th>航线</th><th>期限</th></tr></thead>
                <tbody>
                  {urgentOrders.map(o => {
                    const days = Math.ceil((new Date(o.delivery_deadline!).getTime() - new Date('2026-06-11').getTime()) / 86400000)
                    return (
                      <tr key={o.id}>
                        <td className="font-mono text-xs text-sea-600 font-semibold">{o.order_no}</td>
                        <td>
                          <p className="font-medium">{o.customer_name}</p>
                          <p className="text-xs text-slate-500">{o.cargo_name}</p>
                        </td>
                        <td className="text-xs text-slate-500">{o.origin_port} → {o.destination_port}</td>
                        <td>
                          <span className={days < 0 ? 'badge-danger' : days <= 2 ? 'badge-warning' : 'badge-info'}>
                            {days < 0 ? `逾期${-days}天` : `剩${days}天`}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-800">💡 快速操作指南</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { step: 1, title: '录入货主订单', desc: '在「货主订单」中录入货主信息、货物详情、港口与期限', to: '/orders', icon: '📝' },
              { step: 2, title: '维护船只与潮汐', desc: '管理船队载重参数，配置每日潮汐窗口与危险品规则', to: '/vessels', icon: '🚢' },
              { step: 3, title: '创建配载计划', desc: '选择船只与订单，系统自动检测载重、危险品与潮汐冲突', to: '/stowage/create', icon: '🧩' },
              { step: 4, title: '船长确认与跟踪', desc: '船长确认装船后，客户可查询ETD/ETA预计到港时间', to: '/stowage', icon: '✅' },
            ].map(g => (
              <Link key={g.step} to={g.to} className="p-4 rounded-xl border border-slate-200 hover:border-sea-300 hover:bg-sea-50/40 transition-colors group">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-7 h-7 rounded-lg bg-sea-100 text-sea-700 flex items-center justify-center font-bold text-sm">
                    {g.step}
                  </span>
                  <span className="text-xl">{g.icon}</span>
                </div>
                <h4 className="font-semibold text-slate-800 mb-1">{g.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{g.desc}</p>
                <p className="text-xs text-sea-600 mt-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity">前往 →</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
