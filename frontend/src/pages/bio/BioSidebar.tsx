import { useMemo } from 'react';
import { Menu } from 'antd';
import {
  ExperimentOutlined,
  BarChartOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { BIO_TOOLS, BIO_TOOL_CATEGORIES, type BioTool } from '../../config/bioTools';

interface BioSidebarProps {
  selectedTool: string | null;
  onSelect: (toolKey: string) => void;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case '基础图表':
      return <BarChartOutlined />;
    case '差异分析':
      return <ExperimentOutlined />;
    case '统计检验':
      return <ExperimentOutlined />;
    case '回归与相关':
      return <LineChartOutlined />;
    case '生存与诊断':
      return <LineChartOutlined />;
    case '降维与多组学':
      return <ExperimentOutlined />;
    default:
      return <ExperimentOutlined />;
  }
}

export default function BioSidebar({ selectedTool, onSelect }: BioSidebarProps) {
  const menuItems = useMemo(() => {
    return BIO_TOOL_CATEGORIES.map((category) => {
      const tools: BioTool[] = BIO_TOOLS.filter((t) => t.category === category);
      if (tools.length === 0) return null;

      return {
        key: category,
        label: category,
        icon: getCategoryIcon(category),
        children: tools.map((tool) => ({
          key: tool.key,
          label: tool.name,
        })),
      };
    }).filter(Boolean);
  }, []);

  const handleClick = (info: { key: string }) => {
    onSelect(info.key);
  };

  return (
    <div
      style={{
        height: '100%',
        maxHeight: '100vh',
        overflowY: 'auto',
        borderRight: '1px solid #f0f0f0',
      }}
    >
      <div
        style={{
          padding: '16px 16px 8px',
          fontWeight: 600,
          fontSize: 16,
          color: '#1a1a2e',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        分析工具
      </div>
      <Menu
        mode="inline"
        selectedKeys={selectedTool ? [selectedTool] : []}
        onClick={handleClick}
        items={menuItems}
        style={{ borderInlineEnd: 'none' }}
      />
    </div>
  );
}
