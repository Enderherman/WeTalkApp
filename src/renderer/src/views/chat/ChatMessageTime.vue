<template>
  <div class="message-time">
    {{ formatMessageTime(data.sendTime) }}
  </div>
</template>
<script setup>
import { formatMessageTime } from '@/utils/messageTime.mjs'

const props = defineProps({
  data: {
    type: Object,
    default: {}
  }
})
</script>

<style scoped lang="less">
.message-time {
  background: #dadada;
  display: inline-block;
  color: #4b5563;
  font-size: 12px;
  padding: 2px 5px;
  border-radius: 3px;
  margin: 10px 0;
}
</style>
