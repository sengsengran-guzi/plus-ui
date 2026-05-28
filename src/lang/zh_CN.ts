export default {
  // 路由国际化
  route: {
    dashboard: '首页',
    document: '项目文档'
  },
  // 登录页面国际化
  login: {
    selectPlaceholder: '请选择/输入公司名称',
    username: '用户名',
    password: '密码',
    login: '登 录',
    logging: '登 录 中...',
    code: '验证码',
    rememberPassword: '记住我',
    switchRegisterPage: '立即注册',
    rule: {
      tenantId: {
        required: '请输入您的租户编号'
      },
      username: {
        required: '请输入您的账号'
      },
      password: {
        required: '请输入您的密码'
      },
      code: {
        required: '请输入验证码'
      }
    },
    social: {
      wechat: '微信登录',
      maxkey: 'MaxKey登录',
      topiam: 'TopIam登录',
      gitee: 'Gitee登录',
      github: 'Github登录'
    }
  },
  // 注册页面国际化
  register: {
    selectPlaceholder: '请选择/输入公司名称',
    username: '用户名',
    password: '密码',
    confirmPassword: '确认密码',
    register: '注 册',
    registering: '注 册 中...',
    registerSuccess: '恭喜你，您的账号 {username} 注册成功！',
    code: '验证码',
    switchLoginPage: '使用已有账户登录',
    rule: {
      tenantId: {
        required: '请输入您的租户编号'
      },
      username: {
        required: '请输入您的账号',
        length: '用户账号长度必须介于 {min} 和 {max} 之间'
      },
      password: {
        required: '请输入您的密码',
        length: '用户密码长度必须介于 {min} 和 {max} 之间',
        pattern: '不能包含非法字符：{strings}'
      },
      code: {
        required: '请输入验证码'
      },
      confirmPassword: {
        required: '请再次输入您的密码',
        equalToPassword: '两次输入的密码不一致'
      }
    }
  },
  // 导航栏国际化
  navbar: {
    full: '全屏',
    language: '语言',
    dashboard: '首页',
    document: '项目文档',
    message: '消息',
    layoutSize: '布局大小',
    selectTenant: '选择租户',
    layoutSetting: '布局设置',
    personalCenter: '个人中心',
    logout: '退出登录'
  },
  // 谷子宇宙业务占位（D01 GZ-SYS-001）
  gzHello: {
    common: '谷子宇宙 — 通用模块',
    bean: '谷子宇宙 — 拼豆预约',
    user: '谷子宇宙 — 会员中心',
    news: '谷子宇宙 — 资讯中心',
    ord: '谷子宇宙 — 预定货品（V1.1）',
    gacha: '谷子宇宙 — 扭蛋机（V1.1）',
    admin: '谷子宇宙 — 后台扩展（V1.1）'
  },
  // 客服配置（D02 GZ-SYS-004）
  gzCustomerService: {
    title: '客服入口配置',
    alertTitle: '说明',
    alertDesc: '若「企业微信客服账号」填写并启用，小程序浮层将直接拉起企业微信客服会话；若为空，则浮层点击展示「客服电话 + 客服微信号」降级弹窗。',
    refresh: '刷新',
    save: '保存',
    reset: '重置',
    wxKfIdLabel: '企业微信客服账号',
    wxKfIdPlaceholder: '请输入企业微信客服账号（kfid，形如 wk*****）',
    wxKfIdHint: '甲方在企业微信「客服」后台获取；留空将启用降级弹窗',
    phoneLabel: '客服电话',
    phonePlaceholder: '如 028-12345678 或 +86 13800138000',
    phoneHint: '6-20 位数字 / 空格 / + - / 括号',
    wxIdLabel: '客服微信号',
    wxIdPlaceholder: '如 sensenran_kefu_01',
    wxIdHint: '降级弹窗中展示，方便用户加好友',
    loadFailed: '加载失败，请稍后重试',
    saveSuccess: '保存成功',
    saveFailed: '保存失败，请稍后重试'
  },
  // 业务文件上传测试页（D02 GZ-SYS-005）
  gzFile: {
    title: '业务文件上传测试',
    description:
      '本页用于联调 GZ-SYS-005 文件上传接口（admin: /system/gz/file/upload）。后续 GZ-NEWS / GZ-USER / GZ-GACHA 等业务的图片上传统一调用此服务。',
    usageType: '使用场景',
    usageTypePlaceholder: '请选择使用场景',
    usageTypeRequired: '请先选择使用场景再上传',
    uploadBtn: '点击上传',
    uploadHint: '支持 jpg / png / webp / gif，单文件不超过 10MB',
    uploadSuccess: '上传成功，file_id = {id}',
    uploadFailed: '上传失败',
    mimeNotAllowed: '只允许 jpg / png / webp / gif 图片',
    sizeExceed: '文件大小超过 10MB，请重新选择',
    fetchUrlBtn: '获取临时 URL',
    fetchUrlPlaceholder: '请输入 file_id',
    resultTitle: '上传结果',
    fileId: '文件 ID',
    objectKey: '对象 Key',
    fileName: '文件名',
    fileSize: '文件大小',
    mimeType: 'MIME',
    url: '预签名 URL（1h 过期）',
    preview: '预览',
    scene: {
      newsCover: '资讯封面',
      newsInline: '资讯内嵌',
      userAvatar: '用户头像',
      gachaPrizeImage: '扭蛋奖品',
      preorderProductImage: '预购商品',
      storeImage: '门店图片'
    }
  },
  // C 端用户管理（D02 GZ-SYS-003）
  gzUser: {
    title: 'C 端用户列表',
    alertTitle: '说明',
    alertDesc: 'C 端微信小程序用户主表。V1.0/V1.1 甲方只看不改，禁用 / 修改资料能力由后续 ticket 单独提供。',
    openid: 'openid',
    openidPlaceholder: '输入 openid 前缀模糊搜',
    nickname: '昵称',
    nicknamePlaceholder: '昵称模糊搜',
    mobile: '手机号',
    mobilePlaceholder: '手机号模糊搜',
    status: '用户状态',
    statusPlaceholder: '全部',
    isDisabled: '是否禁用',
    isDisabledPlaceholder: '全部',
    disabled0: '正常',
    disabled1: '已禁用',
    registerTime: '注册时间',
    timeStart: '开始时间',
    timeEnd: '结束时间',
    search: '查询',
    reset: '重置',
    detail: '详情',
    detailTitle: 'C 端用户详情',
    empty: '没有数据',
    loadFailed: '加载失败，请稍后重试',
    detailFailed: '详情加载失败',
    colId: 'ID',
    colUserNo: '业务码',
    colOpenid: 'openid',
    colUnionid: 'unionid',
    colNickname: '昵称',
    colAvatar: '头像',
    colMobile: '手机号',
    colGender: '性别',
    colRegisterSource: '注册来源',
    colStatus: '状态',
    colIsDisabled: '禁用',
    colRegisterTime: '注册时间',
    colLastLogin: '最后登录',
    colRemark: '备注',
    colAction: '操作',
    genderUnknown: '未知',
    genderMale: '男',
    genderFemale: '女'
  }
};
