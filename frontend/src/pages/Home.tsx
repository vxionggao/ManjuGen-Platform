import React, { useState, useRef, useEffect } from 'react';
import { Layout, Input, Button, Typography, Card, Space, Avatar, theme, Tag, message } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, BulbOutlined, PictureOutlined, VideoCameraOutlined, FireOutlined, ClockCircleOutlined, PlayCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { StoryWorkspace } from '../components/StoryWorkspace';
import { listProjects, getProject } from '../services/api';

const { Content } = Layout;
const { Title, Text } = Typography;

export default function Home() {
  const navigate = useNavigate();
  
  // Persistent State Helper
  const useSessionState = <T,>(key: string, defaultValue: T) => {
      const [state, setState] = useState<T>(() => {
          try {
              const stored = sessionStorage.getItem(key);
              return stored ? JSON.parse(stored) : defaultValue;
          } catch (e) { return defaultValue; }
      });
      useEffect(() => {
          sessionStorage.setItem(key, JSON.stringify(state));
      }, [key, state]);
      return [state, setState] as const;
  };

  const [inputValue, setInputValue] = useSessionState('home_inputValue', '');
  const [hasStarted, setHasStarted] = useSessionState('home_hasStarted', false);
  const [currentPrompt, setCurrentPrompt] = useSessionState('home_currentPrompt', '');
  const [messages, setMessages] = useSessionState<{ role: 'user' | 'ai'; content: string }[]>('home_messages', [
    { role: 'ai', content: '欢迎来到飞星漫剧平台！我是您的创意助手。想创作什么故事？' }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    const userMsg = inputValue;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInputValue('');
    setIsTyping(true);
    
    // Switch to workspace mode
    setHasStarted(true);
    setCurrentPrompt(userMsg);

    // Simulate AI response
    setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, { role: 'ai', content: '已为您生成项目大纲。请在右侧工作台查看详情，您可以调整角色、风格和画幅，确认无误后点击生成分镜。' }]);
    }, 1500);
  };

  const handleWorkspaceMessage = (content: string) => {
      setMessages(prev => [...prev, { role: 'ai', content }]);
  };

  const handleBackToHome = () => {
      setHasStarted(false);
      setMessages([{ role: 'ai', content: '欢迎来到飞星漫剧平台！我是您的创意助手。想创作什么故事？' }]);
      setInputValue('');
  };

  const handleResumeProject = async (projectId: string) => {
      try {
          message.loading('正在加载项目...', 0.5);
          const project = await getProject(projectId);
          const data = project.data;
          
          // Restore session
          sessionStorage.setItem('ws_projectId', JSON.stringify(project.id));
          sessionStorage.setItem('ws_style', JSON.stringify(data.style));
          sessionStorage.setItem('ws_ratio', JSON.stringify(data.ratio));
          sessionStorage.setItem('ws_storyData', JSON.stringify(data.storyData));
          sessionStorage.setItem('ws_currentStep', JSON.stringify(data.currentStep));
          sessionStorage.setItem('ws_characters', JSON.stringify(data.characters));
          sessionStorage.setItem('ws_tasks', JSON.stringify(data.tasks));
          sessionStorage.setItem('ws_videoTasks', JSON.stringify(data.videoTasks));
          sessionStorage.setItem('ws_stitchTaskId', JSON.stringify(data.stitchTaskId));
          sessionStorage.setItem('ws_stitchResult', JSON.stringify(data.stitchResult));
          
          setCurrentPrompt(data.prompt);
          setHasStarted(true);
      } catch (e) {
          message.error('加载项目失败');
      }
  };

  const suggestions = [
    { icon: <UserOutlined />, text: '设计一个赛博朋克风格的漫剧', action: () => { setInputValue('设计一个赛博朋克风格的漫剧'); } },
    { icon: <PictureOutlined />, text: '生成一张雨夜街道的场景图', action: () => navigate('/art') },
    { icon: <VideoCameraOutlined />, text: '制作一段角色回眸的动画', action: () => navigate('/motion') },
  ];

  const showcases = [
      { id: 1, title: '白雪公主', cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=60', tags: ['童话', '3D'] },
      { id: 2, title: '灰姑娘', cover: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&auto=format&fit=crop&q=60', tags: ['奇幻', '电影感'] },
      { id: 3, title: '木偶奇遇记', cover: 'https://images.unsplash.com/photo-1535905557558-afc4877a26fc?w=600&auto=format&fit=crop&q=60', tags: ['冒险', '绘本'] },
      { id: 4, title: '小王子', cover: 'https://images.unsplash.com/photo-1618042164219-62c820f10723?w=600&auto=format&fit=crop&q=60', tags: ['治愈', '水彩'] },
  ];

  const [myProjects, setMyProjects] = useState<any[]>([]);

  useEffect(() => {
    if (!hasStarted) {
        listProjects().then(res => {
            const formatted = res.map((p: any) => ({
                id: p.id,
                title: p.title,
                date: p.created_at,
                cover: p.cover_image || 'https://images.unsplash.com/photo-1618042164219-62c820f10723?w=600&auto=format&fit=crop&q=60'
            }));
            setMyProjects(formatted);
        }).catch(console.error);
    }
  }, [hasStarted]);

  // Landing Page Layout
  if (!hasStarted) {
      return (
        <Content style={{ height: '100%', overflowY: 'auto', background: '#161618' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
             
             {/* Hero Section */}
             <div style={{ minHeight: '95vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                 <div style={{ width: '100%', maxWidth: 800, textAlign: 'center' }}>
                     <Title level={1} style={{ color: '#fff', marginBottom: 24, fontSize: 48, letterSpacing: 2, fontWeight: 700 }}>让创意流动起来</Title>
                     <Text style={{ color: '#888', fontSize: 20, display: 'block', marginBottom: 60 }}>飞星漫剧 · 一站式 AI 漫画创作平台</Text>
                     
                     <div style={{ position: 'relative' }}>
                        <Input.TextArea 
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="描述你想创作的故事、角色或场景..."
                            autoSize={{ minRows: 1, maxRows: 6 }}
                            style={{ 
                                background: 'rgba(42, 42, 45, 0.8)', 
                                border: '1px solid rgba(255,255,255,0.1)', 
                                borderRadius: 16, 
                                padding: '20px 60px 20px 24px', 
                                fontSize: 18, 
                                color: '#fff',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                                resize: 'none',
                                backdropFilter: 'blur(10px)'
                            }}
                        />
                        <Button 
                            type="text" 
                            icon={<SendOutlined />} 
                            onClick={handleSend}
                            style={{ position: 'absolute', right: 16, bottom: 16, color: inputValue ? '#6E56CF' : '#666', fontSize: 20 }}
                        />
                     </div>
                     
                     {/* Quick Tags */}
                     <div style={{ marginTop: 32, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {suggestions.map((s, i) => (
                            <div 
                                key={i} 
                                onClick={s.action}
                                style={{ 
                                    padding: '10px 20px', 
                                    borderRadius: 30, 
                                    cursor: 'pointer', 
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    fontSize: 14,
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    color: '#aaa',
                                    transition: 'all 0.3s'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                    e.currentTarget.style.color = '#fff';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                    e.currentTarget.style.color = '#aaa';
                                }}
                            >
                                {s.icon} {s.text}
                            </div>
                        ))}
                     </div>
                 </div>
                 
                 {/* Scroll Indicator */}
                 <div style={{ position: 'absolute', bottom: 40, opacity: 0.5, animation: 'bounce 2s infinite' }}>
                    <div style={{ width: 1, height: 60, background: 'linear-gradient(to bottom, #6E56CF, transparent)', margin: '0 auto' }}></div>
                    <Text style={{ color: '#666', fontSize: 12, marginTop: 8 }}>SCROLL</Text>
                 </div>
             </div>

             {/* Content Section */}
             <div style={{ paddingBottom: 100, paddingTop: 120 }}>

             {/* Showcase */}
             <div style={{ marginBottom: 60 }}>
                 <Title level={3} style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                     <FireOutlined style={{ color: '#FF5722' }} /> 热门案例
                 </Title>
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24 }}>
                     {showcases.map(item => (
                         <div key={item.id} style={{ borderRadius: 12, overflow: 'hidden', position: 'relative', aspectRatio: '16/9', cursor: 'pointer', border: '1px solid #333' }}>
                             <img src={item.cover} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }} />
                             <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '40px 16px 16px', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }}>
                                 <div style={{ color: '#fff', fontWeight: 600, fontSize: 16 }}>{item.title}</div>
                                 <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                     {item.tags.map(t => <span key={t} style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: 4, fontSize: 10, color: '#eee' }}>{t}</span>)}
                                 </div>
                             </div>
                             <div className="play-icon" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.8, background: 'rgba(0,0,0,0.6)', borderRadius: '50%', padding: 12, display: 'flex' }}>
                                 <PlayCircleOutlined style={{ fontSize: 32, color: '#fff' }} />
                             </div>
                         </div>
                     ))}
                 </div>
             </div>

             {/* My Projects */}
             <div>
                 <Title level={3} style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                     <UserOutlined style={{ color: '#6E56CF' }} /> 我的作品
                 </Title>
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24 }}>
                     {myProjects.map(item => (
                         <div key={item.id} onClick={() => handleResumeProject(item.id)} style={{ background: '#2a2a2d', borderRadius: 12, overflow: 'hidden', border: '1px solid #333', cursor: 'pointer' }}>
                             <div style={{ height: 140, overflow: 'hidden' }}>
                                 <img src={item.cover} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                             </div>
                             <div style={{ padding: 16 }}>
                                 <div style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{item.title}</div>
                                 <div style={{ color: '#666', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                     <ClockCircleOutlined /> {item.date}
                                 </div>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
             </div>

          </div>
        </Content>
      );
  }

  // Split Layout (Workspace Mode)
  return (
      <Content style={{ height: '100%', display: 'flex', background: '#161618' }}>
          {/* Left: Chat */}
          <div style={{ width: 400, display: 'flex', flexDirection: 'column', borderRight: '1px solid #333', background: '#1f1f22' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #333', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RobotOutlined style={{ color: '#6E56CF' }} /> 创意对话
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                     {messages.map((msg, idx) => (
                         <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 12 }}>
                             {msg.role === 'ai' && (
                                 <Avatar icon={<RobotOutlined />} style={{ background: '#6E56CF', flexShrink: 0 }} />
                             )}
                             <div style={{ 
                                 maxWidth: '85%', 
                                 padding: '12px 16px', 
                                 borderRadius: 8, 
                                 background: msg.role === 'user' ? '#6E56CF' : '#2a2a2d',
                                 color: '#fff',
                                 fontSize: 14,
                                 lineHeight: 1.5,
                                 borderTopLeftRadius: msg.role === 'ai' ? 2 : 8,
                                 borderTopRightRadius: msg.role === 'user' ? 2 : 8,
                             }}>
                                 {msg.content}
                             </div>
                         </div>
                     ))}
                     {isTyping && (
                         <div style={{ display: 'flex', gap: 12 }}>
                             <Avatar icon={<RobotOutlined />} style={{ background: '#6E56CF' }} />
                             <div style={{ padding: '12px 16px', background: '#2a2a2d', borderRadius: 8, borderTopLeftRadius: 2, color: '#888', fontSize: 14 }}>
                                 <LoadingOutlined /> 正在分析故事结构...
                             </div>
                         </div>
                     )}
                     <div ref={messagesEndRef} />
                  </div>
              </div>
              <div style={{ padding: 20, borderTop: '1px solid #333' }}>
                  <div style={{ position: 'relative' }}>
                      <Input.TextArea 
                          value={inputValue}
                          onChange={e => setInputValue(e.target.value)}
                          onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSend();
                              }
                          }}
                          placeholder="修改需求或补充设定..."
                          autoSize={{ minRows: 1, maxRows: 4 }}
                          style={{ background: '#2a2a2d', border: '1px solid #444', borderRadius: 8, paddingRight: 40, color: '#fff', fontSize: 14 }}
                      />
                      <Button 
                          type="text" 
                          icon={<SendOutlined />} 
                          onClick={handleSend}
                          style={{ position: 'absolute', right: 4, bottom: 4, color: inputValue ? '#6E56CF' : '#666' }}
                      />
                  </div>
              </div>
          </div>
          
          {/* Right: Workspace */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
              <StoryWorkspace prompt={currentPrompt} onMessage={handleWorkspaceMessage} onBack={handleBackToHome} />
          </div>
      </Content>
  );
}
