export default {
  // 路由国际化
  route: {
    dashboard: 'Dashboard',
    document: 'Document'
  },
  // 登录页面国际化
  login: {
    selectPlaceholder: 'Please select/enter a company name',
    username: 'Username',
    password: 'Password',
    login: 'Login',
    logging: 'Logging...',
    code: 'Verification Code',
    rememberPassword: 'Remember me',
    switchRegisterPage: 'Sign up now',
    rule: {
      tenantId: {
        required: 'Please enter your tenant id'
      },
      username: {
        required: 'Please enter your account'
      },
      password: {
        required: 'Please enter your password'
      },
      code: {
        required: 'Please enter a verification code'
      }
    },
    social: {
      wechat: 'Wechat Login',
      maxkey: 'MaxKey Login',
      topiam: 'TopIam Login',
      gitee: 'Gitee Login',
      github: 'Github Login'
    }
  },
  // 注册页面国际化
  register: {
    selectPlaceholder: 'Please select/enter a company name',
    username: 'Username',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    register: 'Register',
    registering: 'Registering...',
    registerSuccess: 'Congratulations, your {username} account has been registered!',
    code: 'Verification Code',
    switchLoginPage: 'Log in with an existing account',
    rule: {
      tenantId: {
        required: 'Please enter your tenant id'
      },
      username: {
        required: 'Please enter your account',
        length: 'The length of the user account must be between {min} and {max}'
      },
      password: {
        required: 'Please enter your password',
        length: 'The user password must be between {min} and {max} in length',
        pattern: "Can't contain illegal characters: {strings}"
      },
      code: {
        required: 'Please enter a verification code'
      },
      confirmPassword: {
        required: 'Please enter your password again',
        equalToPassword: 'The password entered twice is inconsistent'
      }
    }
  },
  // 导航栏国际化
  navbar: {
    full: 'Full Screen',
    language: 'Language',
    dashboard: 'Dashboard',
    document: 'Document',
    message: 'Message',
    layoutSize: 'Layout Size',
    selectTenant: 'Select Tenant',
    layoutSetting: 'Layout Setting',
    personalCenter: 'Personal Center',
    logout: 'Logout'
  },
  // Sensenran-Guzi business placeholders (D01 GZ-SYS-001)
  gzHello: {
    common: 'Guzi Universe — Common Module',
    bean: 'Guzi Universe — Bean Booking',
    user: 'Guzi Universe — Member Center',
    news: 'Guzi Universe — News Center',
    ord: 'Guzi Universe — Pre-Order (V1.1)',
    gacha: 'Guzi Universe — Gacha (V1.1)',
    admin: 'Guzi Universe — Admin Extension (V1.1)'
  },
  // Customer service config (D02 GZ-SYS-004)
  gzCustomerService: {
    title: 'Customer Service Entry Config',
    alertTitle: 'Note',
    alertDesc: 'If WeCom KF ID is set, the miniapp floating button opens WeCom KF session directly. Otherwise it shows a fallback dialog with phone & wechat ID.',
    refresh: 'Refresh',
    save: 'Save',
    reset: 'Reset',
    wxKfIdLabel: 'WeCom KF Account',
    wxKfIdPlaceholder: 'WeCom KF account (kfid, e.g. wk*****)',
    wxKfIdHint: 'Obtain from WeCom KF console; leave blank to enable fallback dialog',
    phoneLabel: 'Customer Service Phone',
    phonePlaceholder: 'e.g. 028-12345678 or +86 13800138000',
    phoneHint: '6-20 chars: digits / space / + - / parentheses',
    wxIdLabel: 'Customer Service WeChat ID',
    wxIdPlaceholder: 'e.g. sensenran_kefu_01',
    wxIdHint: 'Shown in fallback dialog so users can add as friend',
    loadFailed: 'Load failed, please retry later',
    saveSuccess: 'Saved successfully',
    saveFailed: 'Save failed, please retry later'
  },
  // Business file upload test page (D02 GZ-SYS-005)
  gzFile: {
    title: 'Business File Upload Test',
    description:
      'Test page for GZ-SYS-005 file upload API (admin: /system/gz/file/upload). Used by downstream GZ-NEWS / GZ-USER / GZ-GACHA image upload.',
    usageType: 'Usage Type',
    usageTypePlaceholder: 'Please select usage type',
    usageTypeRequired: 'Select usage type before uploading',
    uploadBtn: 'Click to Upload',
    uploadHint: 'jpg / png / webp / gif, max 10MB per file',
    uploadSuccess: 'Uploaded, file_id = {id}',
    uploadFailed: 'Upload failed',
    mimeNotAllowed: 'Only jpg / png / webp / gif allowed',
    sizeExceed: 'File exceeds 10MB, please re-select',
    fetchUrlBtn: 'Fetch Presigned URL',
    fetchUrlPlaceholder: 'Enter file_id',
    resultTitle: 'Upload Result',
    fileId: 'File ID',
    objectKey: 'Object Key',
    fileName: 'File Name',
    fileSize: 'File Size',
    mimeType: 'MIME',
    url: 'Presigned URL (1h expiry)',
    preview: 'Preview',
    scene: {
      newsCover: 'News Cover',
      newsInline: 'News Inline',
      userAvatar: 'User Avatar',
      gachaPrizeImage: 'Gacha Prize',
      preorderProductImage: 'Pre-order Product',
      storeImage: 'Store Image'
    }
  },
  // C-end user management (D02 GZ-SYS-003)
  gzUser: {
    title: 'C-end User List',
    alertTitle: 'Note',
    alertDesc: 'C-end WeChat miniapp user master table. V1.0/V1.1 read-only for ops; disable/edit moved to later tickets.',
    openid: 'openid',
    openidPlaceholder: 'openid prefix fuzzy match',
    nickname: 'Nickname',
    nicknamePlaceholder: 'Nickname fuzzy match',
    mobile: 'Mobile',
    mobilePlaceholder: 'Mobile fuzzy match',
    status: 'User Status',
    statusPlaceholder: 'All',
    isDisabled: 'Disabled',
    isDisabledPlaceholder: 'All',
    disabled0: 'Normal',
    disabled1: 'Disabled',
    registerTime: 'Register Time',
    timeStart: 'Start time',
    timeEnd: 'End time',
    search: 'Search',
    reset: 'Reset',
    detail: 'Detail',
    detailTitle: 'C-end User Detail',
    empty: 'No data',
    loadFailed: 'Load failed, please retry later',
    detailFailed: 'Detail load failed',
    colId: 'ID',
    colUserNo: 'User No',
    colOpenid: 'openid',
    colUnionid: 'unionid',
    colNickname: 'Nickname',
    colAvatar: 'Avatar',
    colMobile: 'Mobile',
    colGender: 'Gender',
    colRegisterSource: 'Reg. Source',
    colStatus: 'Status',
    colIsDisabled: 'Disabled',
    colRegisterTime: 'Register Time',
    colLastLogin: 'Last Login',
    colRemark: 'Remark',
    colAction: 'Actions',
    genderUnknown: 'Unknown',
    genderMale: 'Male',
    genderFemale: 'Female'
  }
};
