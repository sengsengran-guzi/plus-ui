<template>
  <div class="p-2">
    <el-card v-loading="loading" shadow="hover">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-base font-medium">{{ t('gzHomeBanner.title') }}</span>
          <el-button type="primary" :icon="Refresh" link @click="loadList">
            {{ t('gzHomeBanner.refresh') }}
          </el-button>
        </div>
      </template>

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
            <el-switch
              v-model="b.enabled"
              :active-text="t('gzHomeBanner.enabled')"
              :inactive-text="t('gzHomeBanner.disabled')"
              inline-prompt
            />
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
import { ref } from 'vue';
import { Refresh, Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import ImageUpload from '@/components/ImageUpload/index.vue';
import { getHomeBanners, saveHomeBanners, type HomeBannerItem } from '@/api/gz-common/home-banner';

const { t } = useI18n();

const loading = ref<boolean>(false);
const saving = ref<boolean>(false);
const list = ref<HomeBannerItem[]>([]);

async function loadList() {
  loading.value = true;
  try {
    list.value = await getHomeBanners();
  } catch (e) {
    console.error('[gz-home-banner] load failed', e);
    ElMessage.error(t('gzHomeBanner.loadFailed'));
  } finally {
    loading.value = false;
  }
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
    await saveHomeBanners(cleaned);
    list.value = cleaned;
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
