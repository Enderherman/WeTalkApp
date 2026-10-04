<template>
  <ContentPanel>
    <div class="device-settings">
      <h2>登录设备</h2>
      <p>每个账号可同时登录一台电脑客户端和一个浏览器。</p>
      <div class="device-actions">
        <el-button :loading="state.busy" @click="manager.load">刷新</el-button>
        <el-button :disabled="state.busy || !state.sessions.some((item) => !item.current)" @click="revokeOthers">退出其他设备</el-button>
      </div>
      <p v-if="state.error" role="alert">{{ state.error }}</p>
      <p v-if="!state.busy && !state.sessions.length && !state.error">暂无登录设备</p>
      <ul aria-label="已登录设备">
        <li v-for="session in state.sessions" :key="session.sessionId">
          <div>
            <strong>{{ session.deviceName || (session.deviceType === 'desktop' ? '电脑客户端' : '浏览器') }}</strong>
            <span v-if="session.current">（当前设备）</span>
            <p>登录时间：{{ formatTime(session.createdAt) }}</p>
            <p>最近活动：{{ formatTime(session.lastActiveAt) }}</p>
          </div>
          <el-button v-if="!session.current" :disabled="state.busy" @click="revoke(session)">退出该设备</el-button>
        </li>
      </ul>
    </div>
  </ContentPanel>
</template>

<script setup>
import { onMounted, reactive } from 'vue'
import Request from '@/utils/Request'
import Confirm from '@/utils/Confirm'
import { createDeviceSessionManager } from '@/utils/deviceSessions.mjs'

const state = reactive({ sessions: [], busy: false, error: '' })
const manager = createDeviceSessionManager(Request, state)
const formatTime = (value) => value ? new Date(value).toLocaleString('zh-CN') : '未知'
const revoke = (session) => Confirm({ message: `确认退出“${session.deviceName || '其他设备'}”？`, okfun: () => manager.revoke(session) })
const revokeOthers = () => Confirm({ message: '确认退出所有其他设备？当前电脑保持登录。', okfun: () => manager.revokeOthers() })
onMounted(manager.load)
</script>

<style scoped>
.device-settings { padding: 20px; }
.device-actions { display: flex; gap: 12px; }
ul { padding: 0; list-style: none; }
li { display: flex; align-items: center; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid #ddd; }
li p { margin: 6px 0; color: #666; }
</style>
