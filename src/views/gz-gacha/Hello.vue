<template>
  <div class="gz-hello">
    <h2>{{ $t('gzHello.gacha') }}</h2>
    <p>D01 GZ-SYS-001 占位页 — V1.1 GZ-GACHA-* 系列 ticket（扭蛋池管理 / 概率配置 / 抽奖事务）会落地</p>
  </div>
</template>

<script lang="ts" setup>
defineOptions({ name: 'GzGachaHello' });
</script>

<style lang="scss" scoped>
.gz-hello {
  padding: 24px;
}
</style>
