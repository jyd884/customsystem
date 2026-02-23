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
    teamQuestions: QUESTIONS.slice(5),
    options: OPTIONS,
    answers: {},
  },

  onAnswerChange(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      [`answers.${id}`]: Number(e.detail.value),
    });
  },

  onSubmit() {
    const answeredCount = Object.keys(this.data.answers).length;
    if (answeredCount !== QUESTIONS.length) {
      showToast(this, "请完成全部题目后再提交");
      return;
    }

    const personalScore = (
      (this.data.answers.q1 +
        this.data.answers.q2 +
        this.data.answers.q3 +
        this.data.answers.q4 +
        this.data.answers.q5) /
      5
    );
    const teamScore = (this.data.answers.q6 + this.data.answers.q7) / 2;
    const organizationScore = (personalScore + teamScore) / 2;

    const report = {
      personalScore: Number(personalScore.toFixed(1)),
      teamScore: Number(teamScore.toFixed(1)),
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

    const history = wx.getStorageSync("ocsRecords") || [];
    history.push(record);

    getApp().globalData.report = report;
    wx.setStorageSync("ocsLatestResult", { profile, report });
    wx.setStorageSync("ocsRecords", history);

    wx.navigateTo({
      url: `/pages/report/index?company=${encodeURIComponent(
        profile.company || "",
      )}&personal=${report.personalScore}&team=${report.teamScore}&org=${report.organizationScore}`,
    });
  },
});
