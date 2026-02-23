App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-6ggntc265d4011ce',
        traceUser: true,
      });
    }
    this.globalData = {
      profile: null,
      report: null,
    };
  },
});
