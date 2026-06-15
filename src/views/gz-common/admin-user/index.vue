<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzAdminUser.title') }}</span>
          <span class="ticket-tag">GZ-ADMIN-002</span>
        </div>
      </template>

      <el-alert :title="t('gzAdminUser.alertTitle')" type="info" :description="t('gzAdminUser.alertDesc')" show-icon :closable="false" class="mb-3" />

      <!-- 查询表单 -->
      <el-form ref="queryFormRef" :model="queryParams" inline class="mb-2" @submit.prevent="handleQuery">
        <el-form-item :label="t('gzAdminUser.userName')" prop="userName">
          <el-input
            v-model="queryParams.userName"
            :placeholder="t('gzAdminUser.userNamePlaceholder')"
            clearable
            style="width: 200px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item :label="t('gzAdminUser.phoneNumber')" prop="phonenumber">
          <el-input
            v-model="queryParams.phonenumber"
            :placeholder="t('gzAdminUser.phoneNumberPlaceholder')"
            clearable
            style="width: 180px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item :label="t('gzAdminUser.status')" prop="status">
          <el-select v-model="queryParams.status" :placeholder="t('gzAdminUser.statusPlaceholder')" clearable style="width: 140px">
            <el-option v-for="dict in sys_normal_disable" :key="dict.value" :label="dict.label" :value="dict.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('gzAdminUser.role')" prop="roleId">
          <el-select v-model="queryParams.roleId" :placeholder="t('gzAdminUser.rolePlaceholder')" clearable style="width: 160px">
            <el-option :label="t('gzAdminUser.roleOwner')" value="100" />
            <el-option :label="t('gzAdminUser.roleStaff')" value="101" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['gz:admin-user:list']" type="primary" :icon="Search" @click="handleQuery">
            {{ t('gzAdminUser.search') }}
          </el-button>
          <el-button :icon="Refresh" @click="resetQuery">{{ t('gzAdminUser.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <!-- 工具栏 -->
      <el-row :gutter="10" class="mb-2">
        <el-col :span="1.5">
          <el-button v-hasPermi="['gz:admin-user:add']" type="primary" plain :icon="Plus" @click="handleAdd">
            {{ t('gzAdminUser.add') }}
          </el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button v-hasPermi="['gz:admin-user:edit']" type="success" plain :icon="Edit" :disabled="single" @click="handleUpdate()">
            {{ t('gzAdminUser.edit') }}
          </el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button v-hasPermi="['gz:admin-user:remove']" type="danger" plain :icon="Delete" :disabled="multiple" @click="handleDelete()">
            {{ t('gzAdminUser.del') }}
          </el-button>
        </el-col>
      </el-row>

      <!-- 列表 -->
      <el-table border :data="userList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" align="center" :selectable="(row) => row.userId != 1" />
        <el-table-column :label="t('gzAdminUser.userName')" prop="userName" align="center" min-width="120" show-overflow-tooltip />
        <el-table-column :label="t('gzAdminUser.nickName')" prop="nickName" align="center" min-width="120" show-overflow-tooltip />
        <el-table-column :label="t('gzAdminUser.role')" align="center" min-width="100">
          <template #default="scope">
            <el-tag v-for="role in scope.row.roles || []" :key="role.roleId" :type="role.roleId == 100 ? 'danger' : 'primary'" size="small">
              {{ role.roleId == 100 ? t('gzAdminUser.roleOwner') : role.roleId == 101 ? t('gzAdminUser.roleStaff') : role.roleName }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzAdminUser.gzStore')" align="center" min-width="120">
          <template #default="scope">
            <span v-if="scope.row.gzStoreId">{{ resolveStoreName(scope.row.gzStoreId) }}</span>
            <span v-else class="text-gray-400">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('gzAdminUser.phoneNumber')" prop="phonenumber" align="center" width="120" />
        <el-table-column :label="t('gzAdminUser.status')" align="center" width="100">
          <template #default="scope">
            <el-switch
              v-model="scope.row.status"
              active-value="0"
              inactive-value="1"
              :disabled="scope.row.userId == 1 || !hasEditPerm"
              @change="handleStatusChange(scope.row)"
            />
          </template>
        </el-table-column>
        <el-table-column :label="t('gzAdminUser.createTime')" prop="createTime" align="center" width="160" />
        <el-table-column :label="t('gzAdminUser.actions')" align="center" fixed="right" width="220" class-name="small-padding fixed-width">
          <template #default="scope">
            <template v-if="scope.row.userId == 1">
              <el-tooltip :content="t('gzAdminUser.cannotEditAdmin')" placement="top">
                <span class="text-gray-400">—</span>
              </el-tooltip>
            </template>
            <template v-else>
              <el-tooltip :content="t('gzAdminUser.edit')" placement="top">
                <el-button v-hasPermi="['gz:admin-user:edit']" link type="primary" :icon="Edit" @click="handleUpdate(scope.row)" />
              </el-tooltip>
              <el-tooltip :content="t('gzAdminUser.del')" placement="top">
                <el-button v-hasPermi="['gz:admin-user:remove']" link type="danger" :icon="Delete" @click="handleDelete(scope.row)" />
              </el-tooltip>
              <el-tooltip :content="t('gzAdminUser.resetPwd')" placement="top">
                <el-button v-hasPermi="['gz:admin-user:resetPwd']" link type="warning" :icon="Key" @click="handleResetPwd(scope.row)" />
              </el-tooltip>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <!-- 新增 / 修改对话框 -->
    <el-dialog v-model="dialog.visible" :title="dialog.title" width="640px" append-to-body @close="closeDialog">
      <el-form ref="userFormRef" :model="form" :rules="rules" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item v-if="!form.userId" :label="t('gzAdminUser.userName')" prop="userName">
              <el-input v-model="form.userName" :placeholder="t('gzAdminUser.userNamePlaceholder')" maxlength="20" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzAdminUser.nickName')" prop="nickName">
              <el-input v-model="form.nickName" :placeholder="t('gzAdminUser.nickNamePlaceholder')" maxlength="30" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col v-if="!form.userId" :span="12">
            <el-form-item :label="t('gzAdminUser.password')" prop="password">
              <el-input v-model="form.password" type="password" show-password :placeholder="t('gzAdminUser.passwordPlaceholder')" maxlength="20" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzAdminUser.role')" prop="roleIds">
              <el-select v-model="form.roleIds[0]" :placeholder="t('gzAdminUser.rolePlaceholder')" style="width: 100%">
                <el-option :label="t('gzAdminUser.roleOwner')" value="100" />
                <el-option :label="t('gzAdminUser.roleStaff')" value="101" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="t('gzAdminUser.phoneNumber')" prop="phonenumber">
              <el-input v-model="form.phonenumber" maxlength="11" :placeholder="t('gzAdminUser.phoneNumberPlaceholder')" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzAdminUser.email')" prop="email">
              <el-input v-model="form.email" maxlength="50" :placeholder="t('gzAdminUser.emailPlaceholder')" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="t('gzAdminUser.gzStore')" prop="gzStoreId">
              <el-select
                v-model="form.gzStoreId"
                clearable
                :placeholder="t('gzAdminUser.gzStorePlaceholder')"
                style="width: 100%"
                :disabled="!storeOptions.length"
              >
                <el-option v-for="opt in storeOptions" :key="opt.id" :label="opt.name" :value="opt.id" />
              </el-select>
              <span v-if="!storeOptions.length" class="text-xs text-gray-400">{{ t('gzAdminUser.gzStoreEmpty') }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('gzAdminUser.status')">
              <el-radio-group v-model="form.status">
                <el-radio v-for="dict in sys_normal_disable" :key="dict.value" :value="dict.value">{{ dict.label }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item :label="t('gzAdminUser.remark')">
              <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="submitForm">{{ t('gzAdminUser.confirm') }}</el-button>
        <el-button @click="cancel">{{ t('gzAdminUser.cancel') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="GzAdminUser" lang="ts">
import { Search, Refresh, Plus, Edit, Delete, Key } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { to } from 'await-to-js';

import api from '@/api/gz-common/admin-user';
import type { GzAdminUserQuery } from '@/api/gz-common/admin-user';
import type { UserForm, UserVO } from '@/api/system/user/types';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { sys_normal_disable } = toRefs<any>(proxy?.useDict('sys_normal_disable'));

/** ruoyi UserForm 上额外加 gzStoreId（后端 sys_user 已含此列，ADMIN-001 ALTER） */
interface GzAdminUserForm extends UserForm {
  gzStoreId?: number | string | null;
}

const userList = ref<UserVO[]>([]);
const loading = ref(false);
const total = ref(0);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);

const queryFormRef = ref<ElFormInstance>();
const userFormRef = ref<ElFormInstance>();
const dialog = reactive<DialogOption>({ visible: false, title: '' });

const initFormData: GzAdminUserForm = {
  userId: undefined,
  userName: '',
  nickName: '',
  password: '',
  phonenumber: '',
  email: '',
  status: '0',
  remark: '',
  postIds: [],
  roleIds: ['101'], // staff 默认
  gzStoreId: null
};

const initQueryParams: GzAdminUserQuery = {
  pageNum: 1,
  pageSize: 10,
  userName: '',
  phonenumber: '',
  status: '',
  roleId: ''
};

const form = ref<GzAdminUserForm>({ ...initFormData });
const queryParams = ref<GzAdminUserQuery>({ ...initQueryParams });

/** 校验规则（与 ruoyi 自带 user 同款 + 角色必填） */
const rules = ref({
  userName: [
    { required: true, message: t('gzAdminUser.ruleUserNameRequired'), trigger: 'blur' },
    { min: 2, max: 20, message: t('gzAdminUser.ruleUserNameLength'), trigger: 'blur' }
  ],
  nickName: [{ required: true, message: t('gzAdminUser.ruleNickNameRequired'), trigger: 'blur' }],
  password: [
    { required: true, message: t('gzAdminUser.rulePasswordRequired'), trigger: 'blur' },
    { min: 5, max: 20, message: t('gzAdminUser.rulePasswordLength'), trigger: 'blur' },
    { pattern: /^[^<>"'|\\]+$/, message: t('gzAdminUser.rulePasswordPattern'), trigger: 'blur' }
  ],
  email: [{ type: 'email', message: t('gzAdminUser.ruleEmailPattern'), trigger: ['blur', 'change'] }],
  phonenumber: [{ pattern: /^1[3-9]\d{9}$/, message: t('gzAdminUser.rulePhonePattern'), trigger: 'blur' }],
  roleIds: [{ required: true, message: t('gzAdminUser.ruleRoleRequired'), trigger: 'change' }]
});

/** 门店下拉数据（GZ-BEAN-001 完工后接真实 API） */
interface StoreOption {
  id: number;
  name: string;
}
const storeOptions = ref<StoreOption[]>([]);
const loadStoreOptions = async () => {
  try {
    const { getGzBeanStoreOptions } = await import('@/api/gz-bean/store');
    const resp = await getGzBeanStoreOptions();
    // 门店 options 是 R 信封端点（{code,msg,data:[...]}），VO 数组在 resp.data
    storeOptions.value = ((resp as any)?.data || []).map((s: any) => ({ id: s.id, name: s.name }));
  } catch (e) {
    console.error('[GzAdminUser] load store options failed', e);
  }
};
const resolveStoreName = (storeId: number | string | null | undefined): string => {
  const id = String(storeId ?? '');
  return storeOptions.value.find((opt) => String(opt.id) === id)?.name ?? `#${id}`;
};
loadStoreOptions();

/** 权限判断 — staff 无写权限时按钮组隐藏，开关 disable */
const hasEditPerm = computed(() => proxy?.$auth?.hasPermi('gz:admin-user:edit') ?? false);

/** 查询列表 — 客户端按 roleId IN (100,101) 过滤 */
const getList = async () => {
  loading.value = true;
  try {
    const res = await api.listAdminUser(queryParams.value);
    // ruoyi list 接口分页返回 .rows + .total
    const rows = ((res as any).rows ?? []) as UserVO[];
    // owner/staff 过滤 — 仅展示 roles 中含 100/101 的（兼容 admin 兜底）
    userList.value = rows.filter((u) => {
      if (u.userId == 1) return true; // ruoyi 兜底 admin 仍展示但禁改
      const rs = (u.roles || []).map((r) => String(r.roleId));
      return rs.includes('100') || rs.includes('101');
    });
    total.value = (res as any).total ?? userList.value.length;
  } catch (e) {
    console.error('[GzAdminUser] list failed', e);
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryFormRef.value?.resetFields();
  queryParams.value = { ...initQueryParams };
  handleQuery();
};

const handleSelectionChange = (rows: UserVO[]) => {
  ids.value = rows.map((r) => r.userId);
  single.value = rows.length !== 1;
  multiple.value = rows.length === 0;
};

/** 状态切换 */
const handleStatusChange = async (row: UserVO) => {
  const action = row.status === '0' ? t('gzAdminUser.statusEnable') : t('gzAdminUser.statusDisable');
  const [cancelErr] = await to(proxy?.$modal.confirm(t('gzAdminUser.statusConfirm', { action, userName: row.userName })) as any);
  if (cancelErr) {
    row.status = row.status === '0' ? '1' : '0';
    return;
  }
  try {
    await api.changeAdminUserStatus(row.userId, row.status);
    proxy?.$modal.msgSuccess(t('gzAdminUser.statusSuccess', { action }));
  } catch (e) {
    row.status = row.status === '0' ? '1' : '0';
    console.error('[GzAdminUser] status change failed', e);
  }
};

/** 新增 */
const handleAdd = async () => {
  reset();
  // 拉 ruoyi getUser() 拿初始密码 + 角色列表（虽然我们只用 100/101，但 ruoyi 接口需要此调用）
  try {
    await api.getAdminUser();
  } catch {
    // ignore — 不影响新增表单
  }
  dialog.visible = true;
  dialog.title = t('gzAdminUser.addDialogTitle');
};

/** 编辑 */
const handleUpdate = async (row?: UserVO) => {
  reset();
  const userId = row?.userId ?? ids.value[0];
  if (Number(userId) === 1) {
    proxy?.$modal.msgWarning(t('gzAdminUser.cannotEditAdmin'));
    return;
  }
  try {
    const { data } = await api.getAdminUser(userId);
    Object.assign(form.value, data.user);
    // roleIds 从 data.roleIds 取，确保是 string[]
    form.value.roleIds = (data.roleIds || []).map(String);
    form.value.password = '';
    // ruoyi user.gzStoreId 字段（ADMIN-001 ALTER 已加）— camelCase 自动映射
    form.value.gzStoreId = (data.user as any).gzStoreId ?? null;
    dialog.visible = true;
    dialog.title = t('gzAdminUser.editDialogTitle');
  } catch (e) {
    console.error('[GzAdminUser] load detail failed', e);
  }
};

/** 删除（软删，ruoyi 自带 del_flag='2'） */
const handleDelete = async (row?: UserVO) => {
  const targetIds = row?.userId ? [row.userId] : ids.value;
  const targetName = row?.userName ?? targetIds.join(', ');
  if (targetIds.includes(1)) {
    proxy?.$modal.msgWarning(t('gzAdminUser.cannotEditAdmin'));
    return;
  }
  const [cancelErr] = await to(proxy?.$modal.confirm(t('gzAdminUser.delConfirm', { userName: targetName })) as any);
  if (cancelErr) return;
  try {
    await api.delAdminUser(targetIds.join(','));
    proxy?.$modal.msgSuccess(t('gzAdminUser.delSuccess'));
    await getList();
  } catch (e) {
    console.error('[GzAdminUser] delete failed', e);
  }
};

/** 重置密码 */
const handleResetPwd = async (row: UserVO) => {
  if (Number(row.userId) === 1) {
    proxy?.$modal.msgWarning(t('gzAdminUser.cannotEditAdmin'));
    return;
  }
  const [err, res] = await to(
    ElMessageBox.prompt(t('gzAdminUser.resetPwdPrompt', { userName: row.userName }), t('gzAdminUser.resetPwdDialogTitle'), {
      confirmButtonText: t('gzAdminUser.confirm'),
      cancelButtonText: t('gzAdminUser.cancel'),
      closeOnClickModal: false,
      inputPattern: /^.{5,20}$/,
      inputErrorMessage: t('gzAdminUser.rulePasswordLength'),
      inputValidator: (value) => {
        if (/<|>|"|'|\||\\/.test(value)) {
          return t('gzAdminUser.rulePasswordPattern') as string;
        }
      }
    })
  );
  if (err || !res) return;
  try {
    await api.resetAdminUserPwd(row.userId, res.value);
    proxy?.$modal.msgSuccess(t('gzAdminUser.resetPwdSuccess', { password: res.value }));
  } catch (e) {
    console.error('[GzAdminUser] reset pwd failed', e);
  }
};

/** 提交（新增 / 修改） */
const submitForm = () => {
  userFormRef.value?.validate(async (valid) => {
    if (!valid) return;
    // roleIds 在 UI 上是单选（限 100/101），写库时仍按 string[] 传
    const payload: GzAdminUserForm = {
      ...form.value,
      roleIds: Array.isArray(form.value.roleIds) ? form.value.roleIds.map(String) : [String(form.value.roleIds)]
    };
    try {
      if (payload.userId) {
        await api.updateAdminUser(payload as UserForm);
      } else {
        await api.addAdminUser(payload as UserForm);
      }
      proxy?.$modal.msgSuccess(t('gzAdminUser.submitSuccess'));
      dialog.visible = false;
      await getList();
    } catch (e) {
      console.error('[GzAdminUser] submit failed', e);
    }
  });
};

const reset = () => {
  form.value = { ...initFormData, roleIds: ['101'] };
  userFormRef.value?.resetFields();
};

const cancel = () => {
  dialog.visible = false;
  reset();
};

const closeDialog = () => {
  reset();
};

onMounted(() => {
  getList();
});
</script>

<style scoped>
.ticket-tag {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 12px;
  color: var(--el-color-info);
  background: var(--el-color-info-light-9);
  padding: 2px 8px;
  border-radius: 4px;
}
</style>
