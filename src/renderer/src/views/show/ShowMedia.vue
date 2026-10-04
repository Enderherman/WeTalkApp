<template>
  <div class="media-window">
    <div class="win-title drag"></div>
    <div class="media-op no-drag">
      <div
        :class="['iconfont icon-left', currentIndex === 0 ? 'not-allow' : '']"
        title="上一张"
        @dblclick.stop
        @click="next(-1)"
      ></div>
      <div
        :class="['iconfont icon-right', currentIndex >= allFileList.length - 1 ? 'not-allow' : '']"
        title="下一张"
        @dblclick.stop
        @click="next(1)"
      ></div>
      <template v-if="fileList[0].fileType === 0">
        <el-divider direction="vertical" />
        <div
          class="iconfont icon-enlarge"
          title="放大"
          @click.stop="changeSize(0.1)"
          @dblclick.stop
        ></div>
        <div
          class="iconfont icon-narrow"
          title="缩小"
          @click="changeSize(-0.1)"
          @dblclick.stop
        ></div>
        <div
          :class="['iconfont', isOne2One ? 'icon-resize' : 'icon-source-size']"
          :title="isOne2One ? '图片适应窗口大小' : '图片原始大小'"
          @dblclick.stop
          @click="resize"
        ></div>
        <div class="iconfont icon-rotate" title="旋转" @dblclick.stop @click="rotate"></div>
        <el-divider direction="vertical" />
      </template>
      <div class="iconfont icon-download" title="另存为" @dblclick.stop @click="saveAs"></div>
    </div>
    <div class="media-panel">
      <viewer
        v-if="fileList[0].fileType === 0 && fileList[0].status === 1"
        :options="options"
        :images="fileList"
        @inited="inited"
      >
        <img :src="fileList[0].url" alt="六百六十六" />
      </viewer>
      <div
        v-show="fileList[0].fileType === 1 && fileList[0].status === 1"
        id="player"
        ref="player"
        style="width: 100%; height: 100%"
      ></div>
      <div v-if="fileList[0].fileType === 2" class="file-panel">
        <div class="file-item">文件名:{{ fileList[0].fileName }}</div>
        <div class="file-item">文件大小:{{ Utils.sizeToStr(fileList[0].fileSize) }}</div>
        <div class="file-item download">
          <el-button type="primary" @click="saveAs">下载文件</el-button>
        </div>
      </div>
      <div v-if="fileList[0].status === 0" class="loading">加载中......</div>
    </div>
    <WinOp @close-callback="closeWin"></WinOp>
  </div>
</template>
<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import DPlayer from 'dplayer'
import 'viewerjs/dist/viewer.css'
import { component as Viewer } from 'v-viewer'
import Utils from '../../utils/Utils'
import { useIpcListeners } from '@/composables/useIpcListeners'
const ipc = useIpcListeners()

const localServerPort = ref()
const currentIndex = ref(1)
const allFileList = ref([])
const fileList = ref([{ filetype: 0, status: 0 }])
const isOne2One = ref(false)
/**
 * 切换下一张图片
 */
const next = (index) => {
  if (currentIndex.value + index < 0 || currentIndex.value + index >= allFileList.value.length)
    return
  currentIndex.value += index
  getCurrentFile()
}

/**
 * 保存文件
 */
const saveAs = () => {
  const currentFile = allFileList.value[currentIndex.value]
  window.ipcRenderer.send('saveAs', {
    partType: currentFile.partType,
    fileId: currentFile.fileId,
    fileType: currentFile.fileType,
    fileName: currentFile.fileName,
    forceGet: currentFile.forceGet
  })
}

const options = ref({
  inline: true,
  toolbar: false,
  navbar: false,
  button: false,
  title: false,
  zoomRatio: 0.1, // 每次缩放的比例
  zoomOnWheel: true // 启用原生滚轮缩放
})

const viewerMy = ref(null)
const inited = (e) => {
  viewerMy.value = e
}

const changeSize = (delta) => {
  if (!viewerMy.value) return
  viewerMy.value.zoom(delta) // 直接使用 zoom 方法，delta 为正表示放大，为负表示缩小
}

const rotate = () => {
  viewerMy.value.rotate(90, true)
}

// 保留原始的 resize 功能
const resize = () => {
  isOne2One.value = !isOne2One.value
  if (!isOne2One.value) {
    // 图片适应窗口大小
    viewerMy.value.zoomTo(viewerMy.value.initialImageData.ratio, true)
  } else {
    // 图片原始大小（1:1）
    viewerMy.value.zoomTo(1, true)
  }
}

/**
 * 视频播放相关
 */
const player = ref()
const dPlayer = ref()
const initPlayer = () => {
  dPlayer.value = new DPlayer({
    element: player.value,
    theme: '#b7daff',
    screenshot: true,
    video: {
      url: ''
    },
    hotkey: true
  })
}
const closeWin = () => {
  dPlayer.value.pause()
}

onMounted(() => {
  initPlayer()
  ipc.on('pageInitData', (event, data) => {
    allFileList.value = data.fileList
    localServerPort.value = data.localServerPort
    let index = 0
    if (data.currentFileId) {
      index = allFileList.value.findIndex((item) => item.fileId === data.currentFileId)
      index = index === -1 ? 0 : index
    }
    currentIndex.value = index
    console.log('本次点击的文件是:', currentIndex.value, allFileList.value[currentIndex.value])
    getCurrentFile()
  })
})

onUnmounted(() => {
})

const getCurrentFile = () => {
  if (dPlayer.value) {
    dPlayer.value.pause()
  }
  const currentFile = allFileList.value[currentIndex.value]
  const url = getUrl(currentFile)
  fileList.value.splice(0, 1, {
    url: url,
    fileType: currentFile.fileType,
    status: 1,
    fileSize: currentFile.fileSize,
    fileName: currentFile.fileName
  })
  console.log('currentFile:', currentFile, 'url:', url, 'fileList:', fileList.value)
  if (currentFile.fileType === 1) {
    dPlayer.value.switchVideo({
      url: url
    })
  }
}

const getUrl = (file) => {
  return `http://127.0.0.1:${localServerPort.value}/file?fileId=${file.fileId}&partType=${file.partType}&fileType=${file.fileType}&showCover=false&forceGet=${file.forceGet}&${new Date().getTime()}`
}
</script>

<style scoped lang="less">
.media-window {
  padding: 0;
  height: calc(100vh);
  border: 1px solid #ddd;
  background: #fff;
  position: relative;
  overflow: hidden;

  .win-title {
    height: 37px;
  }

  .media-op {
    position: absolute;
    left: 0;
    top: 0;
    height: 35px;
    line-height: 35px;
    display: flex;
    align-items: center;

    .iconfont {
      font-size: 18px;
      padding: 0 10px;

      &:hover {
        background: #f3f3f3;
        cursor: pointer;
      }
    }

    .not-allow {
      cursor: not-allowed;
      color: #ddd;
      text-decoration: none;

      &:hover {
        color: #ddd;
        cursor: not-allowed;
        background: none;
      }
    }
  }

  .media-panel {
    height: calc(100vh - 37px);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;

    :deep(.viewer-backdrop) {
      background: #f5f5f5;
    }

    .file-panel {
      .file-item {
        margin-top: 5px;
      }

      .download {
        margin-top: 20px;
        text-align: center;
      }
    }
  }
}
</style>
