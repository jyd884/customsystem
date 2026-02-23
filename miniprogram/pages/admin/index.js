Page({
  data: {
    records: [],
  },

  onShow() {
    this.loadRecords();
  },

  async loadRecords() {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'ocs_admin',
        data: {
          action: 'getRecords',
          skip: 0,
          limit: 50
        }
      });
      wx.hideLoading();
      if (res.result && res.result.success) {
        const records = res.result.data.map(item => {
          const date = new Date(item.createTime);
          const pad = (num) => `${num}`.padStart(2, "0");
          const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
          return {
            id: item._id,
            date: dateStr,
            company: item.userInfo.company || "-",
            name: item.userInfo.name || "-",
            position: item.userInfo.position || "-",
            employeeCount: item.userInfo.size || "-",
            phone: item.userInfo.phone || "-",
            industry: item.userInfo.industry || "-",
            personalScore: item.scores.personal,
            teamScore: item.scores.team,
            organizationScore: item.scores.organization
          };
        });
        this.setData({ records });
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error(err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },
});
