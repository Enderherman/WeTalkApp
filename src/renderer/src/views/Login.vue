<template>
  <div class="login-panel">
    <div class="title drag">微语</div>
    <div v-if="showLoading" class="loading-panel">
      <img src="@/assets/img/loading.gif" alt="图片加载" />
    </div>
    <div v-else class="login-form">
      <div class="error-msg">{{ errorMsg }}</div>
      <el-form ref="formDataRef" :model="formData" label-width="" @submit.prevent>
        <!--邮箱-->
        <el-form-item label="" prop="email">
          <div class="email-panel">
            <el-input
              size="large"
              clearable
              placeholder="请输入邮箱"
              maxLength="30"
              v-model.trim="formData.email"
              @change="formData.emailCode = ''"
              @focus="cleanVerify"
            >
              <template #prefix>
                <span class="iconfont icon-email"></span>
              </template>
            </el-input>
            <el-dropdown v-if="isLogin && localUserList.length > 0" trigger="click">
              <span class="iconfont icon-down"></span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="item in localUserList"
                    :key="item.email"
                    @click="formData.email = item.email"
                    >{{ item.email }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-form-item>
        <!--注册邮箱-->
        <el-form-item label="" prop="nickName" v-if="!isLogin">
          <el-input
            size="large"
            clearable
            placeholder="请输入昵称"
            maxLength="15"
            v-model.trim="formData.nickName"
            @focus="cleanVerify"
          >
            <template #prefix>
              <span class="iconfont icon-user-nick"></span>
            </template>
          </el-input>
        </el-form-item>
        <!--密码-->
        <el-form-item label="" prop="password">
          <el-input
            size="large"
            show-password
            clearable
            placeholder="请输入密码"
            v-model.trim="formData.password"
            @focus="cleanVerify"
          >
            <template #prefix>
              <span class="iconfont icon-password"></span>
            </template>
          </el-input>
        </el-form-item>
        <!--注册再次输入密码-->
        <el-form-item label="" prop="password" v-if="!isLogin">
          <el-input
            size="large"
            show-password
            clearable
            placeholder="请再次输入密码"
            v-model.trim="formData.rePassword"
            @focus="cleanVerify"
          >
            <template #prefix>
              <span class="iconfont icon-password"></span>
            </template>
          </el-input>
        </el-form-item>
        <!--验证码-->
        <el-form-item label="" prop="checkCode">
          <div class="check-code-panel">
            <el-input
              size="large"
              clearable
              placeholder="请输入验证码"
              v-model.trim="formData.checkCode"
              @focus="cleanVerify"
            >
              <template #prefix>
                <span class="iconfont icon-checkcode"></span>
              </template>
            </el-input>
            <img :src="checkCodeUrl" class="check-code" alt="验证码" @click="changeCheckCode(0)" />
          </div>
        </el-form-item>
        <!--注册邮箱验证码-->
        <el-form-item v-if="!isLogin" label="" prop="emailCode">
          <div class="check-code-panel">
            <el-input
              size="large"
              clearable
              maxlength="6"
              inputmode="numeric"
              autocomplete="one-time-code"
              placeholder="请输入邮箱验证码"
              v-model.trim="formData.emailCode"
              @focus="cleanVerify"
            >
              <template #prefix>
                <span class="iconfont icon-email"></span>
              </template>
            </el-input>
            <el-button
              native-type="button"
              :disabled="emailCodeSending || emailCodeCountdown > 0"
              @click="sendRegistrationEmailCode"
            >{{ emailCodeSending ? '发送中…' : emailCodeCountdown > 0 ? `${emailCodeCountdown} 秒后重发` : '发送验证码' }}</el-button>
          </div>
        </el-form-item>
        <!--按钮-->
        <el-form-item>
          <el-button type="primary" class="login-btn" @click="submit"
            >{{ isLogin ? '登录' : '注册' }}
          </el-button>
        </el-form-item>
        <div class="bottom-link">
          <span class="a-link" @click="changeOpType()">
            {{ isLogin ? '没有账号？' : '已有账号？' }}
          </span>
        </div>
      </el-form>
    </div>
  </div>
  <WinOp :show-set-top="false" :show-min="false" :show-max="false" :close-type="0"></WinOp>
</template>

<script setup>
import Api from '@/utils/Api'
import Request from '@/utils/Request'
import Utils from '@/utils/Utils'
import Verify from '@/utils/Verify'
import Message from '@/plugin/Message'
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import md5 from 'js-md5'
import { useUserInfoStore } from '@/stores/UserInfoStore'

const userInfoStore = useUserInfoStore()
import { useRouter } from 'vue-router'
import WinOp from '@/components/WinOp.vue'

const router = useRouter()

const formData = ref({})
const formDataRef = ref()

const errorMsg = ref(null)
const isLogin = ref(true)
const emailCodeSending = ref(false)
const emailCodeCountdown = ref(0)
let emailCodeTimer = null

//加载页面
const showLoading = ref(false)

//切换登录或注册界面
const changeOpType = () => {
  stopEmailCodeCountdown()
  window.ipcRenderer.send('loginOrRegister', !isLogin.value)
  isLogin.value = !isLogin.value
  nextTick(() => {
    formDataRef.value.resetFields()
    formData.value = {}
    cleanVerify()
  })
  changeCheckCode()
}

const stopEmailCodeCountdown = () => {
  if (emailCodeTimer) clearInterval(emailCodeTimer)
  emailCodeTimer = null
  emailCodeCountdown.value = 0
}

const startEmailCodeCountdown = () => {
  stopEmailCodeCountdown()
  emailCodeCountdown.value = 60
  emailCodeTimer = setInterval(() => {
    if (emailCodeCountdown.value <= 1) {
      stopEmailCodeCountdown()
      return
    }
    emailCodeCountdown.value -= 1
  }, 1000)
}

/**
 * 获取验证码
 */
const checkCodeUrl = ref(null)
const changeCheckCode = async () => {
  let result = await Request({
    url: Api.checkCode,
    showLoading: false
  })
  if (!result) {
    return
  }
  checkCodeUrl.value = result.data.check_code
  localStorage.setItem('check_code_key', result.data.check_code_key)
}
changeCheckCode()

const sendRegistrationEmailCode = async () => {
  cleanVerify()
  if (!checkValue('checkEmail', formData.value.email, '请输入正确的邮箱')) return
  if (!checkValue(null, formData.value.checkCode, '请输入图片验证码')) return

  const checkCodeKey = localStorage.getItem('check_code_key')
  if (!checkCodeKey) {
    errorMsg.value = '图片验证码已过期，请刷新后重试'
    await changeCheckCode()
    return
  }

  emailCodeSending.value = true
  let result = null
  try {
    result = await Request({
      url: Api.registerEmailCode,
      showLoading: false,
      showError: false,
      params: {
        email: formData.value.email,
        checkCode: formData.value.checkCode,
        checkCodeKey
      },
      errorCallback: (response) => {
        errorMsg.value = response.message
        Message.error(response.message)
      }
    })
  } catch {
    errorMsg.value = '验证码发送失败，请稍后重试'
  } finally {
    emailCodeSending.value = false
    formData.value.checkCode = ''
    await changeCheckCode()
  }
  if (!result) return

  Message.success('如果邮箱可以注册，验证码已发送，请查收')
  startEmailCodeCountdown()
}

/**
 * 校验参数
 */
const checkValue = (type, value, msg) => {
  if (Utils.isEmpty(value)) {
    errorMsg.value = msg
    return false
  }

  if (type && !Verify[type](value)) {
    errorMsg.value = msg
    return false
  }
  return true
}
/**
 * 清空值
 */
const cleanVerify = () => {
  errorMsg.value = null
}

//提交
const submit = async () => {
  cleanVerify()

  if (!checkValue('checkEmail', formData.value.email, '请输入正确的邮箱')) {
    return
  }

  if (!isLogin.value && !checkValue(null, formData.value.nickName, '请输入昵称')) {
    return
  }

  if (
    !checkValue('checkPassword', formData.value.password, '密码只能是数字, 字母和特殊字符8~18位')
  ) {
    return
  }

  if (!isLogin.value && formData.value.password !== formData.value.rePassword) {
    errorMsg.value = '两次输入的密码不一致'
    return
  }

  if (isLogin.value) {
    if (!checkValue(null, formData.value.checkCode, '请输入验证码')) return
  } else if (!/^\d{6}$/.test(formData.value.emailCode || '')) {
    errorMsg.value = '请输入 6 位邮箱验证码'
    return
  }

  if (isLogin.value) {
    showLoading.value = true
  }

  /**
   * 请求统一发送
   */
  const params = isLogin.value
    ? {
        email: formData.value.email,
        password: md5(formData.value.password),
        checkCode: formData.value.checkCode,
        checkCodeKey: localStorage.getItem('check_code_key')
      }
    : {
        email: formData.value.email,
        password: formData.value.password,
        nickName: formData.value.nickName,
        emailCode: formData.value.emailCode
      }

  let result = await Request({
    url: isLogin.value ? Api.login : Api.register,
    showLoading: !isLogin.value,
    showError: false,
    params,
    errorCallback: (response) => {
      showLoading.value = false
      //刷新验证码
      changeCheckCode()
      errorMsg.value = response.message
      Message.error(response.message)
    }
  })
  if (!result) {
    return
  }
  if (isLogin.value) {
    //登录 状态管理用pinia
    userInfoStore.setInfo(result.data)
    localStorage.setItem('token', result.data.token)
    //跳转
    router.push('/main')

    //主进程交互 传入屏幕高宽
    const screenWidth = window.screen.width
    const screenHeight = window.screen.height
    window.ipcRenderer.send('openChat', {
      email: formData.value.email,
      //用于发送心跳
      token: result.data.token,
      userId: result.data.userId,
      nickName: result.data.nickName,
      admin: result.data.admin,
      screenWidth: screenWidth,
      screenHeight: screenHeight
    })
    window.ipcRenderer.send('setLocalStore', { key: 'devWsDomain', val: Api.devWsDomain })

    window.ipcRenderer.send('getLocalStore', 'devWsDomain')
  } else {
    Message.success('注册成功')
    changeOpType()
  }
}

//初始化ws链接
const init = () => {
  window.ipcRenderer.send('setLocalStore', { key: 'prodDomain', val: Api.prodDomain })
  window.ipcRenderer.send('setLocalStore', { key: 'devDomain', val: Api.devDomain })
  window.ipcRenderer.send('setLocalStore', { key: 'prodWsDomain', val: Api.prodWsDomain })
  window.ipcRenderer.send('setLocalStore', { key: 'devWsDomain', val: Api.devWsDomain })
  window.ipcRenderer.send('loadLocalUser')

  window.ipcRenderer.on('loadLocalUserCallback', (event, userList) => {
    localUserList.value = userList
  })
}

/**
 * 本地用户列表
 */
const localUserList = ref([])

onMounted(() => {
  init()
})

onUnmounted(() => {
  stopEmailCodeCountdown()
  window.ipcRenderer.removeAllListeners('loadLocalUserCallback')
})
</script>

<style lang="scss" scoped>
.email-select {
  width: 250px;
}

.loading-panel {
  height: calc(100vh - 32px);
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;

  img {
    width: 300px;
  }
}

.login-panel {
  background: #fff;
  border-radius: 3px;
  border: 1px solid #ddd;

  .title {
    height: 30px;
    padding: 5px 0 0 10px;
  }

  .login-form {
    padding: 0 15px 29px 15px;

    :deep(.el-input__wrapper) {
      box-shadow: none;
      border-radius: 0;
    }

    .el-form-item {
      border-bottom: 1px solid #ddd;
    }

    .email-panel {
      align-items: center;
      width: 100%;
      display: flex;

      .input {
        flex: 1;
      }

      .icon-down {
        margin-left: 3px;
        width: 16px;
        cursor: pointer;
        border: none;
      }
    }

    .error-msg {
      line-height: 30px;
      height: 30px;
      color: #fb7373;
    }

    .check-code-panel {
      display: flex;

      .check-code {
        cursor: pointer;
        width: 120px;
        margin-left: 5px;
      }
    }

    .login-btn {
      margin-top: 20px;
      width: 100%;
      background: #07c160;
      height: 36px;
      font-size: 16px;
    }

    .bottom-link {
      text-align: right;
    }
  }
}
</style>
