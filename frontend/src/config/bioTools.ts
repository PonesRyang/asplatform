export interface BioToolParameter {
  key: string
  label: string
  type: 'columnSelect' | 'columnMultiSelect' | 'number' | 'select'
  required: boolean
  description?: string
  options?: { value: string; label: string }[]
}

export interface BioTool {
  key: string
  name: string
  category: string
  description: string
  chartType: string
  parameters: BioToolParameter[]
  dataRequirements: string
}

export const BIO_TOOLS: BioTool[] = [
  // ========================
  // 基础图表
  // ========================
  {
    key: 'bar',
    name: '柱状图',
    category: '基础图表',
    description: '绘制分组柱状图，适合比较不同分组间的数值差异',
    chartType: 'bar',
    parameters: [
      {
        key: 'xColumn',
        label: 'X轴列（分组）',
        type: 'columnSelect',
        required: true,
        description: '用作X轴分类的列',
      },
      {
        key: 'yColumn',
        label: 'Y轴列（数值）',
        type: 'columnSelect',
        required: true,
        description: '用作Y轴数值的列',
      },
      {
        key: 'colorColumn',
        label: '颜色分组列',
        type: 'columnSelect',
        required: false,
        description: '可选的二级分组列，用于堆叠或分组着色',
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要至少一列分类数据和一列数值数据',
  },
  {
    key: 'line',
    name: '折线图',
    category: '基础图表',
    description: '绘制折线图，适合展示数据随连续变量的变化趋势',
    chartType: 'line',
    parameters: [
      {
        key: 'xColumn',
        label: 'X轴列（连续变量）',
        type: 'columnSelect',
        required: true,
        description: '用作X轴的连续变量列',
      },
      {
        key: 'yColumn',
        label: 'Y轴列（数值）',
        type: 'columnSelect',
        required: true,
        description: '用作Y轴数值的列',
      },
      {
        key: 'colorColumn',
        label: '分组列',
        type: 'columnSelect',
        required: false,
        description: '可选的分组变量',
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要至少一列连续变量和一列数值数据',
  },
  {
    key: 'scatter',
    name: '散点图',
    category: '基础图表',
    description: '绘制散点图，适合展示两个连续变量间的关系',
    chartType: 'scatter',
    parameters: [
      {
        key: 'xColumn',
        label: 'X轴列',
        type: 'columnSelect',
        required: true,
        description: '用作X轴的连续变量列',
      },
      {
        key: 'yColumn',
        label: 'Y轴列',
        type: 'columnSelect',
        required: true,
        description: '用作Y轴的连续变量列',
      },
      {
        key: 'colorColumn',
        label: '颜色分组列',
        type: 'columnSelect',
        required: false,
        description: '可选的颜色分组变量',
      },
      {
        key: 'sizeColumn',
        label: '点大小列',
        type: 'columnSelect',
        required: false,
        description: '可选的数值列，控制散点大小',
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要至少两列连续数值数据',
  },
  {
    key: 'box',
    name: '箱线图',
    category: '基础图表',
    description: '绘制箱线图，展示数据分布的中位数、四分位数和异常值',
    chartType: 'box',
    parameters: [
      {
        key: 'xColumn',
        label: 'X轴列（分组）',
        type: 'columnSelect',
        required: true,
        description: '用作X轴分组的分类列',
      },
      {
        key: 'yColumn',
        label: 'Y轴列（数值）',
        type: 'columnSelect',
        required: true,
        description: '用作Y轴数值的列',
      },
      {
        key: 'colorColumn',
        label: '颜色分组列',
        type: 'columnSelect',
        required: false,
        description: '可选的二级分组变量',
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要至少一列分类数据和一列数值数据',
  },
  {
    key: 'violin',
    name: '小提琴图',
    category: '基础图表',
    description: '绘制小提琴图，结合箱线图和核密度估计展示数据分布',
    chartType: 'violin',
    parameters: [
      {
        key: 'xColumn',
        label: 'X轴列（分组）',
        type: 'columnSelect',
        required: true,
        description: '用作X轴分组的分类列',
      },
      {
        key: 'yColumn',
        label: 'Y轴列（数值）',
        type: 'columnSelect',
        required: true,
        description: '用作Y轴数值的列',
      },
      {
        key: 'colorColumn',
        label: '颜色分组列',
        type: 'columnSelect',
        required: false,
        description: '可选的二级分组变量',
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要至少一列分类数据和一列数值数据',
  },
  {
    key: 'heatmap',
    name: '热力图',
    category: '基础图表',
    description: '绘制热力图，用颜色深浅展示矩阵数据的大小关系',
    chartType: 'heatmap',
    parameters: [
      {
        key: 'xColumn',
        label: 'X轴列',
        type: 'columnSelect',
        required: true,
        description: '用作矩阵列的变量',
      },
      {
        key: 'yColumn',
        label: 'Y轴列',
        type: 'columnSelect',
        required: true,
        description: '用作矩阵行的变量',
      },
      {
        key: 'valueColumn',
        label: '数值列',
        type: 'columnSelect',
        required: true,
        description: '用于填充颜色强度的数值列',
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要至少两列分类变量和一列数值数据',
  },
  {
    key: 'circular_heatmap',
    name: '环形热力图',
    category: '基础图表',
    description: '绘制环形热力图，适合展示周期性数据或基因组数据',
    chartType: 'circular_heatmap',
    parameters: [
      {
        key: 'category_column',
        label: '分类列',
        type: 'columnSelect',
        required: true,
        description: '用于环形分区的分类列',
      },
      {
        key: 'valueColumn',
        label: '数值列',
        type: 'columnSelect',
        required: true,
        description: '用于颜色填充的数值列',
      },
      {
        key: 'groupColumn',
        label: '分组列',
        type: 'columnSelect',
        required: false,
        description: '可选的分组变量',
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要至少一列分类数据和一列数值数据',
  },
  {
    key: 'histogram',
    name: '直方图',
    category: '基础图表',
    description: '绘制直方图，展示单变量的频率分布',
    chartType: 'histogram',
    parameters: [
      {
        key: 'xColumn',
        label: '数值列',
        type: 'columnSelect',
        required: true,
        description: '需要绘制频率分布的数值列',
      },
      {
        key: 'bins',
        label: '分箱数',
        type: 'number',
        required: false,
        description: '直方图的分箱数量，默认自动计算',
      },
      {
        key: 'colorColumn',
        label: '分组列',
        type: 'columnSelect',
        required: false,
        description: '可选的分组变量，用于叠加直方图',
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要至少一列数值数据',
  },
  {
    key: 'smooth_curve',
    name: '平滑曲线',
    category: '基础图表',
    description: '绘制平滑拟合曲线，展示数据整体趋势',
    chartType: 'smooth_curve',
    parameters: [
      {
        key: 'xColumn',
        label: 'X轴列',
        type: 'columnSelect',
        required: true,
        description: '用作X轴的连续变量列',
      },
      {
        key: 'yColumn',
        label: 'Y轴列',
        type: 'columnSelect',
        required: true,
        description: '用作Y轴数值的列',
      },
      {
        key: 'colorColumn',
        label: '分组列',
        type: 'columnSelect',
        required: false,
        description: '可选的分组变量',
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要至少两列连续数值数据',
  },
  {
    key: 'cluster_heatmap',
    name: '聚类热力图',
    category: '基础图表',
    description: '绘制带层次聚类的热力图，同时展示数据矩阵和聚类树',
    chartType: 'cluster_heatmap',
    parameters: [
      {
        key: 'columns',
        label: '数值列（多选）',
        type: 'columnMultiSelect',
        required: true,
        description: '用于构建矩阵的多个数值列',
      },
      {
        key: 'row_label_column',
        label: '行标签列',
        type: 'columnSelect',
        required: true,
        description: '用于标识每一行的标签列',
      },
      {
        key: 'cluster_rows',
        label: '对行聚类',
        type: 'select',
        required: false,
        description: '是否对行进行层次聚类',
        options: [
          { value: 'true', label: '是' },
          { value: 'false', label: '否' },
        ],
      },
      {
        key: 'cluster_columns',
        label: '对列聚类',
        type: 'select',
        required: false,
        description: '是否对列进行层次聚类',
        options: [
          { value: 'true', label: '是' },
          { value: 'false', label: '否' },
        ],
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要至少一列标签列和多列数值数据',
  },

  // ========================
  // 差异分析
  // ========================
  {
    key: 'volcano',
    name: '火山图',
    category: '差异分析',
    description: '绘制火山图，展示差异表达分析中的显著性（p值）和效应大小（倍数变化）',
    chartType: 'volcano',
    parameters: [
      {
        key: 'gene_column',
        label: '基因/特征列',
        type: 'columnSelect',
        required: true,
        description: '基因名称或特征ID列',
      },
      {
        key: 'log2fc_column',
        label: 'log2倍数变化列',
        type: 'columnSelect',
        required: true,
        description: 'log2 Fold Change列',
      },
      {
        key: 'pvalue_column',
        label: 'P值列',
        type: 'columnSelect',
        required: true,
        description: '显著性P值列',
      },
      {
        key: 'threshold_fc',
        label: '倍数变化阈值',
        type: 'number',
        required: false,
        description: 'log2FC阈值，默认1.0',
      },
      {
        key: 'threshold_p',
        label: 'P值阈值',
        type: 'number',
        required: false,
        description: '显著性阈值，默认0.05',
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要包含基因名称、log2倍数变化、P值三列',
  },

  // ========================
  // 统计检验
  // ========================
  {
    key: 'ttest',
    name: 'T检验',
    category: '统计检验',
    description: '独立样本或配对样本T检验，比较两组间均值差异',
    chartType: 'ttest',
    parameters: [
      {
        key: 'groupColumn',
        label: '分组列',
        type: 'columnSelect',
        required: true,
        description: '包含两个水平的分类变量',
      },
      {
        key: 'valueColumn',
        label: '数值列',
        type: 'columnSelect',
        required: true,
        description: '待检验的数值变量',
      },
      {
        key: 'test_type',
        label: '检验类型',
        type: 'select',
        required: false,
        options: [
          { value: 'independent', label: '独立样本T检验' },
          { value: 'paired', label: '配对T检验' },
        ],
        description: '选择独立样本或配对检验',
      },
      {
        key: 'alternative',
        label: '备择假设',
        type: 'select',
        required: false,
        options: [
          { value: 'two-sided', label: '双侧' },
          { value: 'greater', label: '大于' },
          { value: 'less', label: '小于' },
        ],
        description: '备择假设方向',
      },
    ],
    dataRequirements: '需要包含一个二分类变量和一个连续数值变量',
  },
  {
    key: 'wilcox',
    name: 'Wilcoxon检验',
    category: '统计检验',
    description: '非参数的秩和检验，不依赖正态性假设，比较两组间差异',
    chartType: 'wilcox',
    parameters: [
      {
        key: 'groupColumn',
        label: '分组列',
        type: 'columnSelect',
        required: true,
        description: '包含两个水平的分类变量',
      },
      {
        key: 'valueColumn',
        label: '数值列',
        type: 'columnSelect',
        required: true,
        description: '待检验的数值变量',
      },
      {
        key: 'test_type',
        label: '检验类型',
        type: 'select',
        required: false,
        options: [
          { value: 'ranksum', label: 'Mann-Whitney U (独立)' },
          { value: 'signedrank', label: 'Wilcoxon符号秩 (配对)' },
        ],
        description: '选择独立样本或配对检验',
      },
      {
        key: 'alternative',
        label: '备择假设',
        type: 'select',
        required: false,
        options: [
          { value: 'two-sided', label: '双侧' },
          { value: 'greater', label: '大于' },
          { value: 'less', label: '小于' },
        ],
        description: '备择假设方向',
      },
    ],
    dataRequirements: '需要包含一个二分类变量和一个连续数值变量',
  },
  {
    key: 'anova',
    name: '方差分析',
    category: '统计检验',
    description: '单因素方差分析，比较三组及以上间均值差异',
    chartType: 'anova',
    parameters: [
      {
        key: 'groupColumn',
        label: '分组列',
        type: 'columnSelect',
        required: true,
        description: '包含多个水平的分类变量',
      },
      {
        key: 'valueColumn',
        label: '数值列',
        type: 'columnSelect',
        required: true,
        description: '待检验的数值变量',
      },
      {
        key: 'posthoc',
        label: '事后多重比较',
        type: 'select',
        required: false,
        options: [
          { value: 'tukey', label: 'Tukey HSD' },
          { value: 'none', label: '不进行' },
        ],
        description: '方差分析显著后的事后两两比较方法',
      },
    ],
    dataRequirements: '需要包含一个多水平分类变量和一个连续数值变量',
  },
  {
    key: 'chisq',
    name: '卡方检验',
    category: '统计检验',
    description: '卡方独立性检验，检验两个分类变量间的关联性',
    chartType: 'chisq',
    parameters: [
      {
        key: 'row_column',
        label: '列联表行变量',
        type: 'columnSelect',
        required: true,
        description: '用作联表行的分类变量',
      },
      {
        key: 'col_column',
        label: '列联表列变量',
        type: 'columnSelect',
        required: true,
        description: '用作联表列的分类变量',
      },
      {
        key: 'correction',
        label: '连续性校正',
        type: 'select',
        required: false,
        options: [
          { value: 'true', label: '是（Yates校正）' },
          { value: 'false', label: '否' },
        ],
        description: '是否对2x2表使用Yates连续性校正',
      },
    ],
    dataRequirements: '需要包含两个分类变量',
  },
  {
    key: 'fisher',
    name: 'Fisher精确检验',
    category: '统计检验',
    description: 'Fisher精确检验，适合小样本的2x2列联表检验',
    chartType: 'fisher',
    parameters: [
      {
        key: 'row_column',
        label: '列联表行变量',
        type: 'columnSelect',
        required: true,
        description: '用作联表行的分类变量',
      },
      {
        key: 'col_column',
        label: '列联表列变量',
        type: 'columnSelect',
        required: true,
        description: '用作联表列的分类变量',
      },
      {
        key: 'alternative',
        label: '备择假设',
        type: 'select',
        required: false,
        options: [
          { value: 'two-sided', label: '双侧' },
          { value: 'greater', label: '大于' },
          { value: 'less', label: '小于' },
        ],
        description: '备择假设方向',
      },
    ],
    dataRequirements: '需要包含两个分类变量（特别是2x2列表）',
  },

  // ========================
  // 回归与相关
  // ========================
  {
    key: 'linreg',
    name: '线性回归',
    category: '回归与相关',
    description: '简单线性回归分析，拟合y = ax + b模型并给出统计检验',
    chartType: 'linreg',
    parameters: [
      {
        key: 'xColumn',
        label: '自变量X列',
        type: 'columnSelect',
        required: true,
        description: '回归的自变量',
      },
      {
        key: 'yColumn',
        label: '因变量Y列',
        type: 'columnSelect',
        required: true,
        description: '回归的因变量',
      },
      {
        key: 'ci',
        label: '置信区间',
        type: 'number',
        required: false,
        description: '置信区间水平，默认0.95',
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要至少两列连续数值数据',
  },
  {
    key: 'logreg',
    name: '逻辑回归',
    category: '回归与相关',
    description: '二元逻辑回归分析，预测二分类结果的概率',
    chartType: 'logreg',
    parameters: [
      {
        key: 'xColumns',
        label: '自变量列（多选）',
        type: 'columnMultiSelect',
        required: true,
        description: '回归的自变量，可选择多个',
      },
      {
        key: 'yColumn',
        label: '因变量列（二分类）',
        type: 'columnSelect',
        required: true,
        description: '必须为二分类变量（0/1或两个水平）',
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要一个二分类因变量和至少一个自变量',
  },
  {
    key: 'lasso',
    name: 'LASSO回归',
    category: '回归与相关',
    description: 'L1正则化线性回归，用于特征选择和稀疏建模',
    chartType: 'lasso',
    parameters: [
      {
        key: 'xColumns',
        label: '自变量列（多选）',
        type: 'columnMultiSelect',
        required: true,
        description: '特征变量列',
      },
      {
        key: 'yColumn',
        label: '因变量列',
        type: 'columnSelect',
        required: true,
        description: '目标变量列',
      },
      {
        key: 'alpha',
        label: '正则化强度 (alpha)',
        type: 'number',
        required: false,
        description: 'L1惩罚系数，越大越稀疏',
      },
      {
        key: 'cv',
        label: '交叉验证折数',
        type: 'number',
        required: false,
        description: '用于选择最优alpha的交叉验证折数',
      },
    ],
    dataRequirements: '需要一个连续因变量和多个自变量',
  },
  {
    key: 'ridge',
    name: '岭回归',
    category: '回归与相关',
    description: 'L2正则化线性回归，用于处理多重共线性问题',
    chartType: 'ridge',
    parameters: [
      {
        key: 'xColumns',
        label: '自变量列（多选）',
        type: 'columnMultiSelect',
        required: true,
        description: '特征变量列',
      },
      {
        key: 'yColumn',
        label: '因变量列',
        type: 'columnSelect',
        required: true,
        description: '目标变量列',
      },
      {
        key: 'alpha',
        label: '正则化强度 (alpha)',
        type: 'number',
        required: false,
        description: 'L2惩罚系数',
      },
      {
        key: 'cv',
        label: '交叉验证折数',
        type: 'number',
        required: false,
        description: '用于选择最优alpha的交叉验证折数',
      },
    ],
    dataRequirements: '需要一个连续因变量和多个自变量',
  },
  {
    key: 'corr',
    name: '相关性分析',
    category: '回归与相关',
    description: '计算Pearson或Spearman相关系数矩阵',
    chartType: 'corr',
    parameters: [
      {
        key: 'columns',
        label: '数值列（多选）',
        type: 'columnMultiSelect',
        required: true,
        description: '参与相关性分析的数值列',
      },
      {
        key: 'method',
        label: '相关系数方法',
        type: 'select',
        required: false,
        options: [
          { value: 'pearson', label: 'Pearson（线性相关）' },
          { value: 'spearman', label: 'Spearman（秩相关）' },
        ],
        description: '选择Pearson或Spearman相关系数',
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要至少两列数值数据',
  },

  // ========================
  // 生存与诊断
  // ========================
  {
    key: 'km',
    name: 'Kaplan-Meier曲线',
    category: '生存与诊断',
    description: 'Kaplan-Meier生存曲线，展示不同组间的生存概率变化',
    chartType: 'km',
    parameters: [
      {
        key: 'timeColumn',
        label: '时间列',
        type: 'columnSelect',
        required: true,
        description: '生存时间或随访时间列',
      },
      {
        key: 'eventColumn',
        label: '事件状态列',
        type: 'columnSelect',
        required: true,
        description: '事件发生标志列（1=事件发生，0=删失）',
      },
      {
        key: 'groupColumn',
        label: '分组列',
        type: 'columnSelect',
        required: false,
        description: '可选的比较分组',
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要时间列（数值）和事件状态列（0/1）',
  },
  {
    key: 'cox',
    name: 'Cox回归',
    category: '生存与诊断',
    description: 'Cox比例风险回归分析，评估预后因素对生存的影响',
    chartType: 'cox',
    parameters: [
      {
        key: 'timeColumn',
        label: '时间列',
        type: 'columnSelect',
        required: true,
        description: '生存时间或随访时间列',
      },
      {
        key: 'eventColumn',
        label: '事件状态列',
        type: 'columnSelect',
        required: true,
        description: '事件发生标志列（1=事件发生，0=删失）',
      },
      {
        key: 'covariateColumns',
        label: '协变量列（多选）',
        type: 'columnMultiSelect',
        required: true,
        description: '作为预后因素的协变量列',
      },
    ],
    dataRequirements: '需要时间列、事件状态列和至少一个协变量列',
  },
  {
    key: 'logrank',
    name: 'Log-rank检验',
    category: '生存与诊断',
    description: 'Log-rank检验，比较两组或多组生存曲线差异的显著性',
    chartType: 'logrank',
    parameters: [
      {
        key: 'timeColumn',
        label: '时间列',
        type: 'columnSelect',
        required: true,
        description: '生存时间或随访时间列',
      },
      {
        key: 'eventColumn',
        label: '事件状态列',
        type: 'columnSelect',
        required: true,
        description: '事件发生标志列（1=事件发生，0=删失）',
      },
      {
        key: 'groupColumn',
        label: '分组列',
        type: 'columnSelect',
        required: true,
        description: '比较的分组变量',
      },
    ],
    dataRequirements: '需要时间列、事件状态列和分组列',
  },
  {
    key: 'roc',
    name: 'ROC曲线',
    category: '生存与诊断',
    description: '受试者工作特征（ROC）曲线和AUC计算，评估分类器性能',
    chartType: 'roc',
    parameters: [
      {
        key: 'true_label_column',
        label: '真实标签列',
        type: 'columnSelect',
        required: true,
        description: '真实的二分类标签列（0/1）',
      },
      {
        key: 'pred_score_column',
        label: '预测概率列',
        type: 'columnSelect',
        required: true,
        description: '预测为正类的概率/得分列',
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要真实二分类标签列和预测概率列',
  },

  // ========================
  // 降维与多组学
  // ========================
  {
    key: 'pca',
    name: 'PCA主成分分析',
    category: '降维与多组学',
    description: '主成分分析，用于数据降维和样本聚类可视化',
    chartType: 'pca',
    parameters: [
      {
        key: 'columns',
        label: '特征列（多选）',
        type: 'columnMultiSelect',
        required: true,
        description: '参与PCA分析的数值特征列',
      },
      {
        key: 'colorColumn',
        label: '颜色分组列',
        type: 'columnSelect',
        required: false,
        description: '用于着色样本的分组变量',
      },
      {
        key: 'labelColumn',
        label: '标签列',
        type: 'columnSelect',
        required: false,
        description: '用于标注样本点的标签列',
      },
      {
        key: 'n_components',
        label: '主成分数量',
        type: 'number',
        required: false,
        description: '保留的主成分数量，默认2',
      },
      {
        key: 'scale',
        label: '数据标准化',
        type: 'select',
        required: false,
        options: [
          { value: 'true', label: '是（推荐）' },
          { value: 'false', label: '否' },
        ],
        description: '是否先对数据标准化处理',
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要至少两列数值特征数据',
  },
  {
    key: 'plsda',
    name: 'PLS-DA分析',
    category: '降维与多组学',
    description: '偏最小二乘判别分析，用于有监督的降维和组间区分',
    chartType: 'plsda',
    parameters: [
      {
        key: 'xColumns',
        label: '特征列（多选）',
        type: 'columnMultiSelect',
        required: true,
        description: '参与PLS-DA的数值特征列',
      },
      {
        key: 'yColumn',
        label: '标签/分组列',
        type: 'columnSelect',
        required: true,
        description: '样本的分类/分组标签列',
      },
      {
        key: 'n_components',
        label: '潜变量数量',
        type: 'number',
        required: false,
        description: 'PLS潜变量数量，默认2',
      },
      {
        key: 'title',
        label: '图表标题',
        type: 'columnSelect',
        required: false,
        description: '自定义图表标题',
      },
    ],
    dataRequirements: '需要至少两列数值特征数据和一个分类标签列',
  },
]

export const BIO_TOOL_CATEGORIES = [
  '基础图表',
  '差异分析',
  '统计检验',
  '回归与相关',
  '生存与诊断',
  '降维与多组学',
]

export function getToolByKey(key: string): BioTool | undefined {
  return BIO_TOOLS.find((t) => t.key === key)
}

export function getToolsByCategory(category: string): BioTool[] {
  return BIO_TOOLS.filter((t) => t.category === category)
}
