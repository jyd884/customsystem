Page({
  data: {
    records: [],
  },

  onShow() {
    this.loadRecords();
  },

  loadRecords() {
    const records = (wx.getStorageSync("ocsRecords") || []).slice().reverse();
    this.setData({ records });
  },
});
