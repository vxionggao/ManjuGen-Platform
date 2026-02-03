import React, { useState, useEffect } from 'react';
import { Card, Typography, Radio, Space, Button, Tag, Avatar, Divider, Steps, Modal, Tooltip, message, Spin, Image, Badge, Empty } from 'antd';
import { UserOutlined, PictureOutlined, VideoCameraOutlined, CheckCircleOutlined, LoadingOutlined, PlusOutlined, ReloadOutlined, VideoCameraAddOutlined, FileTextOutlined, HomeOutlined } from '@ant-design/icons';
import { MaterialLibrary } from './MaterialLibrary';
import { CachedImage, CachedVideo } from './CachedAsset';
import { createTask, listTasks, listModels, createProject, updateProject } from '../services/api';
import { AssetCache } from '../services/cache';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

export function StoryWorkspace({ prompt, onMessage, onBack }: { prompt: string, onMessage?: (msg: string) => void, onBack?: () => void }) {
    const navigate = useNavigate();

    // Persistence Helper
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

    const [style, setStyle] = useSessionState('ws_style', 'anime');
    const [ratio, setRatio] = useSessionState('ws_ratio', '16:9');
    const [loading, setLoading] = useState(false);
    const [storyData, setStoryData] = useSessionState<any>('ws_storyData', null);
    const [currentStep, setCurrentStep] = useSessionState('ws_currentStep', 0); // 0: Config, 1: Storyboard, 2: Video
    
    // Character State
    const [characters, setCharacters] = useSessionState<any[]>('ws_characters', []);
    const [isAssetModalVisible, setIsAssetModalVisible] = useState(false);
    const [selectedRoleIndex, setSelectedRoleIndex] = useState<number | null>(null);
    const [modalType, setModalType] = useState<'role' | 'style'>('role');

    // Storyboard Gen State
    const [tasks, setTasks] = useSessionState<any[]>('ws_tasks', []);
    const [generating, setGenerating] = useState(false);
    const [models, setModels] = useState<any[]>([]);

    // Video Gen State
    const [videoTasks, setVideoTasks] = useSessionState<any[]>('ws_videoTasks', []);
    const [videoGenerating, setVideoGenerating] = useState(false);
    const [videoModels, setVideoModels] = useState<any[]>([]);

    // Stitch State
    const [stitchTaskId, setStitchTaskId] = useSessionState('ws_stitchTaskId', '');
    const [stitchResult, setStitchResult] = useSessionState('ws_stitchResult', '');
    const [stitching, setStitching] = useState(false);
    const [projectId, setProjectId] = useSessionState('ws_projectId', '');

    const [availableStyles, setAvailableStyles] = useState([
        { id: 'anime', name: '日系赛璐璐', color: '#6E56CF', asset: null as any },
        { id: 'real', name: '写实电影感', color: '#04BEFE', asset: null as any },
        { id: '3d', name: '3D 动画', color: '#FF0080', asset: null as any },
        { id: 'ink', name: '水墨国风', color: '#FFCC00', asset: null as any },
    ]);

    useEffect(() => {
        if (prompt && !storyData) {
            generateStory();
        }
        // Load Models
        listModels().then(ms => {
             const imgModels = ms.filter((m: any) => m.type === 'image');
             setModels(imgModels);
             const vidModels = ms.filter((m: any) => m.type === 'video');
             setVideoModels(vidModels);
        }).catch(console.error);
    }, [prompt]);

    // Polling for tasks (Image)
    useEffect(() => {
        let interval: any;
        if (currentStep === 1 && tasks.length > 0 && tasks.some(t => t.status !== 'succeeded' && t.status !== 'failed')) {
            interval = setInterval(async () => {
                try {
                    const allTasks = await listTasks();
                    setTasks(prev => prev.map(p => {
                        const updated = allTasks.find((t: any) => t.id === p.id);
                        return updated || p;
                    }));
                } catch (e) { console.error(e) }
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [currentStep, tasks]);

    // Polling for tasks (Video)
    useEffect(() => {
        let interval: any;
        const hasRunning = videoTasks.some(t => t && t.status !== 'succeeded' && t.status !== 'failed');
        if (currentStep === 2 && hasRunning) {
            interval = setInterval(async () => {
                try {
                    const allTasks = await listTasks();
                    setVideoTasks(prev => prev.map(p => {
                        if (!p) return null;
                        const updated = allTasks.find((t: any) => t.id === p.id);
                        return updated || p;
                    }));
                } catch (e) { console.error(e) }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [currentStep, videoTasks]);

    // Polling for Stitch
    useEffect(() => {
        let interval: any;
        if (stitchTaskId && !stitchResult) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/video/stitch/${stitchTaskId}`);
                    const data = await res.json();
                    if (data.status === 'succeeded') {
                        setStitchResult(data.result_url);
                        setStitching(false);
                        setStitchTaskId('');
                        message.success('成片合成完成！');
                        onMessage?.('漫剧成片已生成！您可以直接下载 MP4 或重新调整分镜。');
                    } else if (data.status === 'failed') {
                        setStitching(false);
                        setStitchTaskId('');
                        message.error('合成失败');
                    }
                } catch (e) {}
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [stitchTaskId, stitchResult]);

    const generateStory = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/story/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            const data = await res.json();
            setStoryData(data);
            
            if (data.characters) {
                const newChars = data.characters.map((c: any, i: number) => ({
                    id: i, name: c.name, desc: c.desc, asset: null
                }));
                setCharacters(newChars);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleClick = (index: number) => {
        setModalType('role');
        setSelectedRoleIndex(index);
        setIsAssetModalVisible(true);
    };

    const handleStyleAdd = () => {
        setModalType('style');
        setIsAssetModalVisible(true);
    };

    const handleAssetSelect = (asset: any) => {
        if (modalType === 'role' && selectedRoleIndex !== null) {
            setCharacters(prev => {
                const newChars = [...prev];
                newChars[selectedRoleIndex] = { 
                    ...newChars[selectedRoleIndex], 
                    asset: asset
                };
                return newChars;
            });
            setIsAssetModalVisible(false);
        } else if (modalType === 'style') {
            const newStyleId = `asset_${asset.asset_id || asset.id}`;
            if (!availableStyles.find(s => s.id === newStyleId)) {
                setAvailableStyles(prev => [...prev, {
                    id: newStyleId,
                    name: asset.name,
                    color: '#333',
                    asset: asset
                }]);
            }
            setStyle(newStyleId);
            setIsAssetModalVisible(false);
        }
    };

    const handleAddCharacter = () => {
        const newIdx = characters.length;
        setCharacters(prev => [...prev, { id: Date.now(), name: '新角色', desc: '未设定', asset: null }]);
        handleRoleClick(newIdx);
    };

    const generateStoryboardTasks = async () => {
        if (models.length === 0) {
            message.error('未找到可用生图模型');
            return;
        }
        setGenerating(true);

        // 1. Call Storyboard Agent
        message.loading('Storyboard Agent 正在优化分镜构图...', 1.5);
        onMessage?.('Storyboard Agent 正在分析剧本，优化分镜的构图与光影...');
        
        let refinedScenes = storyData.scenes;
        try {
            const res = await fetch('/api/story/refine_prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenes: storyData.scenes })
            });
            if (res.ok) {
                refinedScenes = await res.json();
                message.success('分镜优化完成');
            }
        } catch (e) {
            console.error('Refine failed', e);
        }

        try {
            message.loading('正在批量提交分镜任务...', 1);
            const modelId = models[0].id; 
            
            const ps = refinedScenes.map((scene: any) => {
                const payload: any = {
                    type: 'image',
                    model_id: modelId,
                    prompt: scene.prompt,
                };
                if (ratio === '16:9') payload.size = '2560x1440';
                else if (ratio === '9:16') payload.size = '1440x2560';
                else if (ratio === '1:1') payload.size = '2048x2048';
                
                return createTask(payload);
            });
            
            const newTasks = await Promise.all(ps);
            setTasks(newTasks);
            message.success(`成功提交 ${newTasks.length} 个任务`);
            onMessage?.(`已为您创建 ${newTasks.length} 个分镜生成任务，正在绘制中...`);
        } catch (e) {
            console.error(e);
            message.error('提交失败');
        } finally {
            setGenerating(false);
        }
    };

    const generateVideoTasks = async () => {
        if (videoModels.length === 0) {
            message.error('未找到可用视频模型');
            return;
        }
        
        if (!storyData?.scenes) return;

        setVideoGenerating(true);
        
        // 1. Call Agent for Plan
        let videoPlan: any[] = [];
        try {
            message.loading('智能体正在分析分镜动态...', 1);
            const scenesForPlan = storyData.scenes.map((s: any) => ({
                id: s.id || 0,
                desc: s.desc || s.prompt,
                prompt: s.prompt
            }));
            
            const res = await fetch('/api/story/video_plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenes: scenesForPlan })
            });
            if (res.ok) {
                videoPlan = await res.json();
            }
        } catch (e) {
            console.error('Agent plan failed, using defaults');
        }

        message.loading(`正在提交视频生成任务...`, 2);
        onMessage?.('开始为您合成视频，智能体正在规划最佳运镜参数...');

        try {
            const modelId = videoModels[0].id;
            
            // Map ALL scenes
            const ps = storyData.scenes.map(async (scene: any, i: number) => {
                const sbTask = tasks[i];
                if (!sbTask || sbTask.status !== 'succeeded' || !sbTask.result_urls?.[0]) {
                    return null;
                }

                const plan = videoPlan[i] || {};
                
                let finalPrompt = sbTask.prompt;
                if (plan.camera_movement && plan.camera_movement !== 'static') {
                    finalPrompt += `, ${plan.camera_movement.replace('_', ' ')} camera movement`;
                }
                if (plan.motion_strength && plan.motion_strength > 6) {
                    finalPrompt += `, dynamic motion`;
                }

                const imgUrl = sbTask.result_urls[0];
                let b64 = '';
                try {
                    const response = await fetch(imgUrl);
                    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
                    const blob = await response.blob();
                    b64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    console.error('Failed to load image:', imgUrl, e);
                    b64 = imgUrl;
                }
                
                if (!b64) return null;

                const payload = {
                    type: 'video',
                    model_id: modelId,
                    prompt: finalPrompt,
                    images: [b64],
                    params: {
                        resolution: '1280x720', 
                        duration: plan.duration || 5,
                        generate_audio: true
                    }
                };
                return createTask(payload);
            });

            const newTasks = await Promise.all(ps);
            
            const validCount = newTasks.filter(Boolean).length;
            if (validCount === 0) {
                 message.warning('没有可生成的视频任务 (分镜可能未完成)');
            } else {
                 setVideoTasks(newTasks);
                 message.success(`已提交 ${validCount} 个视频任务`);
                 onMessage?.(`视频任务已提交，${validCount} 个镜头正在同步渲染。`);
            }
        } catch (e) {
            console.error(e);
            message.error('视频生成提交失败');
        } finally {
            setVideoGenerating(false);
        }
    }

    const handleRedraw = async (task: any, index: number) => {
        console.log('handleRedraw called for task:', task, 'index:', index);
        
        if (!task) {
            console.error('Task is undefined');
            message.error('重绘失败：任务数据丢失');
            return;
        }

        const hide = message.loading('Badcase Agent 正在诊断画面...', 0);
        
        try {
            let newPrompt = task.prompt;
            let diagnosisMsg = '';

            if (task.result_urls?.[0]) {
                console.log('Calling Badcase Agent with:', task.result_urls[0]);
                try {
                    const res = await fetch('/api/badcase/optimize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt: task.prompt,
                            image_url: task.result_urls[0]
                        })
                    });
                    
                    if (res.ok) {
                        const optimization = await res.json();
                        console.log('Agent Optimization Result:', optimization);
                        newPrompt = optimization.optimized_prompt || task.prompt;
                        if (optimization.diagnosis?.tags) {
                            diagnosisMsg = `诊断问题: ${optimization.diagnosis.tags.join(', ')}`;
                        }
                    } else {
                         console.error('Agent API Error:', res.status, await res.text());
                    }
                } catch (e) {
                    console.error('Agent optimization failed', e);
                }
            } else {
                console.log('No result_urls found for task, skipping optimization');
            }

            hide(); 
            if (diagnosisMsg) message.info(diagnosisMsg);
            message.loading('正在根据优化策略重绘...', 1);
            
            let modelId = task.model_id;
            if (!modelId) {
                console.warn('Task model_id missing, trying fallback');
                if (models.length > 0) modelId = models[0].id;
                else modelId = 1;
            }
            console.log('Using Model ID:', modelId);
            
            const newTask = await createTask({
                type: 'image',
                model_id: modelId,
                prompt: newPrompt,
                size: '2560x1440'
            });
            console.log('New Task Created:', newTask);
            
            message.success('重绘任务已提交');
            
            // Update the specific scene with new task
            setTasks(prev => {
                const next = [...prev];
                next[index] = newTask;
                return next;
            });
            
        } catch (e) {
            hide();
            console.error('handleRedraw execution error:', e);
            message.error('重绘提交失败');
        }
    };

    const handleStitch = async () => {
        const urls = videoTasks.map(t => t?.video_url).filter(Boolean);
        if (urls.length === 0) return message.error('没有可用的视频片段');
        
        setStitching(true);
        const hideLoading = message.loading('正在上传素材进行拼接...', 0);
        
        try {
            // Client-side fetch to bypass backend network restrictions
            const base64List = await Promise.all(urls.map(async (url: string) => {
                try {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    return new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    console.error('Failed to fetch video blob:', url, e);
                    return null;
                }
            }));
            
            const validBase64 = base64List.filter(Boolean);
            
            if (validBase64.length === 0) {
                console.warn('Frontend fetch failed (CORS?), falling back to backend');
                message.info('检测到网络限制，正在切换至服务器缓存模式...');
            }

            const res = await fetch('/api/video/stitch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    video_urls: urls,
                    video_base64: validBase64 
                })
            });
            
            hideLoading();
            const data = await res.json();
            setStitchTaskId(data.task_id);
            message.loading('Editor Agent 正在剪辑成片...', 2);
            onMessage?.('Editor Agent 正在审阅素材，规划最佳剪辑节奏与转场...');
        } catch (e) {
            hideLoading();
            console.error(e);
            setStitching(false);
            message.error('请求失败');
        }
    }

    const handleVideoOptimize = async (task: any, index: number) => {
        if (!task) return;
        
        message.loading('智能体正在分析动态不足之处...', 1.5);
        
        // Simulate analysis delay
        setTimeout(async () => {
             message.loading('正在重新生成视频...', 1);
             try {
                 const modelId = videoModels[0]?.id || 1;
                 
                 // Retrieve original image from storyboard task
                 const sbTask = tasks[index];
                 const inputImage = sbTask?.result_urls?.[0];
                 
                 if (!inputImage) {
                     return message.error('无法获取原图');
                 }

                 let b64 = '';
                 try {
                     const res = await fetch(inputImage);
                     const blob = await res.blob();
                     b64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                 } catch (e) {
                     console.error(e);
                     return message.error('图片加载失败');
                 }
                 
                 const newTask = await createTask({
                    type: 'video',
                    model_id: modelId,
                    prompt: task.prompt + ", high quality, smooth motion", 
                    images: [b64],
                    params: { resolution: '1280x720', duration: 5, generate_audio: true }
                 });
                 
                 setVideoTasks(prev => {
                     const next = [...prev];
                     next[index] = newTask;
                     return next;
                 });
                 message.success('视频优化任务已提交');
                 
             } catch (e) {
                 console.error(e);
                 message.error('提交失败');
             }
        }, 1500);
    }

    const handleSave = async () => {
        const hide = message.loading('正在保存项目...', 0);
        try {
            const title = storyData?.title || prompt.substring(0, 15);
            // Find first valid image as cover
            let cover = 'https://images.unsplash.com/photo-1618042164219-62c820f10723?w=600&auto=format&fit=crop&q=60';
            const validTask = tasks.find(t => t.status === 'succeeded' && t.result_urls?.[0]);
            if (validTask) {
                cover = validTask.result_urls[0];
            }

            const data = {
                prompt,
                style,
                ratio,
                storyData,
                currentStep,
                characters,
                tasks,
                videoTasks,
                stitchTaskId,
                stitchResult
            };

            let res;
            if (projectId) {
                res = await updateProject(projectId, { title, cover_image: cover, data });
                message.success('项目更新成功');
            } else {
                res = await createProject({ title, cover_image: cover, data });
                setProjectId(res.id);
                message.success('项目保存成功');
            }
        } catch (e) {
            console.error(e);
            message.error('保存失败');
        } finally {
            hide();
        }
    };

    const handleBack = () => {
        // Clear session storage for workspace
        ['ws_style', 'ws_ratio', 'ws_storyData', 'ws_currentStep', 'ws_characters', 'ws_tasks', 'ws_videoTasks', 'ws_stitchTaskId', 'ws_stitchResult', 'ws_projectId'].forEach(k => sessionStorage.removeItem(k));
        onBack?.();
    };

    const handleNextStep = async () => {
        if (currentStep === 0) {
            if (!storyData?.scenes || storyData.scenes.length === 0) {
                return Modal.warning({ title: '请先等待分镜生成完毕' });
            }
            setCurrentStep(1);
            generateStoryboardTasks();
        } else if (currentStep === 1) {
            setCurrentStep(2);
        } else if (currentStep === 2) {
            setCurrentStep(3);
        }
    };

    return (
        <div style={{ padding: 24, height: '100%', overflowY: 'auto', background: '#161618' }}>
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <Title level={3} style={{ color: '#fff', margin: 0 }}>项目工作台</Title>
                    <Space>
                        <Button ghost>导出剧本</Button>
                        <Button icon={<HomeOutlined />} onClick={handleBack} style={{ backgroundColor: 'rgba(110, 86, 207, 0.1)', borderColor: '#6E56CF', color: '#6E56CF' }}>返回首页</Button>
                        <Button type="primary" onClick={handleSave}>保存项目</Button>
                    </Space>
                </div>

                <div style={{ marginBottom: 32 }}>
                    <Steps 
                        current={currentStep === 0 ? 1 : currentStep === 1 ? 2 : currentStep === 2 ? 3 : 4} 
                        items={[
                            { title: '剧本设定', icon: loading ? <LoadingOutlined /> : <FileTextOutlined /> },
                            { title: '角色设计', icon: <UserOutlined /> },
                            { title: '分镜生成', icon: <PictureOutlined /> },
                            { title: '视频合成', icon: <VideoCameraOutlined /> },
                            { title: '最终成片', icon: <VideoCameraAddOutlined /> },
                        ]} 
                    />
                </div>

                {/* STEP 0: Configuration */}
                {currentStep === 0 && (
                    <Space direction="vertical" size={24} style={{ width: '100%' }}>
                        {/* 1. Script Generation */}
                        <Card title="1. 剧本大纲 (Script Analysis)" size="small" style={{ background: '#2a2a2d', borderColor: '#333' }}>
                            <div style={{ padding: 8 }}>
                                {loading ? (
                                    <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                                        <LoadingOutlined style={{ fontSize: 24, marginBottom: 12 }} />
                                        <div>正在生成剧本和分镜...</div>
                                    </div>
                                ) : (
                                    <>
                                        <Paragraph style={{ color: '#ccc', fontSize: 16, lineHeight: 1.8 }}>
                                            <Text strong style={{ color: '#fff', fontSize: 18 }}>《{storyData?.title || prompt.substring(0, 10)}》</Text>
                                            <br/><br/>
                                            <span style={{ color: '#aaa', whiteSpace: 'pre-wrap' }}>
                                                {storyData?.script || prompt}
                                            </span>
                                        </Paragraph>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                            <Tag color="purple">科幻</Tag>
                                            <Tag color="blue">冒险</Tag>
                                            <Tag color="cyan">赛博朋克</Tag>
                                            <Tag color="magenta">大女主</Tag>
                                        </div>
                                    </>
                                )}
                            </div>
                        </Card>

                        {/* 2. Character Extraction */}
                        <Card title="2. 角色提取 (Extracted Characters)" size="small" style={{ background: '#2a2a2d', borderColor: '#333' }}>
                            <div style={{ display: 'flex', gap: 24, padding: 8, overflowX: 'auto' }}>
                                {characters.map((char, index) => (
                                    <Tooltip title="点击绑定导演素材库角色" key={char.id}>
                                        <div style={{ textAlign: 'center', cursor: 'pointer', minWidth: 100 }} onClick={() => handleRoleClick(index)}>
                                            <div style={{ width: 80, height: 80, borderRadius: '50%', background: char.asset ? 'transparent' : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', border: '2px solid #444', overflow: 'hidden', position: 'relative' }}>
                                                {char.asset ? (
                                                    <CachedImage src={char.asset.cover_image || char.asset.url} cacheKey={`char_asset_${char.asset.asset_id || char.asset.id}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <UserOutlined style={{ fontSize: 32, color: '#666' }} />
                                                )}
                                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, padding: '2px 0', opacity: char.asset ? 0 : 1 }} className="hover-label">
                                                    {char.asset ? '更换' : '选择'}
                                                </div>
                                            </div>
                                            <div style={{ marginTop: 12, color: '#fff', fontWeight: 600 }}>{char.asset ? char.asset.name : char.name}</div>
                                            <div style={{ fontSize: 12, color: '#888' }}>{char.desc}</div>
                                        </div>
                                    </Tooltip>
                                ))}
                                <div 
                                    onClick={handleAddCharacter}
                                    style={{ width: 80, height: 80, borderRadius: '50%', border: '1px dashed #444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, margin: '0 auto' }}
                                >
                                    <PlusOutlined style={{ fontSize: 24, color: '#666' }} />
                                </div>
                            </div>
                        </Card>

                        {/* 3. Visual Style */}
                        <Card title="3. 视觉风格 (Visual Style)" size="small" style={{ background: '#2a2a2d', borderColor: '#333' }}>
                            <div style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: 8 }}>
                                {availableStyles.map(s => (
                                    <div 
                                        key={s.id} 
                                        onClick={() => setStyle(s.id)}
                                        style={{ 
                                            cursor: 'pointer', 
                                            border: style === s.id ? '2px solid #6E56CF' : '2px solid transparent', 
                                            borderRadius: 8, 
                                            overflow: 'hidden',
                                            position: 'relative',
                                            width: 140,
                                            flexShrink: 0
                                        }}
                                    >
                                        <div style={{ width: '100%', height: 100, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {s.asset ? (
                                                <CachedImage src={s.asset.cover_image || s.asset.url} cacheKey={`style_asset_${s.id}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <PictureOutlined style={{ fontSize: 32, color: 'rgba(255,255,255,0.5)' }} />
                                            )}
                                        </div>
                                        <div style={{ 
                                            background: '#333', color: '#fff', 
                                            textAlign: 'center', padding: '8px 0', fontSize: 14 
                                        }}>
                                            {s.name}
                                        </div>
                                        {style === s.id && (
                                            <div style={{ position: 'absolute', top: 4, right: 4, color: '#fff' }}>
                                                <CheckCircleOutlined />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div 
                                    onClick={handleStyleAdd}
                                    style={{ 
                                        width: 140, height: 130, flexShrink: 0, 
                                        border: '1px dashed #444', borderRadius: 8,
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <PlusOutlined style={{ fontSize: 24, color: '#666', marginBottom: 8 }} />
                                    <span style={{ color: '#666' }}>从素材库选择</span>
                                </div>
                            </div>
                        </Card>

                        {/* 3.5 Storyboard Prompts */}
                        {storyData?.scenes && (
                             <Card title="4. 分镜提示词 (Storyboard Prompts)" size="small" style={{ background: '#2a2a2d', borderColor: '#333' }}>
                                 <div style={{ padding: 8 }}>
                                     {storyData.scenes.map((scene: any) => (
                                         <div key={scene.id} style={{ marginBottom: 16, background: '#1f1f22', padding: 12, borderRadius: 8, border: '1px solid #333' }}>
                                             <div style={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}>Scene {scene.id}: {scene.desc}</div>
                                             <div style={{ color: '#888', fontSize: 13, fontFamily: 'monospace', background: '#111', padding: 8, borderRadius: 4 }}>{scene.prompt}</div>
                                         </div>
                                     ))}
                                 </div>
                             </Card>
                        )}

                        {/* 4. Ratio */}
                        <Card title="5. 画幅比例 (Aspect Ratio)" size="small" style={{ background: '#2a2a2d', borderColor: '#333' }}>
                            <div style={{ padding: 8 }}>
                                <Radio.Group value={ratio} onChange={e => setRatio(e.target.value)} buttonStyle="solid" size="large">
                                    <Radio.Button value="16:9">横屏 16:9</Radio.Button>
                                    <Radio.Button value="9:16">竖屏 9:16</Radio.Button>
                                    <Radio.Button value="1:1">方形 1:1</Radio.Button>
                                    <Radio.Button value="2.35:1">电影 2.35:1</Radio.Button>
                                </Radio.Group>
                            </div>
                        </Card>
                    </Space>
                )}

                {/* STEP 1: Storyboard Generation */}
                {currentStep === 1 && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <div style={{ color: '#fff', fontSize: 18 }}>分镜生成中 ({tasks.filter(t => t.status === 'succeeded').length}/{tasks.length})</div>
                            <Button icon={<ReloadOutlined />} onClick={generateStoryboardTasks}>重新生成全部</Button>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
                            {tasks.map((task, i) => (
                                <Card 
                                    key={task.id || i}
                                    style={{ background: '#2a2a2d', border: '1px solid #333' }}
                                    styles={{ body: { padding: 0 } }}
                                >
                                    <div style={{ padding: 12, borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
                                        <div style={{ fontWeight: 600, color: '#fff' }}>Scene {i+1}: {storyData?.scenes[i]?.desc}</div>
                                        <Tag color={task.status === 'succeeded' ? 'success' : 'processing'}>{task.status}</Tag>
                                    </div>
                                    <div style={{ width: '100%', aspectRatio: '16/9', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {task.status === 'succeeded' && task.result_urls ? (
                                            <CachedImage src={task.result_urls[0]} cacheKey={`task_${task.id}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                        ) : (
                                            <Spin size="large" tip="Generating..." />
                                        )}
                                    </div>
                                    <div style={{ padding: 12 }}>
                                        <Paragraph ellipsis={{ rows: 2 }} style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
                                            {task.prompt}
                                        </Paragraph>
                                        <Space>
                                            <Button size="small" icon={<ReloadOutlined />} onClick={() => handleRedraw(task, i)}>重绘</Button>
                                            <Button size="small" type="primary" ghost icon={<VideoCameraAddOutlined />} onClick={() => handleNextStep()}>转视频</Button>
                                        </Space>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* STEP 2: Video Synthesis */}
                {currentStep === 2 && (
                    <div>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <div style={{ color: '#fff', fontSize: 18 }}>视频合成中 ({videoTasks.filter(t => t.status === 'succeeded').length}/{videoTasks.length})</div>
                            <Space>
                                <Button onClick={() => setCurrentStep(1)}>返回分镜</Button>
                                <Button type="primary" icon={<VideoCameraOutlined />} onClick={generateVideoTasks} loading={videoGenerating}>
                                    开始生成视频 ({tasks.filter(t => t.status === 'succeeded').length} scenes)
                                </Button>
                            </Space>
                        </div>

                        {videoTasks.length === 0 ? (
                            <Empty description={<span style={{ color: '#666' }}>暂无视频任务，请点击“开始生成”</span>} />
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
                                {videoTasks.map((task, i) => (
                                    <Card 
                                        key={task.id || i}
                                        style={{ background: '#2a2a2d', border: '1px solid #333' }}
                                        styles={{ body: { padding: 0 } }}
                                    >
                                        <div style={{ padding: 12, borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
                                            <div style={{ fontWeight: 600, color: '#fff' }}>Scene {i+1}</div>
                                            <Tag color={task.status === 'succeeded' ? 'success' : 'processing'}>{task.status}</Tag>
                                        </div>
                                        <div style={{ width: '100%', aspectRatio: '16/9', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {task.status === 'succeeded' && task.video_url ? (
                                                <CachedVideo src={task.video_url} cacheKey={`vid_${task.id}`} controls style={{ width: '100%', height: '100%' }} />
                                            ) : (
                                                <Spin size="large" tip="Animating..." />
                                            )}
                                        </div>
                                        <div style={{ padding: 12 }}>
                                            <Paragraph ellipsis={{ rows: 2 }} style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
                                                {task.prompt}
                                            </Paragraph>
                                            <Button size="small" icon={<ReloadOutlined />} onClick={() => handleVideoOptimize(task, i)}>重新优化</Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 3: Final Video */}
                {currentStep === 3 && (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                        <div style={{ marginBottom: 24 }}>
                            <Title level={4} style={{ color: '#fff' }}>最终成片 (Final Cut)</Title>
                            <Paragraph style={{ color: '#888' }}>
                                将所有生成的视频片段拼接成完整的漫剧。
                            </Paragraph>
                        </div>
                        
                        {stitchResult ? (
                            <div style={{ maxWidth: 800, margin: '0 auto' }}>
                                <video 
                                    controls 
                                    src={stitchResult} 
                                    style={{ width: '100%', borderRadius: 8, background: '#000' }} 
                                    playsInline
                                    preload="metadata"
                                    crossOrigin="anonymous"
                                />
                                <div style={{ marginTop: 24 }}>
                                    <Button type="primary" size="large" href={stitchResult} download="manga_video.mp4">
                                        下载成片
                                    </Button>
                                    <Button style={{ marginLeft: 16 }} onClick={() => setStitchResult('')}>重新合成</Button>
                                    <Button style={{ marginLeft: 16 }} onClick={() => setCurrentStep(2)}>返回视频合成</Button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: 40, background: '#2a2a2d', borderRadius: 12 }}>
                                {stitching ? (
                                    <div style={{ padding: 40 }}>
                                        <Spin size="large" tip="正在拼接视频片段..." />
                                    </div>
                                ) : (
                                    <Button type="primary" size="large" icon={<VideoCameraAddOutlined />} onClick={handleStitch}>
                                        开始合成成片 ({videoTasks.filter(t => t?.video_url).length} clips)
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Action Button */}
                {currentStep < 3 && (
                    <Button 
                        type="primary" 
                        block 
                        size="large" 
                        style={{ height: 56, fontSize: 18, marginTop: 32, fontWeight: 600 }}
                        onClick={handleNextStep}
                    >
                        {currentStep === 0 ? '确认设定并生成分镜 (Storyboard)' : currentStep === 2 ? '下一步：最终成片' : '下一步：视频合成'}
                    </Button>
                )}
            </div>

            {/* Asset Selection Modal */}
            <Modal
                title={modalType === 'role' ? "选择角色资产 (从导演素材库)" : "选择风格资产 (从导演素材库)"}
                open={isAssetModalVisible}
                onCancel={() => setIsAssetModalVisible(false)}
                footer={null}
                width={900}
                bodyStyle={{ padding: 0, height: 600, overflow: 'hidden' }}
                destroyOnClose
            >
                <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <MaterialLibrary onAssetSelect={handleAssetSelect} type={modalType} />
                </div>
            </Modal>
        </div>
    );
}
