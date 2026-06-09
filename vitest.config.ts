import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * plus-ui vitest 配置（GZ-ADMIN-102 起接入）。
 *
 * 当前仅跑纯逻辑 composable 单测（node 环境，无 DOM 依赖）。
 * 如后续需挂载组件，再加 environment: 'jsdom' + @vue/test-utils。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    globals: false
  }
});
