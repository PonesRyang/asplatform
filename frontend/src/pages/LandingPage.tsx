import { useNavigate } from 'react-router-dom';
import { Button, Typography } from 'antd';
import { BarChartOutlined, EditOutlined, BookOutlined, ExperimentOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

// ———————————————————————————————————————————
// Design tokens — coherent palette
// ———————————————————————————————————————————
const C = {
  navy: '#1a1a2e',
  navyLight: '#16213e',
  gold: '#c9a96e',
  goldLight: '#f5ecd7',
  green: '#2d6a4f',
  amber: '#b85c38',
  bg: '#faf9f6',
  cardBg: '#ffffff',
  text: '#2c2c2c',
  textMuted: '#7a7a7a',
  border: '#e8e4dd',
};

// ———————————————————————————————————————————
// Shared card styling function
// ———————————————————————————————————————————
const featureCard = (accent: string) => ({
  background: C.cardBg,
  borderRadius: 20,
  padding: '48px 40px 40px',
  border: `1px solid ${C.border}`,
  cursor: 'pointer' as const,
  position: 'relative' as const,
  overflow: 'hidden',
  transition: 'all 0.35s cubic-bezier(0.25, 0.8, 0.25, 1.2)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
});

const accentBar = (color: string) => ({
  position: 'absolute' as const,
  top: 0, left: 40, width: 48, height: 4,
  borderRadius: '0 0 4px 4px',
  background: color,
});

const iconBox = (bg: string, color: string) => ({
  width: 56, height: 56, borderRadius: 16,
  background: bg,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  marginBottom: 24,
});

// ———————————————————————————————————————————
// Hero background pattern (molecular/dna motif)
// ———————————————————————————————————————————
const heroBg = {
  background: `linear-gradient(165deg, ${C.navy} 0%, ${C.navyLight} 40%, #0f3460 100%)`,
  position: 'relative' as const,
  overflow: 'hidden',
};

const dotPattern = (() => {
  const r: React.CSSProperties[] = [];
  for (let i = 0; i < 30; i++) {
    r.push({
      position: 'absolute',
      width: `${2 + Math.random() * 4}px`,
      height: `${2 + Math.random() * 4}px`,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.08)',
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
    });
  }
  return r;
})();

// ———————————————————————————————————————————
// LandingPage component
// ———————————————————————————————————————————
export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif` }}>

      {/* ================================================================ */}
      {/* NAVBAR                                                          */}
      {/* ================================================================ */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 56px', height: 72,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${C.border}`,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
             onClick={() => navigate('/')}>
          {/* Logo mark */}
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyLight} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 12px ${C.navy}40`,
          }}>
            <ExperimentOutlined style={{ fontSize: 20, color: '#fff' }} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.navy, letterSpacing: 1 }}>
            学术科研辅助平台
          </span>
        </div>
        <Button type="text" onClick={() => navigate('/login')}
          style={{ color: C.textMuted, fontWeight: 500, fontSize: 14 }}>
          管理员后台
        </Button>
      </nav>

      {/* ================================================================ */}
      {/* HERO                                                            */}
      {/* ================================================================ */}
      <section style={heroBg}>
        {/* Decorative dots */}
        {dotPattern.map((s, i) => <div key={i} style={s} />)}

        {/* Subtle gradient orbs */}
        <div style={{ position: 'absolute', top: -120, right: -80, width: 400, height: 400,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,169,110,0.10) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -60, width: 300, height: 300,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(45,106,79,0.08) 0%, transparent 70%)' }} />

        <div style={{ maxWidth: 860, margin: '0 auto', padding: '100px 24px 80px',
          textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-block', padding: '6px 18px', borderRadius: 100,
            background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.20)',
            marginBottom: 28,
          }}>
            <Text style={{ color: C.gold, fontSize: 13, fontWeight: 600, letterSpacing: 2 }}>
              AI-POWERED ACADEMIC PLATFORM
            </Text>
          </div>
          <Title style={{
            color: '#fff', fontSize: 48, fontWeight: 800, letterSpacing: -1,
            marginBottom: 20, lineHeight: 1.2,
          }}>
            科研之路，<br />
            <span style={{ color: C.gold }}>每一步都有 AI 相伴</span>
          </Title>
          <Paragraph style={{
            color: 'rgba(255,255,255,0.55)', fontSize: 17, maxWidth: 560,
            margin: '0 auto 48px', lineHeight: 1.7,
          }}>
            集成生物信息学分析与 AI 学术写作辅助，<br />从选题到发表，一站式科研平台。
          </Paragraph>
        </div>
      </section>

      {/* ================================================================ */}
      {/* FEATURE CARDS                                                  */}
      {/* ================================================================ */}
      <section style={{ maxWidth: 1060, margin: '-48px auto 0', padding: '0 24px', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 28 }}>
          {/* 生信分析 */}
          <div style={featureCard(C.green)}
               onClick={() => navigate('/frontend/bio')}
               onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 50px rgba(0,0,0,0.10)'; }}
               onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}>
            <div style={accentBar(C.green)} />
            <div style={iconBox('#e8f5e9', C.green)}>
              <BarChartOutlined style={{ fontSize: 26, color: C.green }} />
            </div>
            <Title level={3} style={{ marginBottom: 12, color: C.text, fontSize: 22 }}>生信分析</Title>
            <Paragraph style={{ color: C.textMuted, lineHeight: 1.75, marginBottom: 24, fontSize: 14 }}>
              豆荚图、火山图、热力图、相关性分析等 27 种图表工具。
              Excel/CSV 上传或粘贴数据，一键生成发表级图表。
            </Paragraph>
            <span style={{ color: C.green, fontWeight: 600, fontSize: 14 }}>
              开始分析 →
            </span>
          </div>

          {/* AI 写作 */}
          <div style={featureCard(C.navy)}
               onClick={() => navigate('/frontend/writing')}
               onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 50px rgba(0,0,0,0.10)'; }}
               onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}>
            <div style={accentBar(C.navy)} />
            <div style={iconBox('#e8eaf6', C.navy)}>
              <EditOutlined style={{ fontSize: 26, color: C.navy }} />
            </div>
            <Title level={3} style={{ marginBottom: 12, color: C.text, fontSize: 22 }}>AI 写作</Title>
            <Paragraph style={{ color: C.textMuted, lineHeight: 1.75, marginBottom: 24, fontSize: 14 }}>
              论文选题生成、提纲撰写、全文生成、学术润色、中英互译等
              一站式 AI 写作辅助，从零到全文仅需几分钟。
            </Paragraph>
            <span style={{ color: C.navy, fontWeight: 600, fontSize: 14 }}>
              开始写作 →
            </span>
          </div>

          {/* 文献分析 */}
          <div style={featureCard(C.amber)}
               onClick={() => navigate('/frontend/lit-compare')}
               onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 50px rgba(0,0,0,0.10)'; }}
               onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}>
            <div style={accentBar(C.amber)} />
            <div style={iconBox('#fbe9e7', C.amber)}>
              <BookOutlined style={{ fontSize: 26, color: C.amber }} />
            </div>
            <Title level={3} style={{ marginBottom: 12, color: C.text, fontSize: 22 }}>文献分析</Title>
            <Paragraph style={{ color: C.textMuted, lineHeight: 1.75, marginBottom: 24, fontSize: 14 }}>
              上传 2-3 篇文献，AI 自动对比研究主题、方法论和结论差异，
              生成研究差距分析与四阶段提升计划。
            </Paragraph>
            <span style={{ color: C.amber, fontWeight: 600, fontSize: 14 }}>
              开始分析 →
            </span>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* HOW IT WORKS — 3 steps                                         */}
      {/* ================================================================ */}
      <section style={{ maxWidth: 900, margin: '100px auto', padding: '0 24px', textAlign: 'center' }}>
        <Text style={{ color: C.gold, fontWeight: 600, letterSpacing: 2, fontSize: 12, textTransform: 'uppercase' }}>
          How it works
        </Text>
        <Title level={2} style={{ color: C.navy, marginTop: 12, marginBottom: 56, fontSize: 30 }}>
          三步开启科研之旅
        </Title>
        <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { step: '01', title: '普通用户令牌', desc: '使用管理员分配的服务令牌进入前台工具', icon: '🔑' },
            { step: '02', title: '选择工具', desc: '根据需求选择生信分析、AI 写作或文献对比', icon: '🛠' },
            { step: '03', title: '获取成果', desc: '一键生成图表、论文或分析报告，导出使用', icon: '📊' },
          ].map((s, i) => (
            <div key={i} style={{ flex: '1 1 200px', maxWidth: 260, textAlign: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
                background: i === 0 ? C.goldLight : i === 1 ? '#e8eaf6' : '#e8f5e9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28,
              }}>{s.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, marginBottom: 8, letterSpacing: 2 }}>
                {s.step}
              </div>
              <Title level={4} style={{ color: C.navy, marginBottom: 8, fontSize: 18 }}>{s.title}</Title>
              <Paragraph style={{ color: C.textMuted, fontSize: 14, lineHeight: 1.7 }}>{s.desc}</Paragraph>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================ */}
      {/* STATS BANNER                                                    */}
      {/* ================================================================ */}
      <section style={{
        background: C.navy, padding: '64px 24px', textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -1, left: 0, right: 0, height: 80,
          background: `linear-gradient(180deg, ${C.bg} 0%, transparent 100%)` }} />
        <div style={{ display: 'flex', gap: 60, justifyContent: 'center', flexWrap: 'wrap',
          position: 'relative', zIndex: 1 }}>
          {[
            { n: '27', label: '分析工具' },
            { n: '10+', label: 'AI 写作模式' },
            { n: '4', label: '学术数据库' },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 42, fontWeight: 800, color: C.gold }}>{s.n}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================ */}
      {/* FOOTER                                                          */}
      {/* ================================================================ */}
      <footer style={{
        padding: '32px 24px', textAlign: 'center',
        borderTop: `1px solid ${C.border}`, background: C.cardBg,
      }}>
        <Text style={{ color: C.textMuted, fontSize: 13 }}>
          学术科研辅助平台 &copy; {new Date().getFullYear()} — 助力科研创新
        </Text>
      </footer>
    </div>
  );
}
