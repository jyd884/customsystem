const Toast = require("../../miniprogram_npm/tdesign-miniprogram/toast/index");

const INDUSTRY_OPTIONS = [
  { label: "制造业（工矿企业）", value: "制造业（工矿企业）" },
  { label: "物业", value: "物业" },
  { label: "物流", value: "物流" },
  { label: "房地产", value: "房地产" },
  { label: "电商", value: "电商" },
  { label: "教育培训", value: "教育培训" },
  { label: "事业单位", value: "事业单位" },
];

const showToast = (context, message, theme = "warning") => {
  const toastFn = Toast.default || Toast;
  toastFn({
    context,
    selector: "#t-toast",
    message,
    theme,
  });
};

Page({
  data: {
    form: {
      name: "",
      phone: "",
      company: "",
      position: "",
      employeeCount: "",
      industry: "",
    },
    industryPickerVisible: false,
    industryColumns: [INDUSTRY_OPTIONS],
    industryValue: [],
  },

  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: e.detail.value,
    });
  },

  openIndustryPicker() {
    this.setData({
      industryPickerVisible: true,
      industryValue: this.data.form.industry ? [this.data.form.industry] : [],
    });
  },

  onIndustryVisibleChange(e) {
    this.setData({
      industryPickerVisible: e.detail.visible,
    });
  },

  onIndustryChange(e) {
    this.setData({
      industryValue: e.detail.value,
    });
  },

  onIndustryConfirm(e) {
    this.setData({
      industryPickerVisible: false,
      industryValue: e.detail.value,
      "form.industry": e.detail.value[0]?.value || e.detail.value[0] || "",
    });
  },

  onIndustryCancel() {
    this.setData({
      industryPickerVisible: false,
    });
  },

  async onStart() {
    const { name, phone, company } = this.data.form;
    if (!name.trim()) {
      showToast(this, "请填写您的姓名");
      return;
    }
    if (!phone.trim()) {
      showToast(this, "请填写您的电话");
      return;
    }
    if (!company.trim()) {
      showToast(this, "请填写公司全称");
      return;
    }

    const profile = {
      ...this.data.form,
      name: this.data.form.name.trim(),
      phone: this.data.form.phone.trim(),
      company: this.data.form.company.trim(),
      position: this.data.form.position.trim(),
      employeeCount: this.data.form.employeeCount,
    };

    wx.showLoading({ title: '加载中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'ocs_login',
        data: {
          company: profile.company,
          name: profile.name,
          position: profile.position,
          size: profile.employeeCount,
          phone: profile.phone,
          industry: profile.industry
        }
      });
      wx.hideLoading();
      if (res.result && res.result.success) {
        getApp().globalData.profile = profile;
        wx.setStorageSync("ocsProfile", profile);
        
        if (res.result.iscomplete) {
          // 如果已经完成，直接跳转到诊断报告界面
          wx.navigateTo({
            url: `/subpages/report/index?id=${res.result.recordId}`,
          });
        } else {
          wx.navigateTo({
            url: "/subpages/survey/index",
          });
        }
      } else {
        showToast(this, "登录失败，请重试");
      }
    } catch (err) {
      wx.hideLoading();
      console.error(err);
      showToast(this, "网络错误，请重试");
    }
  },
});
