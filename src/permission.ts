import { to as tos } from 'await-to-js';
import router from './router';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { getToken } from '@/utils/auth';
import { isHttp, isPathMatch } from '@/utils/validate';
import { isRelogin } from '@/utils/request';
import { useUserStore } from '@/store/modules/user';
import { useSettingsStore } from '@/store/modules/settings';
import { usePermissionStore } from '@/store/modules/permission';
import { ElMessage } from 'element-plus/es';

NProgress.configure({ showSpinner: false });
const whiteList = ['/login', '/register', '/social-callback', '/register*', '/register/*'];

const isWhiteList = (path: string) => {
  return whiteList.some((pattern) => isPathMatch(pattern, path));
};

/**
 * GZ-ADMIN-004 AC 6：按角色不同默认跳转
 *
 * 触发条件：用户首次登录 / 直接访问 `/` 或 `/index`（无 query redirect）。
 * 规则（任务卡 AC 6）：
 *   - owner（甲方负责人）→ 管理员账号管理（/system/user）
 *   - staff（门店运营） → C 端用户列表（/gz-c-user/list）
 *   - superadmin（ruoyi 兜底）→ /index（不动）
 *   - 其他无识别角色 → /index（保留 ruoyi 默认）
 *
 * 注：跳转目标必须是用户实际有权限的路径 — staff 没有 /system/user 权限，跳过去会
 *   401；owner 已批量授权 5000-5999 + ruoyi 系统菜单（继承 superadmin 风格），可以
 *   去 /system/user。
 */
const DEFAULT_PATHS: Record<string, string> = {
  owner: '/system/user',
  staff: '/gz-c-user/list'
};

const resolveDefaultPath = (roles: string[]): string | null => {
  // 优先级：owner > staff（多角色用户取最高权限默认）
  for (const role of ['owner', 'staff']) {
    if (roles.includes(role)) return DEFAULT_PATHS[role];
  }
  return null;
};

router.beforeEach(async (to, from, next) => {
  NProgress.start();
  if (getToken()) {
    to.meta.title && useSettingsStore().setTitle(to.meta.title as string);
    /* has token*/
    if (to.path === '/login') {
      next({ path: '/' });
      NProgress.done();
    } else if (isWhiteList(to.path)) {
      next();
    } else {
      if (useUserStore().roles.length === 0) {
        isRelogin.show = true;
        // 判断当前用户是否已拉取完user_info信息
        const [err] = await tos(useUserStore().getInfo());
        if (err) {
          await useUserStore().logout();
          ElMessage.error(err);
          next({ path: '/' });
        } else {
          isRelogin.show = false;
          const accessRoutes = await usePermissionStore().generateRoutes();
          // 根据roles权限生成可访问的路由表
          accessRoutes.forEach((route) => {
            if (!isHttp(route.path)) {
              router.addRoute(route); // 动态添加可访问路由表
            }
          });
          // GZ-ADMIN-004 AC 6：按角色默认跳转（仅当目标是 /index 或 / 时；用户主动访问其他路径不改写）
          const userRoles = useUserStore().roles;
          const isDefaultLanding = to.path === '/index' || to.path === '/';
          const overridePath = isDefaultLanding ? resolveDefaultPath(userRoles) : null;
          // @ts-expect-error hack方法 确保addRoutes已完成
          next({ path: overridePath ?? to.path, replace: true, params: to.params, query: to.query, hash: to.hash, name: to.name as string }); // hack方法 确保addRoutes已完成
        }
      } else {
        next();
      }
    }
  } else {
    // 没有token
    if (isWhiteList(to.path)) {
      // 在免登录白名单，直接进入
      next();
    } else {
      const redirect = encodeURIComponent(to.fullPath || '/');
      next(`/login?redirect=${redirect}`); // 否则全部重定向到登录页
      NProgress.done();
    }
  }
});

router.afterEach(() => {
  NProgress.done();
});
