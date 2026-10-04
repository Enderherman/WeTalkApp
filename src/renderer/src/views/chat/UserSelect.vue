<template>
  <div>
    <DialogX
      :show="dialogConfig.show"
      :title="dialogConfig.title"
      :buttons="dialogConfig.buttons"
      width="700px"
      @close="dialogConfig.show = false"
    >
      <el-transfer
        v-model="formData.selectContacts"
        :titles="['全部', '已选']"
        :format="{
          noChecked: '${total}',
          hasChecked: '${checked}/${total}'
        }"
        :data="dataList"
        :props="{ key: 'contactId', label: 'contactName' }"
        :disabled="submitState.saving"
        filterable
        :filter-method="search"
      >
        <template #default="{ option }">
          <div class="select-item">
            <div class="avatar">
              <AvatarBase
                :user-id="option.contactId"
                :width="30"
                :border-radius="5"
                :show-detail="false"
              >
              </AvatarBase>
            </div>
            <div class="nick-name" :title="option.contactName">{{ option.remark || option.contactName }}</div>
          </div>
        </template>
      </el-transfer>
      <p v-if="submitState.error" role="alert">{{ submitState.error }}</p>
    </DialogX>
  </div>
</template>

<script setup>
import AvatarBase from '@/components/AvatarBase.vue'
import { ref, reactive } from 'vue'
import Request from '@/utils/Request'
import { createGroupMemberSubmitter } from '@/utils/groupMembers.mjs'

const dialogConfig = ref({
  show: false,
  title: '选择联系人',
  buttons: [
    {
      type: 'primary',
      text: '确定',
      click: () => {
        submitData()
      }
    }
  ]
})

const search = (query, item) => {
  return `${item.remark || ''} ${item.contactName || ''}`.toLowerCase().includes(query.toLowerCase())
}
const dataList = ref([])
const formData = ref({
  selectContacts: []
})

const show = ({ contactList, groupId, opType }) => {
  submitState.error = ''
  dialogConfig.value.title = opType === 0 ? '移除群员' : '添加群员'
  dialogConfig.value.show = true
  dataList.value = contactList
  formData.value = {
    selectContacts: [],
    groupId,
    opType
  }
}

defineExpose({
  show
})

const emit = defineEmits(['callback'])
const submitState = reactive({ saving: false, error: '' })
const submitMembers = createGroupMemberSubmitter({ request: Request, state: submitState, onSuccess: () => { dialogConfig.value.show = false; emit('callback') } })
const submitData = () => submitMembers(formData.value)
</script>

<style scoped lang="less">
.el-transfer {
  width: 100%;
  display: block !important;
  display: flex;

  :deep(.el-transfer-panel) {
    width: 280px;
  }

  :deep(.el-transfer-panel__item) {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 5px;
  }
}

:deep(.el-transfer__buttons) {
  width: 60px;
  flex-direction: column;
  text-align: center;
  padding: 0px;

  .el-transfer__button {
    text-align: center;
    margin-left: 0px;
    margin-right: 0px;
    margin-top: 5px;
    padding: 10px;
    height: 36px;
    border-radius: 50%;
  }
}

.select-item {
  display: flex;

  .avatar {
    width: 30px;
    height: 30px;
  }

  .nick-name {
    flex: 1;
    margin-left: 5px;
  }
}
</style>
