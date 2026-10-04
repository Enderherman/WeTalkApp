<template>
  <div v-if="data.sendUserId === userInfoStore.getInfo().userId" class="message-content-my">
    <div :class="['content-panel', data.messageType === 5 ? 'content-panel-media' : '']">
      <div v-if="data.messageType === 5 && data.status === 2" class="upload-error" role="alert">
        {{ data.uploadError || '上传失败，请重试' }}
        <button type="button" @click="emit('retryMessage', data)">重新上传</button>
      </div>
      <div v-else-if="data.status === 0" class="sending">
        <el-skeleton :animated="true">
          <template #template>
            <el-skeleton-item class="skeleton-item" variant="image" />
          </template>
        </el-skeleton>
      </div>
      <template v-else>
        <div v-if="data.messageType !== 5" class="content">{{ messageText(data.messageContent) }}</div>
        <div class="content" v-else>
          <template v-if="data.fileType === 0">
            <ChatMessageImage :data="data" @click="showDetail"></ChatMessageImage>
          </template>
          <template v-if="data.fileType === 1">
            <ChatMessageVideo :data="data" @click="showDetail"></ChatMessageVideo>
          </template>
          <template v-if="data.fileType === 2">
            <ChatMessageFile :data="data" @click="showDetail"></ChatMessageFile>
          </template>
        </div>
      </template>
    </div>
    <Avatar :width="35" :user-id="userInfoStore.getInfo().userId"></Avatar>
  </div>
  <div v-else class="message-content-other">
    <div class="user-avatar">
      <Avatar :width="35" :user-id="data.sendUserId"></Avatar>
    </div>
    <div
      :class="[
        'content-panel',
        data.contactType === 1 ? 'group-content' : '',
        data.messageType === 5 ? 'content-panel-media' : ''
      ]"
    >
      <div v-if="data.contactType === 1" class="nick-name">{{ data.sendUserName }}</div>
      <div v-if="data.status === 0" class="sending">
        <el-skeleton :animated="true">
          <template #template>
            <el-skeleton-item class="skeleton-item" variant="image" />
          </template>
        </el-skeleton>
      </div>
      <template v-else>
        <div v-if="data.messageType !== 5" class="content">{{ messageText(data.messageContent) }}</div>
        <div v-else class="content">
          <template v-if="data.fileType === 0">
            <ChatMessageImage :data="data" @click="showDetail"></ChatMessageImage>
          </template>
          <template v-if="data.fileType === 1">
            <ChatMessageVideo :data="data" @click="showDetail"></ChatMessageVideo>
          </template>
          <template v-if="data.fileType === 2">
            <ChatMessageFile :data="data" @click="showDetail"></ChatMessageFile>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import ChatMessageImage from '@/views/chat/ChatMessageImage.vue'
import ChatMessageVideo from '@/views/chat/ChatMessageVideo.vue'
import { useUserInfoStore } from '@/stores/UserInfoStore'
import ChatMessageFile from '@/views/chat/ChatMessageFile.vue'
import { messageText } from '@/utils/messageText.mjs'

const userInfoStore = useUserInfoStore()
const props = defineProps({
  data: {
    type: Object,
    default: {}
  },
  currentSession: {
    type: Object,
    default: {}
  }
})
const emit = defineEmits(['showMediaDetail', 'retryMessage'])
const showDetail = () => {
  if (props.data.status === 0) {
    return
  }
  emit('showMediaDetail', props.data.messageId)
}
</script>

<style scoped lang="less">
.sending {
  width: 170px;
  height: 170px;
  overflow: hidden;
  float: right;
  margin-right: 5px;
  border-radius: 5px;

  .skeleton-item {
    width: 170px;
    height: 170px;
  }
}

.content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  display: inline-block;
  padding: 8px;
  color: #474747;
  border-radius: 5px;
  text-align: left;
  font-size: 14px;

  :deep(.emoji) {
    font-size: 20px;
  }
}

.content-panel {
  flex: 1;
  position: relative;

  &:after {
    content: '';
    position: absolute;
    display: block;
    width: 10px;
    height: 10px;
    background: #95ec69;
    transform: rotate(45deg);
    border-radius: 2px;
    top: 13px;
  }
}

.content-panel-media {
  .content {
    border-radius: 5px;
    background: none !important;
    overflow: hidden;
    padding: 0;
  }

  &:after {
    display: none;
  }
}

.message-content-my {
  display: flex;

  .content-panel {
    margin-right: 10px;
    text-align: right;
    padding-left: 32%;

    .content {
      background: #95ec69;
    }

    &:after {
      right: -4px;
    }
  }
}

.message-content-other {
  display: flex;
  padding-right: 32%;

  .user-avatar {
    margin-right: 10px;
    width: 35px;
    height: 35px;
  }

  .content-panel {
    flex: 1;
    position: relative;
    text-align: left;

    .nick-name {
      font-size: 12px;
      color: #b2b2b2;
    }

    .content {
      background: #fff;
    }

    .sending {
      float: left;
    }

    &:after {
      left: -4px;
      background: #fff;
    }
  }

  .content-panel-media {
    justify-content: flex-start;
  }
}

.group-content {
  margin-top: -6px;

  .content {
    margin-top: 6px;
  }

  &:after {
    left: -4px;
    top: 35px;
    background: #fff;
  }
}
</style>
