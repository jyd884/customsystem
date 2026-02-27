const Toast = require("../../miniprogram_npm/tdesign-miniprogram/toast/index");

const QUESTIONS = [
  {
    id: "q1",
    section: "一、个人活力",
    title: "每个员工都知道自己的工作目标与核心职责，且与组织目标一致。（目标与职责）",
  },
  {
    id: "q2",
    section: "一、个人活力",
    title: "公司为我提供了完成工作所需的资源、工具和培训支持（工作支持与成长性）",
  },
  {
    id: "q3",
    section: "一、个人活力",
    title: "公司的薪酬福利、激励机制公平合理，能匹配大部分员工的付出与价值（激励机制）",
  },
  {
    id: "q4",
    section: "一、个人活力",
    title: "我的创新建议会被上级认真考虑（创造力激发）",
  },
  {
    id: "q5",
    section: "一、个人活力",
    title: "公司的激励机制让我愿意付出额外努力（结果导向）",
  },
  {
    id: "q6",
    section: "二、团队活力",
    title: "团队成员能坦诚沟通分歧，无需顾虑（开放沟通）",
  },
  {
    id: "q7",
    section: "二、团队活力",
    title: "跨部门协作时，资源和支持能快速到位（高效协作）",
  },
  {
    id: "q8",
    section: "二、团队活力",
    title: "团队领导公平分配机会与认可（信任基础）",
  },
  {
    id: "q9",
    section: "二、团队活力",
    title: "我的同事会主动分享经验或资源（互助文化）",
  },
  {
    id: "q10",
    section: "二、团队活力",
    title: "团队容错机制让我敢于尝试新方法（心理安全）",
  },
  {
    id: "q11",
    section: "三、组织活动",
    title: "公司流程简化，组织扁平，能少有内耗",
  },
  {
    id: "q12",
    section: "三、组织活动",
    title: "高层决策会考虑员工反馈并透明沟通（凝聚力）",
  },
  {
    id: "q13",
    section: "三、组织活动",
    title: "公司的企业文化开放包容，鼓励创新与试错，不压抑个性（创新赋能）",
  },
  {
    id: "q14",
    section: "三、组织活动",
    title: "各级员工的职业发展路径清晰可见（通道建设）",
  },
  {
    id: "q15",
    section: "三、组织活动",
    title: "企业文化以目标导向而非形式主义，官僚主义（正能量文化）",
  },
];

const OPTIONS = [
  { label: "（5分）非常符合", value: 5 },
  { label: "（4分）比较符合", value: 4 },
  { label: "（3分）一般", value: 3 },
  { label: "（2分）不太符合", value: 2 },
  { label: "（1分）非常不符合", value: 1 },
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

const formatDate = (date) => {
  const pad = (num) => `${num}`.padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

Page({
  data: {
    personalQuestions: QUESTIONS.slice(0, 5),
    teamQuestions: QUESTIONS.slice(5, 10),
    orgQuestions: QUESTIONS.slice(10, 15),
    options: OPTIONS,
    answers: {},
  },

  onAnswerChange(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      [`answers.${id}`]: Number(e.detail.value),
    });
  },

  async onSubmit() {
    const answeredCount = Object.keys(this.data.answers).length;
    if (answeredCount !== QUESTIONS.length) {
      showToast(this, "请完成全部题目后再提交");
      return;
    }

    const personalScore = (
      this.data.answers.q1 +
      this.data.answers.q2 +
      this.data.answers.q3 +
      this.data.answers.q4 +
      this.data.answers.q5
    );
    const teamScore = (
      this.data.answers.q6 +
      this.data.answers.q7 +
      this.data.answers.q8 +
      this.data.answers.q9 +
      this.data.answers.q10
    );
    const orgScore = (
      this.data.answers.q11 +
      this.data.answers.q12 +
      this.data.answers.q13 +
      this.data.answers.q14 +
      this.data.answers.q15
    );
    const organizationScore = personalScore + teamScore + orgScore;

    const report = {
      personalScore: Number(personalScore.toFixed(1)),
      teamScore: Number(teamScore.toFixed(1)),
      orgScore: Number(orgScore.toFixed(1)),
      organizationScore: Number(organizationScore.toFixed(1)),
    };

    const profile = getApp().globalData.profile || wx.getStorageSync("ocsProfile") || {};
    const record = {
      id: Date.now(),
      date: formatDate(new Date()),
      company: profile.company || "-",
      name: profile.name || "-",
      position: profile.position || "-",
      employeeCount: profile.employeeCount || "-",
      phone: profile.phone || "-",
      industry: profile.industry || "-",
      ...report,
    };

    wx.showLoading({ title: '提交中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'ocs_submit',
        data: {
          answers: this.data.answers,
          scores: {
            personal: report.personalScore,
            team: report.teamScore,
            organization: report.organizationScore
          },
          totalScore: report.organizationScore,
          advice: '' // Can be generated on backend or frontend
        }
      });
      wx.hideLoading();
      if (res.result && res.result.success) {
        const history = wx.getStorageSync("ocsRecords") || [];
        history.push(record);

        getApp().globalData.report = report;
        wx.setStorageSync("ocsLatestResult", { profile, report });
        wx.setStorageSync("ocsRecords", history);

        wx.navigateTo({
          url: `/subpages/report/index?id=${res.result.recordId}&company=${encodeURIComponent(
            profile.company || "",
          )}&personal=${report.personalScore}&team=${report.teamScore}&org=${report.orgScore}&total=${report.organizationScore}`,
        });
      } else if (res.result && res.result.code === 'ALREADY_COMPLETED') {
        wx.showModal({
          title: '提示',
          content: '您已经完成过该问卷了',
          showCancel: false,
          success: () => {
            wx.navigateTo({
              url: `/subpages/report/index?id=${res.result.recordId}`,
            });
          }
        });
      } else {
        showToast(this, "提交失败，请重试");
      }
    } catch (err) {
      wx.hideLoading();
      console.error(err);
      showToast(this, "网络错误，请重试");
    }
  },
});
