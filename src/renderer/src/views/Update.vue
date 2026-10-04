<template>
  <div v-if="showUpdate">
    <div class="update-container drag"></div>
    <div class="update-panel no-drag">
      <div class="update-inner">
        <div class="update-content">
          <div class="update-content-title">更新内容</div>
          <div class="update-list">
            <div v-for="(item, index) in updateInfo.updateList">{{ index + 1 }}, {{ item }}</div>
          </div>
        </div>
        <div v-if="downloading" class="download-progress">
          <div v-if="downloadPercent.progress !== 100">
            <el-progress :percentage="downloadPercent.progress" />
            <div class="download-tips">
              正在下载，请稍后({{ Utils.sizeToStr(downloadPercent.loaded) }} /
              {{ Utils.sizeToStr(downloadPercent.total) }})
            </div>
          </div>
          <div v-else>下载完成，准备安装</div>
        </div>
        <div v-else class="op-btn">
          <div class="cancel" @click="cancelUpdateHandler">残忍拒绝</div>
          <div class="update" @click="startDownload">更新</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import Request from '../utils/Request'
import Utils from '../utils/Utils'
import Api from '@/utils/Api'
import config from '../../../../package.json'
import { onMounted, onUnmounted, ref } from 'vue'
import { useUserInfoStore } from '@/stores/UserInfoStore'
import Confirm from '@/utils/Confirm'
import Message from '@/plugin/Message'
import { useIpcListeners } from '@/composables/useIpcListeners'
const ipc = useIpcListeners()

const userInfoStore = useUserInfoStore()

const props = defineProps({
  autoUpdate: {
    type: Boolean,
    default: false
  }
})

//更新
const showUpdate = ref(false)
const updateInfo = ref({
  id: 0,
  fileName: '',
  fileType: 0,
  size: 0,
  updateList: []
})

/**
 * 检查更新
 */
const version = config.version
const checkUpdateAuto = async (auto) => {
  let result = await Request({
    url: Api.checkVersion,
    params: {
      version: version,
      token: localStorage.getItem('token'),
      uid: userInfoStore.getInfo().userId
    }
  })
  if (!result) {
    Message.error('检查更新失败，请稍后重试')
    return
  }
  if (result.data == null) {
    if (!auto) {
      Confirm({
        message: '已是最新版本!',
        showCancelBtn: false
      })
    }
    return
  }
  showUpdate.value = true
  updateInfo.value = result.data
}

/**
 * 取消更新
 */
const cancelUpdateHandler = () => {
  showUpdate.value = false
}

/**
 * 开始更新
 */
const downloading = ref(false)
const downloadPercent = ref({
  progress: 0,
  loaded: 0,
  total: updateInfo.value.size
})
const startDownload = async () => {
  if (updateInfo.value.fileType === 0) {
    downloading.value = true
    downloadPercent.value = { progress: 0, loaded: 0, total: updateInfo.value.size }
    window.ipcRenderer.send('downloadUpdate', {
      id: updateInfo.value.id,
      fileName: updateInfo.value.fileName,
      size: updateInfo.value.size
    })
  } else if (updateInfo.value.fileType === 1) {
    Message.success('已在浏览器中打开更新链接')
    window.ipcRenderer.send('openUrl', { url: updateInfo.value.outerLink })
    showUpdate.value = false
  }
}

const checkUpdate = () => {
  checkUpdateAuto(false)
}

onMounted(() => {
  if (props.autoUpdate) {
    checkUpdateAuto(true)
  }
  ipc.on('downloadUpdateCallback', (event, state) => {
    if (state.error) {
      downloading.value = false
      Message.error(state.error)
      return
    }
    downloadPercent.value = state
  })
})
defineExpose({
  checkUpdate
})
</script>

<style scoped lang="less">
.update-container {
  opacity: 0.2;
  background: #000;
  z-index: 1;
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: calc(100vh);
}

.update-panel {
  top: 100px;
  left: 0;
  width: 100%;
  position: absolute;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;

  .update-inner {
    background-image: url('@/assets/img/update_bg.png');
    background-size: 100%;
    background-position: top center;
    background-repeat: no-repeat;
    width: 350px;
    min-height: 400px;

    .update-content {
      margin-top: 230px;
      background: #fff;
      padding: 15px;

      .update-content-title {
        font-size: 18px;
        color: #000;
      }

      .update-list {
        margin-top: 5px;
        max-height: 150px;
        overflow: auto;
      }
    }

    .download-progress {
      background: #fff;
      padding: 10px;
      border-radius: 0 0 10px 10px;

      .download-tips {
        margin-top: 5px;
        text-align: center;
        font-size: 14px;
        color: #6e6e6e;
      }
    }

    .op-btn {
      background: #fff;
      border-radius: 0 0 10px 10px;
      border-top: 1px solid #ddd;
      display: flex;
      align-items: center;
      overflow: hidden;
      line-height: 40px;

      .cancel {
        width: 50%;
        text-align: center;
        color: #989898;
        cursor: pointer;
      }

      .update {
        width: 50%;
        border-left: 1px solid #ddd;
        text-align: center;
        background: #07c160;
        color: #fff;
        cursor: pointer;
      }
    }
  }
}
</style>
