let isIos;
// #ifdef APP-PLUS
isIos = (plus.os.name == 'iOS');
// #endif

// 判断麦克风权限是否开启（iOS）
function judgeIosPermissionRecord() {
  let result = false;
  const avaudiosession = plus.ios.import('AVAudioSession');
  const avaudio = avaudiosession.sharedInstance();
  const permissionStatus = avaudio.recordPermission();
  console.log('[Permission] iOS permissionStatus:', permissionStatus);
  if (permissionStatus == 1684369017 || permissionStatus == 1970168948) {
    console.log('[Permission] iOS 麦克风权限没有开启');
  } else {
    result = true;
    console.log('[Permission] iOS 麦克风权限已经开启');
  }
  plus.ios.deleteObject(avaudiosession);
  return result;
}

// Android 权限查询
function requestAndroidPermission(permissionID) {
  // 防御性检查：确保在 Android 平台调用，iOS 上 plus.android 不存在
  if (isIos || (plus.os && plus.os.name && String(plus.os.name).toLowerCase() !== 'android')) {
    console.warn('[Permission] requestAndroidPermission called on non-Android platform, skipping');
    return Promise.resolve({ code: -1, message: 'Not Android platform' });
  }
  return new Promise((resolve, reject) => {
    plus.android.requestPermissions(
      [permissionID], // 理论上支持多个权限同时查询，但实际上本函数封装只处理了一个权限的情况。有需要的可自行扩展封装
      (resultObj) => {
        let result = 0;
        for (var i = 0; i < resultObj.granted.length; i++) {
          const grantedPermission = resultObj.granted[i];
          console.log(`[Permission] Android 已获取的权限：${grantedPermission}`);
          result = 1;
        }
        for (var i = 0; i < resultObj.deniedPresent.length; i++) {
          const deniedPresentPermission = resultObj.deniedPresent[i];
          console.log(`[Permission] Android 拒绝本次申请的权限：${deniedPresentPermission}`);
          result = 0;
        }
        for (var i = 0; i < resultObj.deniedAlways.length; i++) {
          const deniedAlwaysPermission = resultObj.deniedAlways[i];
          console.log(`[Permission] Android 永久拒绝申请的权限：${deniedAlwaysPermission}`);
          result = -1;
        }
        resolve(result);
      },
      (error) => {
        console.log(`[Permission] Android 申请权限错误：${error.code} = ${error.message}`);
        resolve({
          code: error.code,
          message: error.message,
        });
      },
    );
  });
}

// 跳转到**应用**的权限页面
function gotoAppPermissionSetting() {
  if (isIos) {
    try {
      const UIApplication = plus.ios.import('UIApplication');
      const application2 = UIApplication.sharedApplication();
      const NSURL2 = plus.ios.import('NSURL');
      const setting2 = NSURL2.URLWithString('app-settings:');
      application2.openURL(setting2);

      plus.ios.deleteObject(setting2);
      plus.ios.deleteObject(NSURL2);
      plus.ios.deleteObject(application2);
    } catch (e) {
      console.error('[Permission] iOS open settings failed:', e);
      // 兜底：尝试 UIApplicationOpenSettingsURLString
      try {
        const UIApplication = plus.ios.import('UIApplication');
        const app = UIApplication.sharedApplication();
        const NSURL = plus.ios.import('NSURL');
        const url = NSURL.URLWithString(UIApplication.sharedApplication().UIApplicationOpenSettingsURLString);
        if (url) app.openURL(url);
        plus.ios.deleteObject(url);
        plus.ios.deleteObject(NSURL);
        plus.ios.deleteObject(UIApplication);
      } catch (_) { /* 兜底也失败则忽略 */ }
    }
  } else if (plus.os && plus.os.name && String(plus.os.name).toLowerCase() === 'android') {
    try {
      const Intent = plus.android.importClass('android.content.Intent');
      const Settings = plus.android.importClass('android.provider.Settings');
      const Uri = plus.android.importClass('android.net.Uri');
      const mainActivity = plus.android.runtimeMainActivity();
      const intent = new Intent();
      intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
      const uri = Uri.fromParts('package', mainActivity.getPackageName(), null);
      intent.setData(uri);
      mainActivity.startActivity(intent);
    } catch (e) {
      console.error('[Permission] Android open settings failed:', e);
    }
  } else {
    console.warn('[Permission] Unknown platform, cannot open settings');
  }
}

function checkPermissionStatusInApp(permission) {
  const status = plus.navigator.checkPermission(permission);
  switch (status) {
    case 'authorized':
      return 1;
    case 'denied':
      return -1;
    default:
      return 0; // 未授权或状态未知
    // https://www.html5plus.org/doc/zh_cn/navigator.html#plus.navigator.checkPermission
  }
}

export {
	judgeIosPermissionRecord,
	requestAndroidPermission,
	gotoAppPermissionSetting,
	checkPermissionStatusInApp,
};
