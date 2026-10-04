<template>
  <ContentPanel v-loading="copying" element-loading-text="正在移动文件">
    <el-form
      ref="formDataRef"
      label-position="top"
      :model="formData"
      :rules="rules"
      label-width="80px"
      @submit.prevent
    >
      <el-form-item label="文件管理" prop="" class="file-manage">
        <div class="file-input" :title="formData.sysSetting">
          {{ formData.sysSetting }}
        </div>
        <div class="tips">文件的默认保存位置</div>
      </el-form-item>
      <el-form-item label="" prop="">
        <el-button type="primary" @click="openLocalFolder">打开文件夹</el-button>
        <el-button type="primary" @click="changeFolder">更改存储路径</el-button>
      </el-form-item>
    </el-form>
  </ContentPanel>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useIpcListeners } from '@/composables/useIpcListeners'
const ipc = useIpcListeners()

const formData = ref({})
const formDataRef = ref()
const rules = {}

/**
 * 获取文件存储目录
 */
const getSysSetting = () => {
  window.ipcRenderer.send('getSysSetting')
}

//保存更改目录
const copying = ref(false)
const changeFolder = () => {
  window.ipcRenderer.send('changeLocalFolder')
}

//打开文件夹
const openLocalFolder = () => {
  window.ipcRenderer.send('openLocalFolder')
}

onMounted(() => {
  getSysSetting()
  ipc.on('getSysSettingCallback', (event, sysSetting) => {
    copying.value = false
    sysSetting = JSON.parse(sysSetting)
    formData.value = {
      sysSetting: sysSetting.localFileFolder
    }
  })
  ipc.on('copyCallback', (event) => {
    copying.value = true
  })
})
</script>

<style scoped lang="less">
.file-manage {
  :deep(.el-form-item__content) {
    display: block;
  }

  .file-input {
    background: #fff;
    padding: 0 5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 16px;
  }

  .tips {
    color: #888888;
    font-size: 13px;
  }
}
</style>
