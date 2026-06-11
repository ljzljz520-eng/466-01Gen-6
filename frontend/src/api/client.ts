import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err.response?.data?.error || err.message || '请求失败'
    console.error('[API ERROR]', msg)
    return Promise.reject(new Error(msg))
  }
)

export default api
