<template>
  <div class="group-panel">
    <el-drawer ref="drawerRef" v-model="showDrawer" model-class="mask-style" size="300">
      <div class="group-panel-body">
        <div class="member-list">
          <div v-for="item in memberList" class="member-item">
            <Avatar :user-id="item.userId" :width="30" @close-drawer="closeDrawerHandler"></Avatar>
            <div class="nick-name" :title="item.contactName">{{ item.contactName }}</div>
            <div v-if="item.userId === groupInfo.groupOwnId" class="owner-tag">群主</div>
          </div>
          <template v-if="userInfoStore.getInfo().userId === groupInfo.groupOwnId">
            <div class="member-item" @click="addUser">
              <div class="iconfont icon-add icon-op"></div>
              <div class="nick-name">添加</div>
            </div>
            <div class="member-item" @click="removeUser">
              <div class="iconfont icon-min icon-op"></div>
              <div class="nick-name">移除</div>
            </div>
          </template>
        </div>
        <div class="line"></div>
        <div class="part-title">群头像</div>
        <div class="part-content">
          <AvatarBase
            :user-id="groupInfo.groupId"
            :width="60"
            :border-radius="5"
            :show-detail="true"
          ></AvatarBase>
        </div>
        <div class="part-title">群号</div>
        <div class="part-content">{{ groupInfo.groupId }}</div>
        <div class="part-title">群聊名称</div>
        <div class="part-content">{{ groupInfo.groupName }}</div>
        <div class="part-title">群公告</div>
        <div class="part-content">{{ groupInfo.groupNotice || '-' }}</div>
        <div class="line"></div>
        <a
          v-if="userInfoStore.getInfo().userId === groupInfo.groupOwnId"
          href="javascript:void(0)"
          class="leave-btn"
          @click="dissolutionGroup"
          >解散群聊</a
        >
        <a v-else href="javascript:void(0)" class="leave-btn" @click="leaveGroup">退出群聊</a>
      </div>
    </el-drawer>
    <UserSelect ref="userSelectRef" @callback="addOrRemoveUserCallback"></UserSelect>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Api from '@/utils/Api'
import Request from '@/utils/Request'
import Confirm from '@/utils/Confirm'
import { useUserInfoStore } from '@/stores/UserInfoStore'
import { useContactStateStore } from '@/stores/ContactStateStore'
import AvatarBase from '@/components/AvatarBase.vue'
import UserSelect from '@/views/chat/UserSelect.vue'
import Message from '@/plugin/Message'
import { removableGroupMembers } from '@/utils/groupMembers.mjs'

const userInfoStore = useUserInfoStore()
const contactStateStore = useContactStateStore()

const drawerRef = ref()
const showDrawer = ref(false)
const groupInfo = ref({})
const memberList = ref([])
const show = async (groupId) => {
  let result = await Request({
    url: Api.getGroupInfo4Chat,
    params: {
      groupId: groupId
    },
    showLoading: false,
    showError: false,
    errorCallback: (response) => {
      Confirm({
        message: response.message || '无法读取群资料',
        showCancelBtn: false
      })
    }
  })
  if (!result) {
    return
  }
  console.log(result.data)
  showDrawer.value = true
  memberList.value = result.data.userContactList
  groupInfo.value = result.data.groupInfo
}

const closeDrawerHandler = () => {
  showDrawer.value = false
}

defineExpose({
  show
})

const userSelectRef = ref()
const addUser = async () => {
  let result = await Request({
    url: Api.loadContact,
    params: {
      contactType: 'USER'
    }
  })
  if (!result) {
    return
  }
  const contactIds = memberList.value.map((item) => item['userId'])
  let contactList = result.data
  contactList.forEach((element) => {
    if (contactIds.includes(element.contactId)) {
      element.disabled = true
    }
  })
  userSelectRef.value.show({
    contactList,
    groupId: groupInfo.value.groupId,
    opType: 1
  })
}
const removeUser = async () => {
  const contactList = removableGroupMembers(memberList.value, groupInfo.value.groupOwnId)
  userSelectRef.value.show({
    contactList,
    groupId: groupInfo.value.groupId,
    opType: 0
  })
}

const addOrRemoveUserCallback = () => {
  showDrawer.value = false
}

/**
 * 退出群聊
 */
const emit = defineEmits(['deleteChatSessionCallback'])
const leaveGroup = async () => {
  Confirm({
    message: '确认退出群聊吗？',
    okfun: async () => {
      let result = await Request({
        url: Api.leaveGroup,
        params: {
          groupId: groupInfo.value.groupId
        }
      })
      if (!result) {
        return
      }
      Message.success('退出成功')
      contactStateStore.setContactReload('LEAVE_GROUP')
      emit('deleteChatSessionCallback', groupInfo.value.groupId)
      showDrawer.value = false
    }
  })
}

/**
 * 解散群聊
 */
const dissolutionGroup = async () => {
  Confirm({
    message: '确认解散群聊吗？不可撤销喔',
    okfun: async () => {
      let result = await Request({
        url: Api.dissolutionGroup,
        params: {
          groupId: groupInfo.value.groupId
        }
      })
      if (!result) {
        return
      }
      Message.success('解散成功')
      emit('deleteChatSessionCallback', groupInfo.value.groupId)
      contactStateStore.setContactReload('DISSOLUTION_GROUP')
      showDrawer.value = false
    }
  })
}
</script>

<style scoped lang="less">
.group-panel {
  color: #000000;

  :deep(.mask-style) {
    top: 1px;
    right: 1px;
    height: calc(100vh - 2px);
  }

  :deep(.el-drawer) {
    -webkit-app-region: no-drag;
  }

  :deep(.el-drawer_header) {
    margin-bottom: 10px;
  }

  :deep(.el-drawer_body) {
    padding: 10px;
  }

  .group-panel-body {
    .member-list {
      display: flex;
      flex-wrap: wrap;

      .member-item {
        width: 20%;
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 5px;
        padding: 5px;
        position: relative;

        .owner-tag {
          position: absolute;
          left: 0px;
          top: 0px;
          font-size: 12px;
          background: #07c160;
          color: #fff;
          border-radius: 3px;
        }

        .nick-name {
          margin-top: 3px;
          width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          text-align: center;
        }

        .icon-op {
          cursor: pointer;
          width: 30px;
          height: 30px;
          display: flex;
          justify-content: center;
          align-items: center;
          border: 1px solid #dbdbdb;
          color: #6e6e6e;
        }
      }
    }

    .line {
      margin-bottom: 10px;
      border-top: 1px solid #ddd;
      height: 1px;
    }

    .part-title {
      margin-top: 10px;
    }

    .part-content {
      color: #757575;
      margin-bottom: 10px;
    }

    .leave-btn {
      color: #f45454;
      text-decoration: none;
      text-align: center;
      display: block;
      margin-top: 10px;
    }
  }
}
</style>
