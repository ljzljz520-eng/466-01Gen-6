import { useEffect, useState } from 'react'
import api from '../api/client'
import { TideWindow, DangerousGoodsRule } from '../types'

const ports = ['青岛', '烟台', '大连', '天津', '秦皇岛', '营口', '上海', '宁波', '福州', '广州', '深圳', '海口']
const dangerousCategories = ['爆炸品', '易燃气体', '毒性气体', '易燃液体', '易燃固体', '氧化性物质', '有机过氧化物', '毒性物质', '放射性物质', '腐蚀性物质', '任何货物', '食品类货物']
const levels = [
  { k: 'critical', l: '🚨 严重（禁装）', c: 'text-red-700 bg-red-50 border-red-200' },
  { k: 'high', l: '⚠️ 高危（需隔离）', c: 'text-orange-700 bg-orange-50 border-orange-200' },
  { k: 'medium', l: '⚡ 中等', c: 'text-amber-700 bg-amber-50 border-amber-200' },
  { k: 'low', l: 'ℹ️ 提示', c: 'text-sky-700 bg-sky-50 border-sky-200' },
]

export default function Config() {
  const [tides, setTides] = useState<TideWindow[]>([])
  const [rules, setRules] = useState<DangerousGoodsRule[]>([])
  const [tideFilter, setTideFilter] = useState({ port: '', date: '2026-06-11' })
  const [showTideForm, setShowTideForm] = useState(false)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [tideForm, setTideForm] = useState({ port_name: '青岛', date: '2026-06-12', high_tide_start: '05:00', high_tide_end: '07:30', max_draft: 9, notes: '' })
  const [ruleForm, setRuleForm] = useState({ category_a: '易燃液体', category_b: '腐蚀性物质', conflict_level: 'high' as const, rule_description: '' })
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null)

  const loadTides = () => {
    const p = new URLSearchParams()
    if (tideFilter.port) p.set('port', tideFilter.port)
    if (tideFilter.date) p.set('date', tideFilter.date)
    api.get(`/config/tide-windows?${p}`).then(r => setTides(r.data.data))
  }
  const loadRules = () => api.get('/config/dangerous-rules').then(r => setRules(r.data.data))

  useEffect(() => { loadTides() }, [tideFilter])
  useEffect(() => { loadRules() }, [])

  const addTide = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const r = await api.post('/config/tide-windows', tideForm)
      setMsg({ type: 'success', text: r.data.message }); setShowTideForm(false); loadTides()
      setTimeout(() => setMsg(null), 3000)
    } catch (err: any) { setMsg({ type: 'error', text: err.message }) }
  }
  const delTide = async (t: TideWindow) => {
    if (!confirm(`删除 ${t.port_name} ${t.date} 潮汐窗口？`)) return
    try { const r = await api.delete(`/config/tide-windows/${t.id}`); setMsg({ type: 'success', text: r.data.message }); loadTides() }
    catch (err: any) { setMsg({ type: 'error', text: err.message }) }
  }

  const addRule = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = { ...ruleForm, rule_description: ruleForm.rule_description || `${ruleForm.category_a} 与 ${ruleForm.category_b} 冲突` }
    try {
      const r = await api.post('/config/dangerous-rules', data)
      setMsg({ type: 'success', text: r.data.message }); setShowRuleForm(false); loadRules()
      setTimeout(() => setMsg(null), 3000)
    } catch (err: any) { setMsg({ type: 'error', text: err.message }) }
  }
  const delRule = async (r: DangerousGoodsRule) => {
    if (!confirm('删除此冲突规则？')) return
    try { const res = await api.delete(`/config/dangerous-rules/${r.id}`); setMsg({ type: 'success', text: res.data.message }); loadRules() }
    catch (err: any) { setMsg({ type: 'error', text: err.message }) }
  }

  const levelInfo = (l: string) => levels.find(x => x.k === l) || levels[0]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">⚙️ 潮汐窗口与危险品规则</h2>
        <p className="text-sm text-slate-500 mt-1">维护港口潮汐数据和危险品配载冲突规则，确保配载计划校验准确</p>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="font-semibold text-slate-800">🌊 潮汐窗口管理</h3>
              <p className="text-xs text-slate-500 mt-0.5">管理各港口每日高潮时段与允许最大吃水深度</p>
            </div>
            <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => setShowTideForm(true)}>+ 添加</button>
          </div>
          <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2 bg-slate-50">
            <select className="input !w-32 text-xs" value={tideFilter.port} onChange={e => setTideFilter({ ...tideFilter, port: e.target.value })}>
              <option value="">全部港口</option>
              {ports.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="date" className="input !w-40 text-xs" value={tideFilter.date} onChange={e => setTideFilter({ ...tideFilter, date: e.target.value })} />
            <span className="text-xs text-slate-500 ml-auto">显示 {tides.length} 条</span>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <table className="table text-xs">
              <thead className="sticky top-0"><tr><th>港口</th><th>日期</th><th>高潮时段</th><th>最大吃水</th><th>类型</th><th>操作</th></tr></thead>
              <tbody>
                {tides.length === 0 ? <tr><td colSpan={6} className="text-center py-10 text-slate-400">暂无数据</td></tr> :
                  tides.map(t => (
                    <tr key={t.id}>
                      <td className="font-semibold text-slate-800">{t.port_name}</td>
                      <td className="font-mono">{t.date}</td>
                      <td className="font-mono text-sea-700">{t.high_tide_start} - {t.high_tide_end}</td>
                      <td className="font-mono">{t.max_draft}m</td>
                      <td>{t.notes ? <span className="badge-info">{t.notes}</span> : '-'}</td>
                      <td><button className="text-red-500 hover:text-red-600" onClick={() => delTide(t)}>删除</button></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="font-semibold text-slate-800">⚠️ 危险品配载冲突规则</h3>
              <p className="text-xs text-slate-500 mt-0.5">定义不同类别危险品之间的互斥与隔离规则</p>
            </div>
            <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => setShowRuleForm(true)}>+ 添加</button>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {rules.length === 0 ? <div className="text-center py-16 text-slate-400">暂无规则</div> : (
              <div className="p-4 space-y-2">
                {rules.map(r => {
                  const lvl = levelInfo(r.conflict_level)
                  return (
                    <div key={r.id} className="p-3 rounded-lg border border-slate-200 hover:border-sea-300 transition-colors flex items-start gap-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${lvl.c}`}>{lvl.l}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-sm">
                          <span className="px-2 py-0.5 bg-slate-100 rounded font-semibold text-slate-700">{r.category_a}</span>
                          <span className="text-slate-400 text-xs">⟺ 冲突</span>
                          <span className="px-2 py-0.5 bg-slate-100 rounded font-semibold text-slate-700">{r.category_b}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1.5">{r.rule_description}</p>
                      </div>
                      <button className="text-red-500 hover:text-red-600 text-xs shrink-0" onClick={() => delRule(r)}>删除</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showTideForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-lg">🌊 添加潮汐窗口</h3>
              <button onClick={() => setShowTideForm(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <form onSubmit={addTide} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">港口</label>
                  <select className="input" value={tideForm.port_name} onChange={e => setTideForm({ ...tideForm, port_name: e.target.value })}>
                    {ports.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div><label className="label">日期</label><input type="date" required className="input" value={tideForm.date} onChange={e => setTideForm({ ...tideForm, date: e.target.value })} /></div>
                <div><label className="label">高潮开始</label><input type="time" required className="input" value={tideForm.high_tide_start} onChange={e => setTideForm({ ...tideForm, high_tide_start: e.target.value })} /></div>
                <div><label className="label">高潮结束</label><input type="time" required className="input" value={tideForm.high_tide_end} onChange={e => setTideForm({ ...tideForm, high_tide_end: e.target.value })} /></div>
                <div><label className="label">允许最大吃水(m)</label><input type="number" step="0.1" required className="input" value={tideForm.max_draft} onChange={e => setTideForm({ ...tideForm, max_draft: parseFloat(e.target.value) })} /></div>
                <div><label className="label">备注</label><input className="input" placeholder="早潮/晚潮..." value={tideForm.notes} onChange={e => setTideForm({ ...tideForm, notes: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowTideForm(false)}>取消</button>
                <button type="submit" className="btn-primary">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRuleForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-lg">⚠️ 添加危险品冲突规则</h3>
              <button onClick={() => setShowRuleForm(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <form onSubmit={addRule} className="p-6 space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 text-sm">
                <p className="text-slate-600">当类别A与类别B同时出现在同一配载计划中时触发规则</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">类别 A</label>
                  <select className="input" value={ruleForm.category_a} onChange={e => setRuleForm({ ...ruleForm, category_a: e.target.value })}>
                    {dangerousCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className="label">类别 B</label>
                  <select className="input" value={ruleForm.category_b} onChange={e => setRuleForm({ ...ruleForm, category_b: e.target.value })}>
                    {dangerousCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">冲突等级</label>
                <div className="grid grid-cols-2 gap-2">
                  {levels.map(l => (
                    <label key={l.k} className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${ruleForm.conflict_level === l.k ? 'border-sea-500 bg-sea-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input type="radio" className="sr-only" checked={ruleForm.conflict_level === l.k} onChange={() => setRuleForm({ ...ruleForm, conflict_level: l.k as any })} />
                      <span className={`font-semibold text-xs ${l.c.split(' ')[0]}`}>{l.l}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">规则描述</label>
                <textarea className="input min-h-[70px]" placeholder="详细说明冲突原因与处理建议" value={ruleForm.rule_description} onChange={e => setRuleForm({ ...ruleForm, rule_description: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowRuleForm(false)}>取消</button>
                <button type="submit" className="btn-primary">保存规则</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
