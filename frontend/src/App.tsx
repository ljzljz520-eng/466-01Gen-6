import { Routes, Route, NavLink, useLocation, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import Vessels from './pages/Vessels'
import Orders from './pages/Orders'
import StowagePlans from './pages/StowagePlans'
import CreateStowage from './pages/CreateStowage'
import StowageDetail from './pages/StowageDetail'
import CaptainConfirm from './pages/CaptainConfirm'
import CustomerSearch from './pages/CustomerSearch'
import Config from './pages/Config'
import { Stats } from './types'
import api from './api/client'

const navItems = [
  { to: '/', label: '调度总览', icon: '📊', roles: ['dispatcher'] },
  { to: '/vessels', label: '船只管理', icon: '🚢', roles: ['dispatcher'] },
  { to: '/orders', label: '货主订单', icon: '📦', roles: ['dispatcher'] },
  { to: '/stowage', label: '配载计划', icon: '📋', roles: ['dispatcher'] },
  { to: '/stowage/create', label: '创建配载', icon: '➕', roles: ['dispatcher'] },
  { to: '/config', label: '潮汐与规则', icon: '⚙️', roles: ['dispatcher'] },
]

const roleTabs = [
  { key: 'dispatcher', label: '调度员', icon: '👨‍✈️' },
  { key: 'captain', label: '船长', icon: '🧑‍✈️' },
  { key: 'customer', label: '客户', icon: '🧑‍💼' },
]

export default function App() {
  const location = useLocation()
  const [role, setRole] = useState<string>('dispatcher')
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    if (role === 'dispatcher') {
      api.get('/stowage/stats').then(r => setStats(r.data.data)).catch(() => {})
    }
  }, [role, location.pathname])

  const showSidebar = role === 'dispatcher'

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sea-500 to-sea-700 flex items-center justify-center text-white text-xl shadow-sm">
              ⚓
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">近海小船船期配载系统</h1>
              <p className="text-xs text-slate-500">Coastal Vessel Stowage Management</p>
            </div>
          </Link>

          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
            {roleTabs.map(t => (
              <button
                key={t.key}
                onClick={() => setRole(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  role === t.key ? 'bg-white text-sea-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {showSidebar && (
          <aside className="w-60 bg-white border-r border-slate-200 shrink-0 py-4 px-3">
            <nav className="space-y-1">
              {navItems.filter(n => n.roles.includes(role)).map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : 'nav-link-idle'}`}
                >
                  <span className="text-lg w-6 text-center">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.to === '/orders' && stats && stats.pendingOrders > 0 && (
                    <span className="ml-auto badge-danger">{stats.pendingOrders}</span>
                  )}
                  {item.to === '/stowage' && stats && stats.draftPlans > 0 && (
                    <span className="ml-auto badge-warning">{stats.draftPlans}</span>
                  )}
                </NavLink>
              ))}
            </nav>

            {stats && (
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-sea-50 to-sky-50 border border-sea-100">
                <p className="text-xs text-sea-700 font-medium mb-2">⚡ 今日概况</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-500">在役船只</span><p className="font-bold text-slate-800">{stats.totalVessels}</p></div>
                  <div><span className="text-slate-500">待配订单</span><p className="font-bold text-amber-600">{stats.pendingOrders}</p></div>
                  <div><span className="text-slate-500">今日潮汐</span><p className="font-bold text-sea-700">{stats.todayTides}</p></div>
                  <div><span className="text-slate-500">已确认</span><p className="font-bold text-emerald-600">{stats.confirmedPlans}</p></div>
                </div>
              </div>
            )}
          </aside>
        )}

        <main className={`flex-1 p-6 overflow-x-hidden ${!showSidebar ? 'max-w-6xl mx-auto w-full' : ''}`}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/vessels" element={<Vessels />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/stowage" element={<StowagePlans />} />
            <Route path="/stowage/create" element={<CreateStowage />} />
            <Route path="/stowage/:id" element={<StowageDetail />} />
            <Route path="/captain" element={<CaptainConfirm />} />
            <Route path="/customer" element={<CustomerSearch />} />
            <Route path="/config" element={<Config />} />
          </Routes>

          {role === 'captain' && location.pathname !== '/captain' && (
            <div className="fixed bottom-6 right-6 z-40">
              <Link to="/captain" className="btn-primary shadow-lg px-5 py-3 rounded-2xl">
                🧑‍✈️ 前往船长工作台
              </Link>
            </div>
          )}
          {role === 'customer' && location.pathname !== '/customer' && (
            <div className="fixed bottom-6 right-6 z-40">
              <Link to="/customer" className="btn-primary shadow-lg px-5 py-3 rounded-2xl">
                🧑‍💼 查询我的货期
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
