<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="hover">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzCustomerService.title') }}</span>
          <el-button type="primary" :icon="Refresh" link @click="loadConfig">
            {{ t('gzCustomerService.refresh') }}
          </el-button>
        </div>
      </template>

      <el-alert
        :title="t('gzCustomerService.alertTitle')"
        type="info"
        :description="t('gzCustomerService.alertDesc')"
        show-icon
        :closable="false"
        class="mb-4"
      />

      <el-form ref="formRef" :model="form" :rules="rules" label-width="180px">
        <el-form-item :label="t('gzCustomerService.wxKfIdLabel')" prop="wxKfId">
          <el-input
            v-model="form.wxKfId"
            :placeholder="t('gzCustomerService.wxKfIdPlaceholder')"
            clearable
            maxlength="128"
            show-word-limit
          />
          <div class="text-xs text-gray-500 mt-1">{{ t('gzCustomerService.wxKfIdHint') }}</div>
        </el-form-item>

        <el-form-item :label="t('gzCustomerService.phoneLabel')" prop="phone">
          <el-input
            v-model="form.phone"
            :placeholder="t('gzCustomerService.phonePlaceholder')"
            clearable
            maxlength="20"
            show-word-limit
          />
          <div class="text-xs text-gray-500 mt-1">{{ t('gzCustomerService.phoneHint') }}</div>
        </el-form-item>

        <el-form-item :label="t('gzCustomerService.wxIdLabel')" prop="wxId">
          <el-input
            v-model="form.wxId"
            :placeholder="t('gzCustomerService.wxIdPlaceholder')"
            clearable
            maxlength="64"
            show-word-limit
          />
          <div class="text-xs text-gray-500 mt-1">{{ t('gzCustomerService.wxIdHint') }}</div>
        </el-form-item>

        <el-form-item>
          <el-button v-hasPermi="['gz:config:cs:edit']" type="primary" :loading="saving" @click="handleSave">
            {{ t('gzCustomerService.save') }}
          </el-button>
          <el-button @click="loadConfig">{{ t('gzCustomerService.reset') }}</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="GzCustomerServiceConfig">
import { ref, reactive } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import {
  getCustomerServiceConfig,
  saveCustomerServiceConfig,
  type CustomerServiceConfig
} from '@/api/gz-common/customer-service';

const { t } = useI18n();

const loading = ref<boolean>(false);
const saving = ref<boolean>(false);
const formRef = ref<FormInstance>();

const form = reactive<CustomerServiceConfig>({
  wxKfId: '',
  phone: '',
  wxId: ''
});

const rules: FormRules = {
  wxKfId: [{ max: 128, message: '最多 128 字符', trigger: 'blur' }],
  phone: [
    { max: 20, message: '最多 20 字符', trigger: 'blur' },
    {
      pattern: /^$|^[0-9\-+\s()]{6,20}$/,
      message: '电话格式不合法（仅允许数字 / + - 空格 / 括号 6-20 位）',
      trigger: 'blur'
    }
  ],
  wxId: [{ max: 64, message: '最多 64 字符', trigger: 'blur' }]
};

async function loadConfig() {
  loading.value = true;
  try {
    const cfg = await getCustomerServiceConfig();
    form.wxKfId = cfg.wxKfId;
    form.phone = cfg.phone;
    form.wxId = cfg.wxId;
  } catch (e) {
    console.error('[gz-customer-service] load failed', e);
    ElMessage.error(t('gzCustomerService.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    saving.value = true;
    try {
      await saveCustomerServiceConfig({ ...form });
      ElMessage.success(t('gzCustomerService.saveSuccess'));
    } catch (e) {
      console.error('[gz-customer-service] save failed', e);
      ElMessage.error(t('gzCustomerService.saveFailed'));
    } finally {
      saving.value = false;
    }
  });
}

loadConfig();
</script>
