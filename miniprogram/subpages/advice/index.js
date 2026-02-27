Page({
  data: {
    company: "",
    score: 0,
    levelText: "活力不足",
    summary: "",
    issuesTitle: "2. 关键问题",
    issues: [],
    adviceTitle1: "",
    adviceList1: [],
    adviceTitle2: "",
    adviceList2: [],
  },

  onLoad(options) {
    const latest = wx.getStorageSync("ocsLatestResult") || {};
    const profile = latest.profile || wx.getStorageSync("ocsProfile") || {};
    const score = Number(options.score || (latest.report && latest.report.organizationScore) || 0);
    const company = decodeURIComponent(options.company || profile.company || "当前组织");

    const lowCase = {
      levelText: "活力不足",
      summary:
        "您的组织在基础运营中存在明显短板，员工主动性不足、协作效率低，需优先解决资源支持与目标共识问题，避免影响整体绩效。",
      issuesTitle: "2. 关键问题",
      issues: [
        { icon: "🚫", text: "资源支持缺失：工具/培训不足，工作推进受阻" },
        { icon: "🚫", text: "目标共识破裂：个人与组织目标脱节，员工盲目干活" },
        { icon: "🚫", text: "激励机制失效：付出与回报不匹配，积极性受挫" },
      ],
      adviceTitle1: "短期急救（1-2个月）",
      adviceList1: [
        "召开全员目标对齐会，明确各岗位核心职责",
        "优先解决高频工作所需工具/权限问题",
        "设立“月度优秀贡献奖”，快速激活积极性",
      ],
      adviceTitle2: "中期巩固（3-6个月）",
      adviceList2: [
        "优化薪酬体系，增加绩效奖金占比",
        "搭建跨部门协作平台，明确对接人",
        "开展基础技能培训，弥补能力短板",
      ],
    };

    const middleCase = {
      levelText: "活力一般",
      summary: "组织基础运营顺畅，但在效率提升与员工成长上有瓶颈，团队协作偶有摩擦，精准优化即可实现从“合格”到“优秀”的跨越。",
      issuesTitle: "2. 关键问题",
      issues: [
        { icon: "⚠️", text: "协作效率低：跨部门流程繁琐，响应缓慢" },
        { icon: "⚠️", text: "发展通道模糊：员工不清楚晋升路径，成长动力不足" },
        { icon: "⚠️", text: "创新氛围弱：想法缺乏表达渠道，试错成本高" },
      ],
      adviceTitle1: "协作效率提升",
      adviceList1: [
        "梳理核心流程，砍掉冗余环节，明确时限",
        "每月召开跨部门沟通会，现场协调问题",
        "推行“协作伙伴制”，高频协作部门结对优化",
      ],
      adviceTitle2: "员工成长赋能",
      adviceList2: [
        "制定职业发展路径图，明确晋升条件",
        "建立“师徒结对”机制，助力新员工成长",
        "提供个性化培训，匹配职业规划需求",
      ],
    };

    const highCase = {
      levelText: "高活力组织",
      summary: "您的组织运营健康，员工敬业度高、协作顺畅、创新能力强！需警惕“自满风险”，通过持续迭代保持领先优势。",
      issuesTitle: "2. 优势与风险",
      issues: [
        { icon: "✅", text: "核心优势：目标共识度高，员工清楚工作意义" },
        { icon: "✅", text: "核心优势：团队协作高效，跨部门沟通顺畅" },
        { icon: "✅", text: "核心优势：创新氛围浓厚，员工敢于尝试" },
        { icon: "❗", text: "潜在风险：外部变化响应可能不及时" },
        { icon: "❗", text: "潜在风险：长期激励易出现疲劳" },
        { icon: "❗", text: "潜在风险：优秀人才保留压力增大" },
      ],
      adviceTitle1: "创新能力升级",
      adviceList1: [
        "设立创新项目孵化基金，允许10%工作时间探索",
        "组织跨行业交流，避免内部思维固化",
        "定期复盘创新项目，提炼可复制经验",
      ],
      adviceTitle2: "长期激励保留",
      adviceList2: [
        "设计股权激励/项目分红，绑定核心员工",
        "提供定制化发展计划（海外培训/高层辅导）",
        "打造雇主品牌，提升人才吸引力",
      ],
    };

    let selected = lowCase;
    if (score >= 56) {
      selected = highCase;
    } else if (score >= 45) {
      selected = middleCase;
    }

    this.setData({
      company,
      score,
      recordId: options.id || '',
      ...selected,
    });
  },

  onShareAppMessage() {
    const { company, score, recordId } = this.data;
    
    let path = '/pages/index/index';
    if (recordId) {
      path = `/subpages/report/index?id=${recordId}`;
    } else {
      // 如果没有 recordId，则传递分数等信息
      path = `/subpages/report/index?company=${encodeURIComponent(company)}&total=${score}`;
    }

    return {
      title: `${company}的组织活力诊断报告`,
      path: path,
      imageUrl: '' // 可以配置一张分享图片
    };
  }
});
