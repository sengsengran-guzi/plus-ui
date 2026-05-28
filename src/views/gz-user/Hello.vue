<template>
  <div class="gz-hello">
    <h2>{{ $t('gzHello.user') }}</h2>
    <p>D01 GZ-SYS-001 占位页 — 后续 GZ-SYS-003 用户基础模型 / GZ-USER-* 会员管理会落地</p>
  </div>
</template>

<script lang="ts" setup>
defineOptions({ name: 'GzUserHello' });
</script>

<style lang="scss" scoped>
.gz-hello {
  padding: 24px;
}
</style>
