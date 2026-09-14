const config = require("./config");
App({
  onLaunch() {
    if (wx.cloud && config.env)
      wx.cloud.init({ env: config.env, traceUser: false });
  },
  globalData: { userId: "", revision: 0, data: null },
});
