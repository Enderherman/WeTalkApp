<template>
  <div class="send-panel">
    <div class="toolbar">
      <el-popover
        :visible="showEmojiPopover"
        trigger="click"
        placement="top"
        :teleported="false"
        :popper-style="{
          padding: '0px 10px 10px 10px',
          width: '490px'
        }"
        @show="openPopover"
        @hide="closePopover"
      >
        <template #default>
          <el-tabs v-model="activeEmoji" @click.stop>
            <el-tab-pane v-for="emoji in emojiList" :label="emoji.name" :name="emoji.name">
              <div class="emoji-list">
                <div v-for="item in emoji.emojiList" class="emoji-item" @click="sendEmoji(item)">
                  {{ item }}
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </template>
        <template #reference>
          <div class="iconfont icon-emoji" @click="showEmojiPopoverHandler"></div>
        </template>
      </el-popover>
      <el-upload
        ref="uploadFileRef"
        name="file"
        :show-file-list="false"
        :multiple="true"
        :limit="fileLimit"
        :http-request="uploadFile"
        :on-exceed="uploadExceed"
      >
        <div class="iconfont icon-folder"></div>
      </el-upload>
    </div>
    <div class="input-area" @drop="dropHandler" @dragover="dragOverHandler">
      <el-input
        v-model="msgContent"
        :rows="5"
        type="textarea"
        resize="none"
        maxlength="500"
        show-word-limit
        spellcheck="false"
        input-style="background :#f5f5f5;border : none;"
        @keydown.enter="sendMessage"
        @paste="pasteFile"
      />
    </div>
    <div class="send-btn-panel">
      <el-popover
        trigger="click"
        :visible="showSendMsgPopover"
        :hide-after="1500"
        placement="top-end"
        :teleported="false"
        :popper-style="{ padding: '5px', 'min-width': '0px', width: '120px' }"
        @show="openPopover"
        @hide="closePopover"
      >
        <template #default>
          <span class="empty-msg">不能发送空白信息</span>
        </template>
        <template #reference>
          <span class="send-btn" @click="sendMessage">发送(S)</span>
        </template>
      </el-popover>
    </div>
    <SearchAdd ref="searchAddRef"></SearchAdd>
  </div>
</template>

<script setup>
import emojiList from '@/utils/Emoji'
import Request from '@/utils/Request'
import Api from '@/utils/Api'
import Confirm from '@/utils/Confirm'
import { onMounted, onUnmounted, ref } from 'vue'
import { getFileType } from '@/utils/Constants'
import { useUserInfoStore } from '@/stores/UserInfoStore'
import { useSysSettingStore } from '@/stores/SystemSettingStore'
import SearchAdd from '@/views/contact/SearchAdd.vue'

const userInfoStore = useUserInfoStore()
const sysSettingStore = useSysSettingStore()
const props = defineProps({
  currentChatSession: {
    type: Object,
    default: {}
  }
})
//隐藏展示popover
const showEmojiPopover = ref(false)
const showSendMsgPopover = ref(false)
const hidePopover = () => {
  showEmojiPopover.value = false
  showSendMsgPopover.value = false
}
const activeEmoji = ref('笑脸')
const msgContent = ref('')
const openPopover = () => {
  document.addEventListener('click', hidePopover, false)
}
const closePopover = () => {
  document.removeEventListener('click', hidePopover, false)
}
const showEmojiPopoverHandler = () => {
  showEmojiPopover.value = true
}
const sendEmoji = (emoji) => {
  msgContent.value += emoji
  showEmojiPopover.value = false
}
const fileLimit = 10

const emit = defineEmits(['sendMessage4Local'])
const sendMessage = (e) => {
  if (e.shiftKey && e.keyCode === 13) {
    return
  }
  e.preventDefault()

  const messageContent = msgContent.value ? msgContent.value.replace(/\s*$/g, '') : ''
  if (messageContent === '') {
    showSendMsgPopover.value = true
    return
  }
  sendMessageDo(
    {
      messageContent,
      messageType: 2
    },
    true
  )
}

//发送消息处理
const sendMessageDo = async (
  messageObj = {
    messageContent,
    messageType,
    localFilePath,
    fileSize,
    fileName,
    filePath,
    fileType
  },
  cleanMessageContent
) => {
  //判断文件大小
  if (!checkFileSize(messageObj.fileType, messageObj.fileSize, messageObj.fileName)) {
    return
  }
  if (messageObj.fileSize === 0) {
    Confirm({
      message: `${messageObj.fileName}是一个空文件无法发送,请重新选择`,
      showCancelBtn: false
    })
    return
  }
  messageObj.sessionId = props.currentChatSession.sessionId
  messageObj.sentdUserId = userInfoStore.getInfo().userId

  let result = await Request({
    url: Api.sendMessage,
    showLoading: false,
    params: {
      messageContent: messageObj.messageContent,
      contactId: props.currentChatSession.contactId,
      messageType: messageObj.messageType,
      fileSize: messageObj.fileSize,
      fileName: messageObj.fileName,
      fileType: messageObj.fileType
    },
    showError: false,
    errorCallback: (responseData) => {
      Confirm({
        message: responseData.message,
        okfun: () => {
          addContact(props.currentChatSession.contactId, responseData.code)
        },
        okTest: '重新申请'
      })
    }
  })
  if (!result) {
    return
  }
  if (cleanMessageContent) {
    msgContent.value = ''
  }
  Object.assign(messageObj, result.data)
  emit('sendMessage4Local', messageObj)
  console.log('选中的消息:', messageObj)
  //保存消息到本地数据库
  window.ipcRenderer.send('addChatMessage', messageObj)
}

/**
 * 上传文件异常
 */
const uploadExceed = (files) => {
  checkFileCount(files)
}

/**
 * 文件上传
 */
const uploadFileRef = ref(null)
const uploadFile = (file) => {
  uploadFileDo(file.file)
  if (uploadFileRef.value) {
    uploadFileRef.value.clearFiles()
  } else {
    console.log('uploadFileRef is null我空了')
  }
}

const uploadFileDo = (file) => {
  const fileType = getFileTypeByFileName(file.name)
  //先发送消息
  sendMessageDo(
    {
      messageContent: '[' + getFileType(fileType) + ']',
      messageType: 5,
      localFilePath: file.path,
      fileSize: file.size,
      fileName: file.name,
      filePath: file.path,
      fileType: fileType
    },
    false
  )
}

const getFileTypeByFileName = (fileName) => {
  const fileSuffix = fileName.split('.').pop()
  return getFileType(fileSuffix)
}
//添加好友
const searchAddRef = ref(null)
const addContact = (contactId, code) => {
  searchAddRef.value.show({
    contactId,
    contactType: code === 902 ? 'USER' : 'GROUP'
  })
}

/**
 * 校验文件大小
 */
const checkFileSize = (fileType, fileSize, fileName) => {
  const SIZE_MB = 1024 * 1024
  const settings = sysSettingStore.getSetting()
  const fileSizeLimit = settings[fileType === 0 ? 'maxImageSize' : fileType === 1 ? 'maxVideoSize' : 'maxFileSize']
  if (fileSize > fileSizeLimit * SIZE_MB) {
    Confirm({
      message: `文件 ${fileName} 超出 ${fileSizeLimit} MB限制`,
      showCancelBtn: false
    })
    return false
  }
  return true
}
/**
 * 校验文件发送数量
 */
const fileCountLimit = 10
const checkFileCount = (files) => {
  if (files.length > fileCountLimit) {
    Confirm({
      showCancelBtn: false,
      message: `一次最多上传十份文件`
    })
    return false
  }
  return true
}

/**
 * 拖入文件上传
 */
const dragOverHandler = (e) => {
  e.preventDefault()
}
const dropHandler = (e) => {
  e.preventDefault()
  const files = e.dataTransfer.files
  if (files.length > 0) {
    if (checkFileCount(files)) {
      for (let i = 0; i < files.length; i++) {
        uploadFileDo(files[i])
      }
    }
  }
}
/**
 * 粘贴上传
 */
const pasteFile = async (event) => {
  let items = event.clipboardData && event.clipboardData.items

  const fileData = {}
  for (const item of items) {
    console.log('item:', item.kind)
    if (item.kind !== 'file') {
      break
    }
    const file = await item.getAsFile()
    //文件粘贴
    if (file.path !== '') {
      uploadFileDo(file)
    } else {
      //截图再上传
      const imageFile = new File([file], 'temp.png')
      let fileReader = new FileReader()
      fileReader.onloadend = function () {
        const byteArray = new Uint8Array(this.result)
        fileData.byteArray = byteArray
        fileData.name = imageFile.name
        window.ipcRenderer.send('saveClipBoardFile', fileData)
      }
      fileReader.readAsArrayBuffer(imageFile)
    }
  }
}

onMounted(() => {
  window.ipcRenderer.on('saveClipBoardFileCallback', (event, file) => {
    console.log('saveClipBoardFileCallback', file)
    const fileType = 0
    sendMessageDo(
      {
        messageContent: '[' + getFileType(fileType) + ']',
        messageType: 5,
        localFilePath: file.path,
        fileSize: file.size,
        fileName: file.name,
        filePath: file.path,
        fileType: fileType
      },
      false
    )
  })
})
onUnmounted(()=>{
  window.ipcRenderer.removeAllListeners('saveClipBoardFileCallback')
})
</script>

<style scoped lang="less">
.emoji-list {
  .emoji-item {
    float: left;
    font-size: 23px;
    padding: 2px;
    text-align: center;
    border-radius: 3px;
    margin-left: 10px;
    margin-top: 5px;
    cursor: pointer;

    &:hover {
      background: #ddd;
    }
  }
}

.send-panel {
  height: 200px;
  border-top: 1px solid #ddd;

  .toolbar {
    height: 40px;
    display: flex;
    align-items: center;
    padding-left: 10px;

    .iconfont {
      color: #494949;
      font-size: 20px;
      margin-left: 10px;
      cursor: pointer;
    }

    :deep(.el-tabs__header) {
      margin-bottom: 0;
    }
  }

  .input-area {
    padding: 0 10px;
    outline: none;
    width: 100%;
    height: 115px;
    overflow: auto;
    word-wrap: break-word;
    word-break: break-all;

    :deep(.el-textarea__inner) {
      box-shadow: none;
    }

    :deep(.el-input__count) {
      background: none;
      right: 12px;
    }
  }

  .send-btn-panel {
    text-align: right;
    padding-top: 10px;
    margin-right: 22px;

    .send-btn {
      cursor: pointer;
      color: #07c160;
      background: #e9e9e9;
      border-radius: 5px;
      padding: 8px 25px;

      &:hover {
        background: #d2d2d2;
      }
    }

    .empty-msg {
      font-size: 13px;
    }
  }
}
</style>
