import type { GrantStepKey } from '../../types/grant'

export const grantSteps: Array<{ key: GrantStepKey; title: string; route: string; description: string }> = [
  { key: 'input', title: '输入选题信息', route: 'input', description: '基金类型、研究方向、高级条件' },
  { key: 'keywords', title: '选题关键词', route: 'keywords', description: 'AND / OR 与六类关键词池' },
  { key: 'topics', title: '基金选题', route: 'topics', description: '候选题对比和最终选择' },
  { key: 'report', title: '选题报告', route: 'report', description: '立项论证和选题评估' },
  { key: 'proposal', title: '申请书生成', route: 'proposal', description: '分章节生成和导出 Word' },
]
