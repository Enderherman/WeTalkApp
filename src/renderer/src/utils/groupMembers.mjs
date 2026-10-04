export function removableGroupMembers(members, ownerId) {
  return members.filter((member) => member.userId !== ownerId).map((member) => ({ ...member, contactId: member.userId }))
}

export function createGroupMemberSubmitter({ request, state, onSuccess }) {
  return async (form) => {
    if (state.saving) return false
    state.error = ''
    if (!form.selectContacts?.length) { state.error = '请选择联系人'; return false }
    state.saving = true
    try {
      const result = await request({ url: '/group/addOrRemoveGroupUser', params: { groupId: form.groupId, opType: form.opType, selectContacts: [...new Set(form.selectContacts)].join(',') } })
      if (!result) { state.error = '成员操作失败，请检查权限后重试'; return false }
      onSuccess()
      return true
    } catch (error) { state.error = error.message || '成员操作失败，请重试'; return false }
    finally { state.saving = false }
  }
}
