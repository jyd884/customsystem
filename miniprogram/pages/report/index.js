Page({
  data: {
    company: "某某公司",
    personalScore: 0,
    teamScore: 0,
    orgScore: 0,
    organizationScore: 0,
  },

  onLoad(options) {
    const latest = wx.getStorageSync("ocsLatestResult") || {};
    const profile = latest.profile || wx.getStorageSync("ocsProfile") || {};
    const report = latest.report || {};

    const personalScore = Number(options.personal || report.personalScore || 0);
    const teamScore = Number(options.team || report.teamScore || 0);
    const orgScore = Number(options.org || report.orgScore || 0);
    const organizationScore = Number(options.total || report.organizationScore || 0);

    this.setData({
      company: decodeURIComponent(options.company || profile.company || "某某公司"),
      personalScore,
      teamScore,
      orgScore,
      organizationScore,
    });
  },

  goAdvice() {
    wx.navigateTo({
      url: `/pages/advice/index?score=${this.data.organizationScore}&company=${encodeURIComponent(
        this.data.company,
      )}`,
    });
  },
});
