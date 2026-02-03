import React, { useEffect, useState, useRef } from 'react';
import { Modal, Button, Typography, Space, Descriptions, Tag, Divider, Tooltip, App as AntdApp, Spin, Card, Input, Checkbox, message } from 'antd';
import { DownloadOutlined, EditOutlined, ReloadOutlined, CloseOutlined, LeftOutlined, RightOutlined, BulbOutlined, CopyOutlined, CheckCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { CachedImage, CachedVideo } from './CachedAsset';
import { optimizeBadcase, createBestPractice } from '../services/api';

const { Text, Title, Paragraph } = Typography;

export interface PreviewModalProps {
  open: boolean;
  onCancel: () => void;
  task?: any;
  url: string;
  type: 'image' | 'video';
  poster?: string;
  models: any[];
  onReuse: (task: any) => void;
  onRegenerate: (task: any) => void;
  images?: string[];
  initialIndex?: number;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  open,
  onCancel,
  task,
  url,
  type,
  poster,
  models,
  onReuse,
  onRegenerate,
  images,
  initialIndex = 0
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Optimize state
  const [isOptimizeModalVisible, setIsOptimizeModalVisible] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<any>(null);
  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [open, initialIndex]);

  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const onWheel = (e: WheelEvent) => {
        if (type === 'image') {
            e.preventDefault();
            e.stopPropagation();
            setZoom(prev => Math.max(0.1, Math.min(5, prev - e.deltaY * 0.001)));
        }
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [type]);

  const imageList = images || (task?.assets?.map((a: any) => a.url) || (task?.url ? [task.url] : []));
  const currentUrl = type === 'video' ? url : (imageList[currentIndex] || url);
  const showNav = imageList && imageList.length > 1;

  const handleNext = () => {
    if (imageList && currentIndex < imageList.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleNextWrapped = (e: React.MouseEvent) => {
      e.stopPropagation();
      handleNext();
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handlePrevWrapped = (e: React.MouseEvent) => {
      e.stopPropagation();
      handlePrev();
  };

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft') handlePrev();
        if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, currentIndex, imageList]);

  if (!open) return null;

  // Resolve model name
  const modelName = task ? models.find(m => m.id === task.model_id)?.name || task.model_id : '-';

  // Format time
  const formatTime = (ts?: number) => ts ? new Date(ts * 1000).toLocaleString() : '-';

  const handleAddToBestPractice = async () => {
      try {
          const payload = {
              name: task.prompt ? task.prompt.substring(0, 20) : `Task-${task.id.substring(0, 8)}`,
              url: currentUrl,
              category: ['role'],
              prompt: task.prompt,
              model_name: modelName
          };
          await createBestPractice(payload);
          message.success('已添加到优秀案例库');
      } catch (e: any) {
          message.error('添加失败: ' + e.message);
      }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = currentUrl;
    a.download = `${type}_${task?.id || Date.now()}_${currentIndex}.${type === 'video' ? 'mp4' : 'png'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSmartOptimize = async () => {
      setOptimizeResult(null);
      setIsOptimizeModalVisible(true);
      setOptimizing(true);
      
      try {
          const payload = {
              prompt: task?.prompt || '',
              image_url: currentUrl,
              reference_url: "" 
          };
          const res = await optimizeBadcase(payload);
          setOptimizeResult(res);
      } catch (e: any) {
          message.error('智能优化失败: ' + e.message);
          console.error(e);
      } finally {
          setOptimizing(false);
      }
  };

  return (
    <Modal
      open={open}
      footer={null}
      onCancel={onCancel}
      width="90%"
      style={{ top: 20, maxWidth: 1400 }}
      styles={{ 
        body: { padding: 0, display: 'flex', height: '85vh', background: '#1f1f22', border: '1px solid #333', overflow: 'hidden', borderRadius: 8 }
      }}
      closeIcon={null} // Custom close button
    >
      {/* Left: Media Preview */}
      <div 
           ref={containerRef}
           style={{ flex: 1, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}
           onMouseDown={(e) => {
               if (type === 'image' && zoom > 1) {
                   e.preventDefault(); // Prevent text selection
                   setIsDragging(true);
                   setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
               }
           }}
           onMouseMove={(e) => {
               if (isDragging && type === 'image') {
                   e.preventDefault();
                   setPosition({
                       x: e.clientX - startPos.x,
                       y: e.clientY - startPos.y
                   });
               }
           }}
           onMouseUp={() => setIsDragging(false)}
           onMouseLeave={() => setIsDragging(false)}
      >
        {type === 'video' ? (
          <CachedVideo 
            src={currentUrl} 
            cacheKey={`preview_${currentUrl}`} 
            controls 
            autoPlay 
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
            poster={poster} 
          />
        ) : (
          <div style={{ 
              transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`, 
              transition: isDragging ? 'none' : 'transform 0.1s',
              cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', height: '100%'
          }}>
            <CachedImage 
                src={currentUrl} 
                cacheKey={`preview_${currentUrl}`} 
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', pointerEvents: 'none' }} 
            />
          </div>
        )}
        
        {/* Navigation Arrows */}
        {showNav && (
            <>
                {currentIndex > 0 && (
                    <div 
                        onClick={handlePrevWrapped}
                        style={{
                            position: 'absolute',
                            left: 20,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'rgba(0,0,0,0.5)',
                            borderRadius: '50%',
                            width: 48,
                            height: 48,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#fff',
                            fontSize: 24,
                            backdropFilter: 'blur(4px)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            zIndex: 10
                        }}
                    >
                        <LeftOutlined />
                    </div>
                )}
                {imageList && currentIndex < imageList.length - 1 && (
                    <div 
                        onClick={handleNextWrapped}
                        style={{
                            position: 'absolute',
                            right: 20,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'rgba(0,0,0,0.5)',
                            borderRadius: '50%',
                            width: 48,
                            height: 48,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#fff',
                            fontSize: 24,
                            backdropFilter: 'blur(4px)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            zIndex: 10
                        }}
                    >
                        <RightOutlined />
                    </div>
                )}
                
                {/* Image Counter */}
                <div style={{
                    position: 'absolute',
                    bottom: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.6)',
                    padding: '4px 12px',
                    borderRadius: 16,
                    color: '#fff',
                    fontSize: 14,
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    {currentIndex + 1} / {imageList?.length}
                </div>
            </>
        )}
        
        {/* Floating Close Button for immersive feel */}
        <div 
          onClick={onCancel}
          style={{ 
            position: 'absolute', 
            top: 20, 
            right: 20, 
            background: 'rgba(0,0,0,0.5)', 
            borderRadius: '50%', 
            width: 40, 
            height: 40, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            cursor: 'pointer', 
            color: '#fff',
            fontSize: 20,
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.1)',
            zIndex: 20
          }}
        >
          <CloseOutlined />
        </div>
      </div>

      {/* Right: Sidebar Info */}
      {task && (
        <div style={{ width: 360, background: '#1f1f22', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
            <Title level={5} style={{ color: '#fff', marginBottom: 24 }}>任务详情</Title>
            
            {/* Prompt Section */}
            <div style={{ marginBottom: 24 }}>
              <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>提示词</Text>
              <Paragraph 
                copyable 
                style={{ 
                    color: '#ddd', 
                    background: '#2a2a2d', 
                    padding: 12, 
                    borderRadius: 6, 
                    fontSize: 14,
                    lineHeight: 1.6,
                    border: '1px solid #333'
                }}
              >
                {task.prompt || '无提示词'}
              </Paragraph>
            </div>

            {/* Info Grid */}
            <Descriptions column={1} size="small" labelStyle={{ color: '#888', width: 80 }} contentStyle={{ color: '#ccc' }}>
              <Descriptions.Item label="模型">{modelName}</Descriptions.Item>
              {task.resolution && <Descriptions.Item label="分辨率">{task.resolution}</Descriptions.Item>}
              {task.ratio && <Descriptions.Item label="比例">{task.ratio}</Descriptions.Item>}
              {task.duration && <Descriptions.Item label="时长">{task.duration}秒</Descriptions.Item>}
              <Descriptions.Item label="创建时间">{formatTime(task.created_at)}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={task.status === 'succeeded' ? 'success' : task.status === 'failed' ? 'error' : 'processing'}>
                  {task.status === 'succeeded' ? '完成' : task.status}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </div>

          {/* Bottom Actions */}
          <div style={{ padding: 24, borderTop: '1px solid #333', background: '#2a2a2d' }}>
             <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <Button 
                    block 
                    icon={<BulbOutlined />} 
                    onClick={handleSmartOptimize}
                    style={{ background: 'linear-gradient(90deg, #6253E1, #04BEFE)', border: 'none', color: '#fff', height: 40, fontSize: 16, fontWeight: 600 }}
                >
                    智能优化 (Badcase Agent)
                </Button>
                <Button 
                    type="primary" 
                    block 
                    icon={<DownloadOutlined />} 
                    onClick={handleDownload}
                    size="large"
                >
                    下载文件
                </Button>
                <Button 
                    block 
                    icon={<PlusOutlined />} 
                    onClick={handleAddToBestPractice}
                    size="large"
                    style={{ background: '#1f1f22', borderColor: '#444', color: '#ccc' }}
                >
                    添加到优秀案例库
                </Button>
                <div style={{ display: 'flex', gap: 12 }}>
                    <Button 
                        block 
                        icon={<EditOutlined />} 
                        onClick={() => { onReuse(task); onCancel(); }}
                        style={{ flex: 1, background: '#1f1f22', borderColor: '#444', color: '#ccc' }}
                    >
                        重新编辑
                    </Button>
                    <Button 
                        block 
                        icon={<ReloadOutlined />} 
                        onClick={() => { onRegenerate(task); }}
                        style={{ flex: 1, background: '#1f1f22', borderColor: '#444', color: '#ccc' }}
                    >
                        再次生成
                    </Button>
                </div>
             </Space>
          </div>
        </div>
      )}
      
      <Modal
          title="智能优化 (Badcase Analysis)"
          open={isOptimizeModalVisible}
          onCancel={() => setIsOptimizeModalVisible(false)}
          width={800}
          footer={null}
          zIndex={1001} // Higher than preview modal
      >
          {optimizing ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                  <Spin tip="AI 正在诊断与优化..." />
              </div>
          ) : optimizeResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <Card title="1. 失败诊断 (Diagnosis v2.0)" size="small">
                      {optimizeResult.overall_diagnosis ? (
                          <>
                              <div style={{ marginBottom: 12, fontWeight: 500, fontSize: 15, color: '#fff' }}>{optimizeResult.overall_diagnosis}</div>
                              {optimizeResult.style_inference && (
                                  <div style={{ marginBottom: 12, color: '#888', fontSize: 13 }}>
                                      风格推断: {optimizeResult.style_inference}
                                  </div>
                              )}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                  {optimizeResult.severity_scores?.map((item: any) => (
                                      <Tag key={item.tag} color={item.score >= 3 ? 'red' : item.score === 2 ? 'orange' : 'blue'}>
                                          {item.tag} (Score: {item.score})
                                      </Tag>
                                  ))}
                                  {(!optimizeResult.severity_scores && optimizeResult.badcase_tags) && 
                                      optimizeResult.badcase_tags.map((tag: string) => <Tag key={tag}>{tag}</Tag>)
                                  }
                              </div>
                          </>
                      ) : (
                          Object.entries(optimizeResult.diagnosis).map(([k, v]: any) => (
                              <div key={k} style={{ marginBottom: 10 }}>
                                  <strong>{k}:</strong>
                                  <ul>{Array.isArray(v) && v.map((msg: string, i: number) => <li key={i}>{msg}</li>)}</ul>
                              </div>
                          ))
                      )}
                  </Card>
                  <Card title="2. 修复策略 (Strategy)" size="small">
                       {optimizeResult.top_fixes ? (
                          <>
                              {optimizeResult.top_fixes.map((fix: any, i: number) => (
                                  <div key={i} style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                      <Tag color={fix.priority === 1 ? 'red' : 'gold'}>P{fix.priority}</Tag>
                                      <span style={{ lineHeight: '22px' }}>{fix.action}</span>
                                  </div>
                              ))}
                              {optimizeResult.edit_instructions && optimizeResult.edit_instructions.length > 0 && (
                                  <div style={{ marginTop: 16, borderTop: '1px dashed #444', paddingTop: 12 }}>
                                      <div style={{ fontWeight: 500, marginBottom: 8, color: '#ddd' }}>局部编辑指令 (Local Edits)</div>
                                      {optimizeResult.edit_instructions.map((inst: any, i: number) => (
                                          <div key={i} style={{ marginBottom: 8, fontSize: 13 }}>
                                              <span style={{ color: '#aaa' }}>[{inst.region}]:</span> {inst.instruction}
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </>
                       ) : (
                           Object.entries(optimizeResult.fix_strategy).map(([k, v]: any) => (
                              <div key={k} style={{ marginBottom: 10 }}>
                                  <strong>{k}:</strong>
                                  <ul>{Array.isArray(v) && v.map((msg: string, i: number) => <li key={i}>{msg}</li>)}</ul>
                              </div>
                          ))
                       )}
                  </Card>
                  <Card title="3. 优化指令 (Prompts)" size="small">
                      <div style={{ marginBottom: 8, fontWeight: 500, color: '#ccc' }}>Master Prompt (完整):</div>
                      <Input.TextArea 
                          value={optimizeResult.master_prompt || optimizeResult.optimized_prompt} 
                          autoSize={{ minRows: 3, maxRows: 6 }} 
                          readOnly 
                          style={{ marginBottom: 12, background: '#222', color: '#ddd', borderColor: '#444' }}
                      />
                      {optimizeResult.negative_prompt && (
                          <>
                              <div style={{ marginBottom: 8, fontWeight: 500, color: '#ccc' }}>Negative Prompt:</div>
                              <Input.TextArea 
                                  value={optimizeResult.negative_prompt} 
                                  autoSize={{ minRows: 2, maxRows: 4 }} 
                                  readOnly 
                                  style={{ marginBottom: 12, background: '#222', color: '#aaa', borderColor: '#444' }}
                              />
                          </>
                      )}
                      <div style={{ display: 'flex', gap: 12 }}>
                          <Button type="primary" block icon={<ReloadOutlined />} onClick={() => {
                              const fullPrompt = constructFullPrompt(optimizeResult);
                              const newTask = { ...task, prompt: fullPrompt };
                              onRegenerate(newTask);
                              setIsOptimizeModalVisible(false);
                          }}>直接生成</Button>
                          <Button block icon={<EditOutlined />} onClick={() => {
                              const fullPrompt = constructFullPrompt(optimizeResult);
                              const newTask = { ...task, prompt: fullPrompt };
                              onReuse(newTask);
                              setIsOptimizeModalVisible(false);
                              onCancel();
                          }}>应用并编辑</Button>
                          <Button icon={<CopyOutlined />} onClick={() => {
                              const fullPrompt = constructFullPrompt(optimizeResult);
                              navigator.clipboard.writeText(fullPrompt);
                              message.success('已复制');
                          }} />
                      </div>
                  </Card>
                  <Card title="4. 检查清单 (Checklist)" size="small">
                      {optimizeResult.checklist && optimizeResult.checklist.map((item: string, i: number) => (
                          <div key={i}><Checkbox>{item}</Checkbox></div>
                      ))}
                  </Card>
              </div>
          ) : (
              <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>{optimizing ? '' : '无法获取结果'}</div>
          )}
      </Modal>
    </Modal>
  );
};

function constructFullPrompt(res: any) {
    if (!res) return '';
    let text = res.master_prompt || res.optimized_prompt || '';
    
    const fixes = [];
    if (res.top_fixes) fixes.push(...res.top_fixes.map((f:any) => f.action));
    if (res.edit_instructions) fixes.push(...res.edit_instructions.map((i:any) => `${i.region}: ${i.instruction}`));
    
    if (fixes.length > 0) {
        text += '\n\n' + fixes.join(', ');
    }
    
    if (res.negative_prompt) {
        text += '\n\nNegative Prompt: ' + res.negative_prompt;
    }
    
    return text;
}
