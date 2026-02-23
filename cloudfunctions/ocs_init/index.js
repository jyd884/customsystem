const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

const questions = [
  { id: 'q1', category: '个人活力', title: '每个员工都知道自已的工作目标与核心职责，且与组织目标一致。' },
  { id: 'q2', category: '个人活力', title: '公司为我提供了完成工作所需的资源、工具和培训支持' },
  { id: 'q3', category: '个人活力', title: '公司的薪酬福利、激励机制公平合理，能匹配大部分员工的付出与价值' },
  { id: 'q4', category: '个人活力', title: '我的创新建议会被上级认真考虑' },
  { id: 'q5', category: '个人活力', title: '公司的激励机制让我愿意付出额外努力' },
  { id: 'q6', category: '团队活力', title: '团队成员能坦诚沟通分歧，无需顾虑' },
  { id: 'q7', category: '团队活力', title: '跨部门协作时，资源和支持能快速到位' },
  { id: 'q8', category: '团队活力', title: '团队领导公平分配机会与认可' },
  { id: 'q9', category: '团队活力', title: '我的同事会主动分享经验或资源' },
  { id: 'q10', category: '团队活力', title: '团队容错机制让我敢于尝试新方法' },
  { id: 'q11', category: '组织活动', title: '公司流程简化，组织扁平，能少有内耗' },
  { id: 'q12', category: '组织活动', title: '高层决策会考虑员工反馈并透明沟通' },
  { id: 'q13', category: '组织活动', title: '公司的企业文化开放包容，鼓励创新与试错，不压抑个性' },
  { id: 'q14', category: '组织活动', title: '各级员工的职业发展路径清晰可见' },
  { id: 'q15', category: '组织活动', title: '企业文化以目标导向而非形式主义，官僚主义' }
];

const advices = [
  {
    minScore: 15,
    maxScore: 44,
    level: '活力不足',
    summary: '您的组织在基础运营中存在明显短板，员工主动性不足、协作效率低，需优先解决资源支持与目标共识问题，避免影响整体绩效。',
    problems: [
      '🚫 资源支持缺失：工具/培训不足，工作推进受阻',
      '🚫 目标共识破裂：个人与组织目标脱节，员工盲目干活',
      '🚫 激励机制失效：付出与回报不匹配，积极性受挫'
    ],
    suggestions: {
      shortTerm: [
        '召开全员目标对齐会，明确各岗位核心职责',
        '优先解决高频工作所需工具/权限问题',
        '设立“月度优秀贡献奖”，快速激活积极性'
      ],
      midTerm: [
        '优化薪酬体系，增加绩效奖金占比',
        '搭建跨部门协作平台，明确对接人',
        '开展基础技能培训，弥补能力短板'
      ]
    }
  },
  {
    minScore: 45,
    maxScore: 55,
    level: '活力一般',
    summary: '组织基础运营顺畅，但在效率提升与员工成长上有瓶颈，团队协作偶有摩擦，精准优化即可实现从“合格”到“优秀”的跨越。',
    problems: [
      '⚠️ 协作效率低：跨部门流程繁琐，响应缓慢',
      '⚠️ 发展通道模糊：员工不清楚晋升路径，成长动力不足',
      '⚠️ 创新氛围弱：想法缺乏表达渠道，试错成本高'
    ],
    suggestions: {
      shortTerm: [
        '梳理核心流程，砍掉冗余环节，明确时限',
        '每月召开跨部门沟通会，现场协调问题',
        '推行“协作伙伴制”，高频协作部门结对优化'
      ],
      midTerm: [
        '制定职业发展路径图，明确晋升条件',
        '建立“师徒结对”机制，助力新员工成长',
        '提供个性化培训，匹配职业规划需求'
      ]
    }
  },
  {
    minScore: 56,
    maxScore: 75,
    level: '高活力组织',
    summary: '您的组织运营健康，员工敬业度高、协作顺畅、创新能力强！需警惕“自满风险”，通过持续迭代保持领先优势。',
    problems: [
      '✅ 目标共识度高，员工清楚工作意义',
      '✅ 团队协作高效，跨部门沟通顺畅',
      '✅ 创新氛围浓厚，员工敢于尝试',
      '潜在风险：外部变化响应可能不及时，长期激励易出现疲劳，优秀人才保留压力增大'
    ],
    suggestions: {
      shortTerm: [
        '设立创新项目孵化基金，允许10%工作时间探索',
        '组织跨行业交流，避免内部思维固化',
        '定期复盘创新项目，提炼可复制经验'
      ],
      midTerm: [
        '设计股权激励/项目分红，绑定核心员工',
        '提供定制化发展计划（海外培训/高层辅导）',
        '打造雇主品牌，提升人才吸引力'
      ]
    }
  }
];

exports.main = async (event, context) => {
  try {
    // Initialize questions
    const qCount = await db.collection('ocs_questions').count();
    if (qCount.total === 0) {
      for (const q of questions) {
        await db.collection('ocs_questions').add({ data: q });
      }
    }

    // Initialize advices
    const aCount = await db.collection('ocs_advice').count();
    if (aCount.total === 0) {
      for (const a of advices) {
        await db.collection('ocs_advice').add({ data: a });
      }
    }

    return { success: true, message: 'Initialization complete' };
  } catch (err) {
    console.error(err);
    return { success: false, error: err };
  }
};