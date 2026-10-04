<!--用户信息的框-->
<template>
  <div class="user-panel">
    <AvatarBase
      :user-id="userInfo.userId || userInfo.contactId"
      :width="60"
      :border-radius="5"
      :show-detail="true"
    ></AvatarBase>
    <div class="user-info">
      <div class="nick-name">
        {{ userInfo.remark || userInfo.nickName }}
        <div v-if="userInfo.remark" class="info">昵称：{{ userInfo.nickName }}</div>
        <span v-if="userInfo.sex === 0" class="iconfont icon-woman"></span>
        <span v-if="userInfo.sex === 1" class="iconfont icon-man"></span>
        <div class="info">ID: {{ userInfo.userId || userInfo.contactId }}</div>
        <div v-if="props.showArea" class="info">
          地区: {{ Utils.getAreaInfo(userInfo.areaName) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AvatarBase from '@/components/AvatarBase.vue'
import Utils from '@/utils/Utils'

const props = defineProps({
  userInfo: {
    type: Object,
    default() {}
  },
  showArea: {
    type: Boolean,
    default: true
  }
})
</script>

<style scoped lang="less">
.user-panel {
  display: flex;
  padding-bottom: 20px;

  .user-info {
    flex: 1;
    margin-left: 10px;

    .nick-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #000000;
      font-size: 16px;

      .iconfont {
        font-size: 14px;
      }

      .icon-man {
        color: #2cb6fe;
      }

      .icon-woman {
        color: #fb7373;
      }
    }

    .info {
      font-size: 13px;
      color: #9e9e9e;
      margin-top: 3px;
    }
  }
}
</style>
