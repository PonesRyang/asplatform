import { useState, useCallback } from 'react';
import { Layout } from 'antd';
import BioSidebar from './BioSidebar';
import BioPanel from './BioPanel';
import BioContent from './BioContent';
import { getToolByKey } from '../../config/bioTools';
import type { BioTool } from '../../config/bioTools';
import type { AnalysisResult } from '../../types/bio';

const { Sider, Content } = Layout;

export default function BioAnalysisWorkbench() {
  const [selectedToolKey, setSelectedToolKey] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const selectedTool: BioTool | undefined = selectedToolKey
    ? getToolByKey(selectedToolKey)
    : undefined;

  const handleSelectTool = useCallback((toolKey: string) => {
    setSelectedToolKey(toolKey);
    // Clear previous results when switching tools
    setAnalysisResult(null);
    setIsAnalyzing(false);
  }, []);

  const handleResult = useCallback((result: AnalysisResult) => {
    setAnalysisResult(result);
    setIsAnalyzing(false);
  }, []);

  return (
    <Layout
      style={{
        height: '100%',
        minHeight: '100vh',
        background: '#fff',
      }}
    >
      {/* ---- Left Sidebar ---- */}
      <Sider
        width={220}
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          overflow: 'hidden',
        }}
      >
        <BioSidebar
          selectedTool={selectedToolKey}
          onSelect={handleSelectTool}
        />
      </Sider>

      {/* ---- Center: Configuration Panel ---- */}
      <Content
        style={{
          flex: '1 1 40%',
          minWidth: 360,
          maxWidth: '45%',
          background: '#fafafa',
          borderRight: '1px solid #f0f0f0',
        }}
      >
        <BioPanel
          tool={selectedTool}
          onResult={(result: AnalysisResult) => {
            handleResult(result);
          }}
        />
      </Content>

      {/* ---- Right: Results Display ---- */}
      <Content
        style={{
          flex: '1 1 40%',
          minWidth: 360,
          background: '#fff',
        }}
      >
        <BioContent result={analysisResult} isLoading={isAnalyzing} />
      </Content>
    </Layout>
  );
}
