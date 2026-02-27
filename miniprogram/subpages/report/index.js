Page({
  data: {
    company: "某某公司",
    personalScore: 0,
    teamScore: 0,
    orgScore: 0,
    organizationScore: 0,
  },

  onLoad(options) {
    if (options.id) {
      this.fetchRecord(options.id);
    } else {
      this.initData(options);
    }
  },

  async fetchRecord(recordId) {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'ocs_get_record',
        data: { recordId }
      });
      wx.hideLoading();
      if (res.result && res.result.success) {
        const data = res.result.data;
        const options = {
          id: recordId,
          company: data.userInfo.company,
          personal: data.scores.personal,
          team: data.scores.team,
          org: data.scores.organization,
          total: data.totalScore
        };
        this.initData(options);
      } else {
        wx.showToast({ title: '获取数据失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error(err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  initData(options) {
    const latest = wx.getStorageSync("ocsLatestResult") || {};
    const profile = latest.profile || wx.getStorageSync("ocsProfile") || {};
    const report = latest.report || {};

    const personalScore = Number(options.personal || report.personalScore || 0);
    const teamScore = Number(options.team || report.teamScore || 0);
    const orgScore = Number(options.org || report.orgScore || 0);
    const organizationScore = Number(options.total || report.organizationScore || 0);

    let scoreRange = "";
    let levelText = "";

    if (organizationScore >= 15 && organizationScore <= 44) {
      scoreRange = "15-44";
      levelText = "活力不足";
    } else if (organizationScore >= 45 && organizationScore <= 55) {
      scoreRange = "45-55";
      levelText = "活力一般";
    } else if (organizationScore >= 56 && organizationScore <= 75) {
      scoreRange = "56-75";
      levelText = "高活力组织";
    }

    this.setData({
      company: decodeURIComponent(options.company || profile.company || "某某公司"),
      personalScore,
      teamScore,
      orgScore,
      organizationScore,
      scoreRange,
      levelText,
      recordId: options.id || this.data.recordId
    });
  },

  goAdvice() {
    wx.navigateTo({
      url: `/subpages/advice/index?score=${this.data.organizationScore}&company=${encodeURIComponent(
        this.data.company,
      )}&id=${this.data.recordId || ''}`,
    });
  },

  onShareAppMessage() {
    const { company, organizationScore, recordId } = this.data;
    
    let path = '/pages/index/index';
    if (recordId) {
      path = `/subpages/report/index?id=${recordId}`;
    } else {
      path = `/subpages/report/index?company=${encodeURIComponent(company)}&total=${organizationScore}`;
    }

    return {
      title: `${company}的组织活力诊断报告`,
      path: path,
      imageUrl: ''
    };
  }
});
