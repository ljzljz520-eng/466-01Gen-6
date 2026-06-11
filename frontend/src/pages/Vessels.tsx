import { useEffect, useState } from 'react'
import api from '../api/client'
import { Vessel } from '../types'

export default function Vessels() {
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Vessel | null>(null)
  const [form, setForm] = useState<any>({
    name: '', imo_number: '', max_weight: 0, max_volume: 0, draft: 0,
    route: '', capacity_20ft: 0, capacity_40ft: 0, status: 'active'
  })
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null)

  const refresh = () => api.get('/vessels').then(r => setVessels(r.data.data)).finally(() => setLoading(false))

  useEffect(() => { refresh() }, [])

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', imo_number: '', max_weight: 0, max_volume: 0, draft: 0, route: '', capacity_20ft: 0, capacity_40ft: 0, status: 'active' })
    setShowForm(true)
  }
  const openEdit = (v: Vessel) => {
    setEditing(v)
    setForm({ ...v })
    setShowForm(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const r = editing
        ? await api.put(`/vessels/${editing.id}`, form)
        : await api.post('/vessels', form)
      setMsg({ type: 'success', text: r.data.message })
      setShowForm(false)
      refresh()
      setTimeout(() => setMsg(null), 3000)
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  const remove = async (v: Vessel) => {
    if (!confirm(`确定删除船只「${v.name}」？`)) return
    try {
      const r = await api.delete(`/vessels/${v.id}`)
      setMsg({ type: 'success', text: r.data.message })
      refresh()
      setTimeout(() => setMsg(null), 3000)
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  const statusMap: Record<string, { label: string; cls: string }> = {
    active: { label: '在役', cls: 'badge-success' },
    maintenance: { label: '维护', cls: 'badge-warning' },
    inactive: { label: '停用', cls: 'badge-secondary' },
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">🚢 船只管理</h2>
          <p className="text-sm text-slate-500 mt-1">管理船队信息，包括载重、容积、吃水深度与常规航线</p>
        </div>
        <button className="btn-primary" onClick={openNew}>+ 添加船只</button>
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
                <th>船名</th><th>IMO编号</th><th>最大载重(吨)</th><th>容积(m³)</th>
                <th>吃水(m)</th><th>航线</th><th>集装箱容量</th><th>状态</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-400">加载中...</td></tr>
              ) : vessels.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-400">暂无船只数据</td></tr>
              ) : vessels.map(v => (
                <tr key={v.id}>
                  <td className="font-semibold text-slate-800">{v.name}</td>
                  <td className="font-mono text-xs">{v.imo_number || '-'}</td>
                  <td className="text-right font-mono">{v.max_weight.toLocaleString()}</td>
                  <td className="text-right font-mono">{v.max_volume?.toLocaleString() || '-'}</td>
                  <td className="text-right font-mono">{v.draft || '-'}</td>
                  <td><span className="badge-info">{v.route || '-'}</span></td>
                  <td className="text-sm text-slate-600">20'×{v.capacity_20ft || 0} / 40'×{v.capacity_40ft || 0}</td>
                  <td><span className={statusMap[v.status]?.cls}>{statusMap[v.status]?.label}</span></td>
                  <td>
                    <div className="flex gap-2">
                      <button className="text-sea-600 hover:text-sea-700 text-sm" onClick={() => openEdit(v)}>编辑</button>
                      <button className="text-red-500 hover:text-red-600 text-sm" onClick={() => remove(v)}>删除</button>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-lg text-slate-800">{editing ? '编辑船只' : '添加船只'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">船名 *</label>
                  <input required className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：近海明珠号" />
                </div>
                <div>
                  <label className="label">IMO编号</label>
                  <input className="input" value={form.imo_number || ''} onChange={e => setForm({ ...form, imo_number: e.target.value })} placeholder="如：IMO9876543" />
                </div>
                <div>
                  <label className="label">最大载重(吨) *</label>
                  <input required type="number" step="0.01" min="0" className="input" value={form.max_weight} onChange={e => setForm({ ...form, max_weight: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">船舱容积(m³)</label>
                  <input type="number" step="0.01" min="0" className="input" value={form.max_volume || 0} onChange={e => setForm({ ...form, max_volume: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">满载吃水(m)</label>
                  <input type="number" step="0.1" min="0" className="input" value={form.draft || 0} onChange={e => setForm({ ...form, draft: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">常规航线</label>
                  <input className="input" value={form.route || ''} onChange={e => setForm({ ...form, route: e.target.value })} placeholder="如：青岛-烟台-大连" />
                </div>
                <div>
                  <label className="label">20英尺箱容量</label>
                  <input type="number" min="0" className="input" value={form.capacity_20ft || 0} onChange={e => setForm({ ...form, capacity_20ft: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">40英尺箱容量</label>
                  <input type="number" min="0" className="input" value={form.capacity_40ft || 0} onChange={e => setForm({ ...form, capacity_40ft: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">状态</label>
                  <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="active">在役</option>
                    <option value="maintenance">维护中</option>
                    <option value="inactive">停用</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>取消</button>
                <button type="submit" className="btn-primary">{editing ? '保存修改' : '添加船只'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
