import { useEffect, useState } from 'react'
import api from '../api/client'
import { CargoOrder } from '../types'

const dangerousCategories = ['爆炸品', '易燃气体', '毒性气体', '易燃液体', '易燃固体', '氧化性物质', '有机过氧化物', '毒性物质', '放射性物质', '腐蚀性物质']
const cargoTypes = ['普通货', '冷藏货', '贵重货', '食品类货物', '鲜活货', '散货', '危险品']
const containerTypes = ['20FT', '40FT', '40HQ', '散货']
const ports = ['青岛', '烟台', '大连', '天津', '秦皇岛', '营口', '上海', '宁波', '福州', '广州', '深圳', '海口']

export default function Orders() {
  const [orders, setOrders] = useState<CargoOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CargoOrder | null>(null)
  const [filters, setFilters] = useState({ status: 'all', search: '', dangerous: false })
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null)
  const [form, setForm] = useState<any>({
    customer_name: '', customer_contact: '', cargo_name: '', cargo_type: '普通货',
    weight: 0, volume: 0, container_type: '20FT', container_count: 0,
    is_dangerous: 0, dangerous_category: '', un_number: '',
    origin_port: '青岛', destination_port: '烟台', delivery_deadline: '', special_requirements: ''
  })

  const refresh = () => {
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.search) params.set('search', filters.search)
    if (filters.dangerous) params.set('dangerous', 'true')
    api.get(`/orders?${params}`).then(r => setOrders(r.data.data)).finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [filters])

  const openNew = () => {
    setEditing(null)
    setForm({
      customer_name: '', customer_contact: '', cargo_name: '', cargo_type: '普通货',
      weight: 0, volume: 0, container_type: '20FT', container_count: 0,
      is_dangerous: 0, dangerous_category: '', un_number: '',
      origin_port: '青岛', destination_port: '烟台', delivery_deadline: '', special_requirements: ''
    })
    setShowForm(true)
  }
  const openEdit = (o: CargoOrder) => { setEditing(o); setForm({ ...o }); setShowForm(true) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data = { ...form }
      if (!data.is_dangerous) { data.dangerous_category = ''; data.un_number = '' }
      const r = editing ? await api.put(`/orders/${editing.id}`, data) : await api.post('/orders', data)
      setMsg({ type: 'success', text: r.data.message })
      setShowForm(false)
      refresh()
      setTimeout(() => setMsg(null), 3000)
    } catch (err: any) { setMsg({ type: 'error', text: err.message }) }
  }

  const remove = async (o: CargoOrder) => {
    if (!confirm(`确定删除订单「${o.order_no}」？`)) return
    try {
      const r = await api.delete(`/orders/${o.id}`)
      setMsg({ type: 'success', text: r.data.message })
      refresh()
      setTimeout(() => setMsg(null), 3000)
    } catch (err: any) { setMsg({ type: 'error', text: err.message }) }
  }

  const statusMap: Record<string, { label: string; cls: string }> = {
    pending: { label: '待配载', cls: 'badge-warning' },
    stowed: { label: '已配载', cls: 'badge-info' },
    shipped: { label: '已发运', cls: 'badge-success' },
    delivered: { label: '已交付', cls: 'badge-secondary' },
    cancelled: { label: '已取消', cls: 'badge-danger' },
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">📦 货主订单管理</h2>
          <p className="text-sm text-slate-500 mt-1">录入货主订舱信息，包括货物属性、重量体积、危险品申报与港口信息</p>
        </div>
        <button className="btn-primary" onClick={openNew}>+ 录入订单</button>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
          <input className="input w-64" placeholder="🔍 订单号 / 货主 / 货物名" value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })} />
          <select className="input w-36" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
            <option value="all">全部状态</option>
            <option value="pending">待配载</option>
            <option value="stowed">已配载</option>
            <option value="shipped">已发运</option>
            <option value="delivered">已交付</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={filters.dangerous} onChange={e => setFilters({ ...filters, dangerous: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-sea-600 focus:ring-sea-500" />
            仅显示危险品
          </label>
          <div className="ml-auto text-sm text-slate-500">共 {orders.length} 条</div>
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
                <th>订单号</th><th>货主</th><th>货物</th><th>类型</th>
                <th>重量(吨)</th><th>体积(m³)</th><th>装箱</th><th>港口</th>
                <th>交货期</th><th>状态</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="text-center py-10 text-slate-400">加载中...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-10 text-slate-400">暂无订单数据</td></tr>
              ) : orders.map(o => (
                <tr key={o.id}>
                  <td className="font-mono text-xs text-sea-600 font-semibold">{o.order_no}</td>
                  <td>
                    <p className="font-medium">{o.customer_name}</p>
                    {o.customer_contact && <p className="text-xs text-slate-500">☎ {o.customer_contact}</p>}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <p>{o.cargo_name}</p>
                      {o.is_dangerous ? <span className="badge-danger" title={o.dangerous_category || ''}>⚠ {o.dangerous_category}</span> : null}
                    </div>
                  </td>
                  <td><span className="badge-secondary">{o.cargo_type || '-'}</span></td>
                  <td className="text-right font-mono">{o.weight.toLocaleString()}</td>
                  <td className="text-right font-mono">{o.volume?.toLocaleString() || '-'}</td>
                  <td className="text-xs text-slate-600">{o.container_count > 0 ? `${o.container_type} ×${o.container_count}` : (o.container_type || '-')}</td>
                  <td className="text-xs whitespace-nowrap"><span className="text-slate-700">{o.origin_port}</span> <span className="text-slate-400">→</span> <span className="text-slate-700">{o.destination_port}</span></td>
                  <td className="text-xs whitespace-nowrap text-slate-600">{o.delivery_deadline || '-'}</td>
                  <td><span className={statusMap[o.status]?.cls}>{statusMap[o.status]?.label}</span></td>
                  <td>
                    <div className="flex gap-2">
                      <button className="text-sea-600 hover:text-sea-700 text-sm" onClick={() => openEdit(o)}>编辑</button>
                      <button className="text-red-500 hover:text-red-600 text-sm" onClick={() => remove(o)}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-lg text-slate-800">{editing ? '编辑订单' : '录入货主订单'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-5">
              <div className="p-4 rounded-xl bg-slate-50 space-y-4">
                <p className="text-sm font-semibold text-slate-700">👤 货主信息</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">货主名称 *</label><input required className="input" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} /></div>
                  <div><label className="label">联系电话</label><input className="input" value={form.customer_contact || ''} onChange={e => setForm({ ...form, customer_contact: e.target.value })} /></div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/50 space-y-4 border border-amber-100">
                <p className="text-sm font-semibold text-amber-800">📦 货物详情</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">货物名称 *</label><input required className="input" value={form.cargo_name} onChange={e => setForm({ ...form, cargo_name: e.target.value })} /></div>
                  <div><label className="label">货物类型</label>
                    <select className="input" value={form.cargo_type} onChange={e => setForm({ ...form, cargo_type: e.target.value })}>
                      {cargoTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label className="label">重量(吨) *</label><input required type="number" step="0.01" min="0" className="input" value={form.weight} onChange={e => setForm({ ...form, weight: parseFloat(e.target.value) || 0 })} /></div>
                  <div><label className="label">体积(m³)</label><input type="number" step="0.01" min="0" className="input" value={form.volume || 0} onChange={e => setForm({ ...form, volume: parseFloat(e.target.value) || 0 })} /></div>
                  <div><label className="label">集装箱类型</label>
                    <select className="input" value={form.container_type} onChange={e => setForm({ ...form, container_type: e.target.value })}>
                      {containerTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label className="label">箱数</label><input type="number" min="0" className="input" value={form.container_count} onChange={e => setForm({ ...form, container_count: parseInt(e.target.value) || 0 })} /></div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                  <label className="flex items-center gap-2 mt-1 cursor-pointer shrink-0">
                    <input type="checkbox" className="w-4 h-4 rounded" checked={form.is_dangerous === 1}
                      onChange={e => setForm({ ...form, is_dangerous: e.target.checked ? 1 : 0 })} />
                    <span className="text-sm font-semibold text-red-700">⚠️ 危险品申报</span>
                  </label>
                  {form.is_dangerous === 1 && (
                    <div className="grid grid-cols-2 gap-3 flex-1">
                      <select className="input" value={form.dangerous_category} onChange={e => setForm({ ...form, dangerous_category: e.target.value })}>
                        <option value="">选择危险品分类</option>
                        {dangerousCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input className="input" placeholder="UN编号 (如 UN1170)" value={form.un_number || ''} onChange={e => setForm({ ...form, un_number: e.target.value })} />
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-sea-50/50 space-y-4 border border-sea-100">
                <p className="text-sm font-semibold text-sea-800">🌊 运输要求</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">起始港口 *</label>
                    <select required className="input" value={form.origin_port} onChange={e => setForm({ ...form, origin_port: e.target.value })}>
                      {ports.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div><label className="label">目的港口 *</label>
                    <select required className="input" value={form.destination_port} onChange={e => setForm({ ...form, destination_port: e.target.value })}>
                      {ports.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div><label className="label">交货截止日期</label><input type="date" className="input" value={form.delivery_deadline || ''} onChange={e => setForm({ ...form, delivery_deadline: e.target.value })} /></div>
                </div>
                <div><label className="label">特殊要求</label><textarea className="input min-h-[70px]" value={form.special_requirements || ''} onChange={e => setForm({ ...form, special_requirements: e.target.value })} placeholder="如：冷藏温度、防潮、隔离等要求" /></div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 sticky bottom-0 bg-white">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>取消</button>
                <button type="submit" className="btn-primary">{editing ? '保存修改' : '提交订单'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
