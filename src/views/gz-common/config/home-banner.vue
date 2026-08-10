<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="hover">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium"> {{ t('gzHomeBanner.title') }} · {{ t(`gzHomeBanner.app.${currentApp}`) }} </span>
          <el-button type="primary" :icon="Refresh" link @click="loadList">
            {{ t('gzHomeBanner.refresh') }}
          </el-button>
        </div>
      </template>

      <!-- 两个小程序各配一套 banner（同一后端同一张 sys_config，key 分家）—— 切换即切 config_key -->
      <div class="app-switch">
        <span class="app-switch__label">{{ t('gzHomeBanner.appLabel') }}</span>
        <el-radio-group :model-value="currentApp" @change="onAppChange">
          <el-radio-button v-for="a in HOME_BANNER_APPS" :key="a.app" :value="a.app">
            {{ t(`gzHomeBanner.app.${a.app}`) }}
          </el-radio-button>
        </el-radio-group>
        <el-tag type="info" effect="plain" class="app-switch__key">{{ currentConfigKey }}</el-tag>
      </div>

      <el-alert
        :title="t('gzHomeBanner.alertTitle')"
        type="info"
        :description="t('gzHomeBanner.alertDesc')"
        show-icon
        :closable="false"
        class="mb-4"
      />

      <div v-if="list.length === 0" class="empty-tip">
        {{ t('gzHomeBanner.empty') }}
      </div>

      <div v-for="(b, i) in list" :key="i" class="banner-row">
        <div class="banner-row__idx">{{ i + 1 }}</div>
        <div class="banner-row__img">
          <image-upload v-model="b.imageUrl" :limit="1" :file-size="5" />
        </div>
        <div class="banner-row__fields">
          <el-form-item :label="t('gzHomeBanner.linkLabel')" class="mb-2">
            <el-input v-model="b.link" :placeholder="t('gzHomeBanner.linkPlaceholder')" clearable maxlength="200" />
          </el-form-item>
          <div class="banner-row__ctl">
            <el-switch v-model="b.enabled" :active-text="t('gzHomeBanner.enabled')" :inactive-text="t('gzHomeBanner.disabled')" inline-prompt />
            <div>
              <el-button link :disabled="i === 0" @click="move(i, -1)">{{ t('gzHomeBanner.moveUp') }}</el-button>
              <el-button link :disabled="i === list.length - 1" @click="move(i, 1)">{{ t('gzHomeBanner.moveDown') }}</el-button>
              <el-button type="danger" link @click="removeRow(i)">{{ t('gzHomeBanner.remove') }}</el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-3">
        <el-button :icon="Plus" @click="addRow">{{ t('gzHomeBanner.add') }}</el-button>
      </div>

      <el-divider />

      <el-button v-hasPermi="['gz:config:home:edit']" type="primary" :loading="saving" @click="handleSave">
        {{ t('gzHomeBanner.save') }}
      </el-button>
      <el-button @click="loadList">{{ t('gzHomeBanner.reset') }}</el-button>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="GzHomeBannerConfig">
import { computed, ref } from 'vue';
import { Refresh, Plus } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import ImageUpload from '@/components/ImageUpload/index.vue';
import {
  getHomeBanners,
  saveHomeBanners,
  homeBannerConfigKey,
  HOME_BANNER_APPS,
  type HomeBannerApp,
  type HomeBannerItem
} from '@/api/gz-common/home-banner';

const { t } = useI18n();

const loading = ref<boolean>(false);
const saving = ref<boolean>(false);
const list = ref<HomeBannerItem[]>([]);
/** 当前正在编辑哪个小程序的 banner（默认谷子宇宙 = 打开页面即改造前的那份，不改运营习惯） */
const currentApp = ref<HomeBannerApp>('guzi');
/** 最近一次加载 / 保存后的快照，用于判断是否有未保存改动（切换小程序前提醒） */
const savedSnapshot = ref<string>('[]');

const currentConfigKey = computed(() => homeBannerConfigKey(currentApp.value));
const dirty = computed(() => JSON.stringify(list.value) !== savedSnapshot.value);

async function loadList() {
  loading.value = true;
  try {
    list.value = await getHomeBanners(currentApp.value);
    savedSnapshot.value = JSON.stringify(list.value);
  } catch (e) {
    console.error('[gz-home-banner] load failed', e);
    ElMessage.error(t('gzHomeBanner.loadFailed'));
  } finally {
    loading.value = false;
  }
}

/**
 * 切换小程序 = 切 config_key 重新加载。
 *
 * radio-group 用 :model-value 受控（非 v-model）：确认框取消时不改 currentApp，UI 自动回弹到原选项，
 * 避免「选项已跳过去但内容还是上一个小程序的」这种误配置。
 */
async function onAppChange(next: string | number | boolean | undefined) {
  const nextApp = next as HomeBannerApp;
  if (nextApp === currentApp.value) return;
  if (dirty.value) {
    try {
      await ElMessageBox.confirm(t('gzHomeBanner.switchConfirm'), t('gzHomeBanner.switchConfirmTitle'), {
        confirmButtonText: t('gzHomeBanner.switchConfirmOk'),
        cancelButtonText: t('gzHomeBanner.switchConfirmCancel'),
        type: 'warning'
      });
    } catch {
      return; // 取消切换：currentApp 不变 → radio 回弹
    }
  }
  currentApp.value = nextApp;
  await loadList();
}

function addRow() {
  list.value.push({ imageUrl: '', link: '', enabled: true });
}

function removeRow(i: number) {
  list.value.splice(i, 1);
}

function move(i: number, dir: number) {
  const j = i + dir;
  if (j < 0 || j >= list.value.length) return;
  const arr = list.value;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

async function handleSave() {
  // 过滤掉没传图的空行（避免 mp 端渲染空 slide）
  const cleaned = list.value.filter((b) => !!b.imageUrl);
  saving.value = true;
  try {
    await saveHomeBanners(currentApp.value, cleaned);
    list.value = cleaned;
    savedSnapshot.value = JSON.stringify(cleaned);
    ElMessage.success(t('gzHomeBanner.saveSuccess'));
  } catch (e) {
    console.error('[gz-home-banner] save failed', e);
    ElMessage.error(t('gzHomeBanner.saveFailed'));
  } finally {
    saving.value = false;
  }
}

loadList();
</script>

<style lang="scss" scoped>
.app-switch {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.app-switch__label {
  color: var(--el-text-color-regular);
}
.app-switch__key {
  font-family: var(--el-font-family-monospace, monospace);
}
.empty-tip {
  padding: 24px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
}
.banner-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
}
.banner-row__idx {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  line-height: 28px;
  text-align: center;
  border-radius: 50%;
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
  font-weight: 700;
}
.banner-row__img {
  flex-shrink: 0;
}
.banner-row__fields {
  flex: 1;
  min-width: 0;
}
.banner-row__ctl {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>
