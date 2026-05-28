<template>
  <div class="gz-hello">
    <h2>{{ $t('gzHello.admin') }}</h2>
    <p>D01 GZ-SYS-001 占位页 — V1.1 GZ-ADMIN-* 系列 ticket（物流推进 / 对账中心 / 数据看板 / 操作日志）会落地</p>
  </div>
</template>

<script lang="ts" setup>
defineOptions({ name: 'GzAdminHello' });
</script>

<style lang="scss" scoped>
.gz-hello {
  padding: 24px;
}
</style>
