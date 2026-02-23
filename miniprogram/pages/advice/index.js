Page({
  data: {
    company: "",
    score: 0,
    levelText: "活力不足",
    summary: "",
    issues: [],
    shortTerm: [],
    midTerm: [],
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
      issues: [
        "资源支持缺失：工具/培训不足，工作推进受阻",
        "目标共识破裂：个人与组织目标脱节，员工盲目干活",
        "激励机制失效：付出与回报不匹配，积极性受挫",
      ],
      shortTerm: [
        "召开全员目标对齐会，明确各岗位核心职责",
        "优先解决高频工作所需工具/权限问题",
        "设立“月度优秀贡献奖”，快速激活积极性",
      ],
      midTerm: [
        "优化薪酬体系，增加绩效奖金占比",
        "搭建跨部门协作平台，明确对接人",
        "开展基础技能培训，弥补能力短板",
      ],
    };

    const middleCase = {
      levelText: "活力良好",
      summary: "组织整体状态稳定，建议持续优化跨部门协同与反馈机制，保持增长势头。",
      issues: ["协同效率还有提升空间", "激励方式可更精细化", "目标拆解与追踪需更明确"],
      shortTerm: ["梳理核心流程瓶颈并设立责任人", "优化周会机制，提高决策效率"],
      midTerm: ["建立人才梯队培养机制", "完善绩效与激励联动机制"],
    };

    const highCase = {
      levelText: "活力优秀",
      summary: "组织活力表现优秀，建议持续沉淀优秀实践，扩大管理经验复用范围。",
      issues: ["保持高绩效团队稳定性", "持续关注创新投入产出", "防范组织扩张中的沟通成本"],
      shortTerm: ["提炼最佳实践并内部分享", "持续追踪关键指标波动"],
      midTerm: ["构建跨团队知识库", "强化核心岗位继任计划"],
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
      ...selected,
    });
  },
});
