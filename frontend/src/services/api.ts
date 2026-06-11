import axios from 'axios'

const api = axios.create({
  baseURL: '',
})

api.interceptors.request.use(
  (config) => {
    const url = `${config.url || ''}`
    const isAdminRequest = url.startsWith('/api/admin')
    const token = localStorage.getItem('adminToken')
    if (token && isAdminRequest) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = `${error.config?.url || ''}`
    const isAdminRequest = url.startsWith('/api/admin')
    if (error.response?.status === 401 && isAdminRequest) {
      localStorage.removeItem('adminToken')
      const currentPath = window.location.pathname
      if (currentPath !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export default api
