<template>
  <div class="main">
    <div class="left-sider">
      <div>
        <Avatar
          :key="avatarInfoStore.getAvatarVersion(userInfoStore.getInfo().userId)"
          :user-id="userInfoStore.getInfo().userId"
          :width="36"
          :force-get="avatarInfoStore.getForceReload(userInfoStore.getInfo().userId)"
        ></Avatar>
      </div>
      <div class="menu-list">
        <template v-for="item in menuList">
          <div
            v-if="item.position === 'top'"
            :class="[
              'tab-item iconfont',
              item.icon,
              item.path === currentValue.path ? 'active' : ''
            ]"
            @click="changeMenu(item)"
          >
            <template v-if="item.name === 'chat' || item.name === 'contact'">
              <Badge :count="messageCountStore.getCount(item.countKey)" :top="3" :left="15"></Badge>
            </template>
          </div>
        </template>
      </div>
      <div class="menu-list menu-bottom">
        <template v-for="item in menuList">
          <div
            v-if="item.position === 'bottom'"
            :class="[
              'tab-item iconfont',
              item.icon,
              item.path === currentValue.path ? 'active' : ''
            ]"
            @click="changeMenu(item)"
          ></div>
        </template>
      </div>
    </div>
    <div class="right-container">
      <router-view v-slot="{ Component }">
        <keep-alive include="chat">
          <component :is="Component" ref="componentRef"></component>
        </keep-alive>
      </router-view>
    </div>
  </div>
  <WinOp></WinOp>
  <Update></Update>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Request from '@/utils/Request'
import Api from '@/utils/Api'
import { useUserInfoStore } from '@/stores/UserInfoStore'
import { useGlobalInfoStore } from '@/stores/GlobalInfoStore'
import { useSysSettingStore } from '@/stores/SystemSettingStore'
import { useMessageCountStore } from '@/stores/MessageCountStore'
import { useAvatarInfoStore } from '@/stores/AvatarUploadStore'
import Update from '@/views/Update.vue'
import { clearRendererSession } from '@/utils/routeAccess.mjs'

const messageCountStore = useMessageCountStore()
const userInfoStore = useUserInfoStore()
const globalInfoStore = useGlobalInfoStore()
const sysSettingStore = useSysSettingStore()
const avatarInfoStore = useAvatarInfoStore()
const router = useRouter()
const route = useRoute()
const menuList = ref([
  {
    name: 'chat',
    icon: 'icon-chat',
    path: '/chat',
    countKey: 'chatCount',
    position: 'top'
  },
  {
    name: 'contact',
    icon: 'icon-user',
    path: '/contact',
    countKey: 'contactApplyCount',
    position: 'top'
  },
  {
    name: 'mysetting',
    icon: 'icon-more2',
    path: '/setting',
    position: 'bottom'
  }
])

const currentValue = ref(menuList.value[0])

const changeMenu = (item) => {
  currentValue.value = item
  router.push(item.path)
}

const getLoginInfo = async () => {
  let result = await Request({
    url: Api.getUserInfo,
    params: {}
  })
  if (!result) {
    return result
  }
  userInfoStore.setInfo(result.data)
  window.ipcRenderer.send('getLocalStore', result.data.userId + 'localServerPort')
}

const getSystemSetting = async () => {
  let result = await Request({
    url: Api.getSysSetting
  })
  if (!result) {
    return result
  }
  //console.log('sysSetting', result.data)
  sysSettingStore.setSetting(result.data)
}

const menuSelect = (path) => {
  currentValue.value = menuList.value.find((item) => {
    return path.includes(item.path)
  })
}

onMounted(() => {
  getLoginInfo()
  getSystemSetting()
  window.ipcRenderer.on('getLocalStoreCallback', (e, serverPort) => {
    globalInfoStore.setInfo('localServerPort', serverPort)
  })

  //退出登录跳转到登录界面
  window.ipcRenderer.on('reLogin', () => {
    clearRendererSession(localStorage, [userInfoStore, globalInfoStore, sysSettingStore, messageCountStore, avatarInfoStore])
    router.replace('/login')
  })
})

watch(
  () => route.path,
  (newVal, oldVal) => {
    if (newVal) {
      menuSelect(newVal)
    }
  },
  { immediate: true, deep: true }
)

onUnmounted(() => {
  window.ipcRenderer.removeAllListeners('getLocalStoreCallback')
  window.ipcRenderer.removeAllListeners('reLogin')
})
</script>

<style scoped lang="less">
.main {
  background: #ddd;
  display: flex;
  border-radius: 0px 3px 3px 0px;
  overflow: hidden;

  .left-sider {
    width: 55px;
    background: #2e2e2e;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 35px;
    border: 1px solid #2e2e2e;
    border-right: none;
    padding-bottom: 10px;

    .menu-list {
      width: 100%;
      flex: 1;

      .tab-item {
        color: #d3d3d3;
        font-size: 20px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 10px;
        cursor: pointer;
        font-size: 22px;
        position: relative;
      }

      .active {
        color: #07c160;
      }
    }

    .menu-bottom {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    }
  }

  .right-container {
    flex: 1;
    overflow: hidden;
    border: 1px solid #ddd;
    border-left: none;
  }
}

.popover-user-panel {
  padding: 10px;

  .popover-user {
    display: flex;
    border-bottom: 1px solid #ddd;
    padding-bottom: 20px;
  }

  .send-message {
    margin-top: 10px;
    text-align: center;
    padding: 20px 0px 0px 0px;
  }
}
</style>
