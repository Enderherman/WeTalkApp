<template>
  <div class="search-item">
    <Avatar :user-id="data.contactId" :showi-detail="false"></Avatar>
    <div class="contact-info">
      <div class="contact-name"><span v-for="(part, index) in data.searchContactParts" :key="index" :class="{ highlight: part.match }">{{ part.text }}</span></div>
      <div class="last-message"><span v-for="(part, index) in data.searchLastParts" :key="index" :class="{ highlight: part.match }">{{ part.text }}</span></div>
    </div>
  </div>
</template>

<script setup>
const propos = defineProps({
  data: {
    type: Object,
    default: {}
  }
})
</script>

<style scoped lang="less">
.search-item {
  padding: 10px;
  display: flex;
  align-items: center;

  .contact-info {
    margin-left: 10px;

    :deep(.highlight) {
      color: red;
    }

    .last-message {
      color: #999999;
    }
  }

  &:hover {
    background: #ededed;
  }
}
</style>
