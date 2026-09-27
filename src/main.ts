import { createApp } from 'vue';
// global css
import 'virtual:uno.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import '@/assets/styles/index.scss';

// App、router、store
import App from './App.vue';
import store from './store';
import router from './router';

// 自定义指令
import directive from './directive';

// 注册插件
import plugins from './plugins/index'; // plugins

// 高亮组件
// import 'highlight.js/styles/a11y-light.css';
import 'highlight.js/styles/atom-one-dark.css';
import 'highlight.js/lib/common';
import HighLight from '@highlightjs/vue-plugin';

// svg图标
import 'virtual:svg-icons-register';
import ElementIcons from '@/plugins/svgicon';

// permission control
import './permission';

// 国际化
import i18n from '@/lang/index';

// vxeTable
import VXETable from 'vxe-table';
import 'vxe-table/lib/style.css';
VXETable.setConfig({
  zIndex: 999999
});

// 弹框 / 抽屉一律「点蒙层即关闭」——element-plus 原生默认即 true，此处不要再覆盖默认值。
//   历史坑：曾用 `ElDialog.props.closeOnClickModal.default = false` 全局关掉（ruoyi 模板旧习惯），
//   而 el-drawer 与 el-dialog 共用 dialogProps，于是**抽屉也一起被关**，业务页不显式写就一律点蒙层没反应。
//   客户要求「所有抽屉/弹框点蒙层都能关」→ 保持原生默认即可；个别需要防误关的弹框自行显式写
//   `:close-on-click-modal="false"`。

const app = createApp(App);

app.use(HighLight);
app.use(ElementIcons);
app.use(router);
app.use(store);
app.use(i18n);
app.use(VXETable);
app.use(plugins);
// 自定义指令
directive(app);

app.mount('#app');
