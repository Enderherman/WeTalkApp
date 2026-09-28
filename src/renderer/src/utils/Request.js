import axios from 'axios'
import { ElLoading } from 'element-plus'
import Message from '@/plugin/Message'

const contentTypeForm = 'application/x-www-form-urlencoded;charset=UTF-8'
const contentTypeJson = 'application/json'
const responseTypeJson = 'json'

let loading = null
const instance = axios.create({
  //允许携带头部的token cookie等
  withCredentials: true,
  // The renderer always uses the local origin: Vite proxies in dev, and the
  // packaged Electron app proxies through its loopback HTTP server.
  baseURL: '/api',
  timeout: 1000 * 10
})



/**
 * 请求前拦截器
 */
instance.interceptors.request.use(
  (config) => {
    if (config.showLoading) {
      loading = ElLoading.service({
        lock: true,
        text: '加载中',
        background: 'rgba(0, 0, 0, 0.7)'
      })
    }
    return config
  },

  (error) => {
    if (error.showLoading && loading) {
      loading.close()
    }
    Message.error('请求发送失败')
    return Promise.reject('请求发送失败')
  }
)

/**
 * 请求后拦截器
 */
instance.interceptors.response.use(
  (response) => {
    const { showLoading, errorCallback, showError = true, responseType } = response.config
    if (showLoading && loading) {
      loading.close()
    }
    const responseData = response.data
    //验证码图片登
    if (responseType === 'arraybuffer' || responseType === 'blob') {
      return responseData
    }
    //正常请求
    if (responseData.code === 200) {
      return responseData
    } else if (responseData.code === 901) {
      //登录超时
      setTimeout(() => {
        window.ipcRenderer.send('reLogin')
      }, 2000)
    } else {
      //其它错误
      if (errorCallback) {
        errorCallback(responseData)
      }
      return Promise.reject({ showError: showError, msg: responseData.message })
    }
  },
  (error) => {
    if (error.config.showLoding && loading) {
      loading.close()
    }
    return Promise.reject({ showError: true, msg: '网络异常' })
  }
)

/**
 * 发送请求
 */
const request = (config) => {
  const {
    url,
    params,
    dataType,
    showLoading = true,
    responseType = responseTypeJson,
    showError = true
  } = config
  let contentType = contentTypeForm

  //创建form对象
  let formData = new FormData()
  for (let key in params) {
    formData.append(key, params[key] === undefined ? '' : params[key])
  }

  if (dataType != null && dataType === 'json') {
    contentType = contentTypeJson
  }
  const token = localStorage.getItem('token')
  let headers = {
    'Content-Type': contentType,
    'X-Requested-With': 'XMLHttpRequest',
    "token": token
  }
  return instance
    .post(url, formData, {
      headers: headers,
      showLoading: showLoading,
      errorCallback: config.errorCallback,
      showError: showError,
      responseType: responseType
    })
    .catch((error) => {
      if (error.showError) {
        Message.error(error.msg)
      }
      return null
    })
}

export default request
