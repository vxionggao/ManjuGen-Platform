import React, { useEffect, useState, useRef } from 'react'
import { createTask, listTasks, listModels } from '../services/api'
import { connect } from '../services/ws'
import { Layout, Select, Input, Button, Upload, Card, Tag, Typography, App as AntdApp, Row, Col, Empty, Spin, Space, Switch, Checkbox, Tooltip, Modal } from 'antd'
import { InboxOutlined, PlayCircleOutlined, DownloadOutlined, CopyOutlined, ClockCircleOutlined, PlusOutlined } from '@ant-design/icons'

const { Sider, Content } = Layout
const { TextArea } = Input
const { Dragger } = Upload

import { CachedImage, CachedVideo } from '../components/CachedAsset'
import { AssetCache } from '../services/cache'
import { PreviewModal } from '../components/PreviewModal'

export default function MotionStudio() {
  const { message } = AntdApp.useApp()
  const isComposing = useRef(false)
  const [prompt, setPrompt] = useState(localStorage.getItem('motion_prompt') || '')
  
  // State for First and Last frames
  const [firstFrame, setFirstFrame] = useState<string | null>(() => {
    try {
        const parsed = JSON.parse(localStorage.getItem('motion_images') || '[]')
        return Array.isArray(parsed) && parsed[0] ? parsed[0] : null
    } catch { return null }
  })
  const [lastFrame, setLastFrame] = useState<string | null>(() => {
    try {
        const parsed = JSON.parse(localStorage.getItem('motion_images') || '[]')
        return Array.isArray(parsed) && parsed[1] ? parsed[1] : null
    } catch { return null }
  })

  const [count, setCount] = useState<number>(() => {
    return Number(localStorage.getItem('motion_count')) || 1
  })
  
  const [resolution, setResolution] = useState(localStorage.getItem('motion_resolution') || '1280x720')
  const [ratio, setRatio] = useState(localStorage.getItem('motion_ratio') || '16:9')
  const [duration, setDuration] = useState(Number(localStorage.getItem('motion_duration')) || 5)
  const [audio, setAudio] = useState(localStorage.getItem('motion_audio') === 'true')
  const [modelId, setModelId] = useState<number | null>(() => {
    const saved = localStorage.getItem('motion_model')
    const num = Number(saved)
    return (saved && !isNaN(num)) ? num : null
  })
  const [tasks, setTasks] = useState<any[]>([])
  const [models, setModels] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<{ visible: boolean, task?: any, url: string, type: 'image' | 'video', poster?: string, images?: string[], initialIndex?: number }>({ visible: false, url: '', type: 'image' })

  const handleResolutionChange = (val: string) => {
    setResolution(val)
    // Update ratio based on resolution
    const map: Record<string, string> = {
        '1280x720': '16:9',
        '1920x1080': '16:9',
        '720x1280': '9:16',
        '1080x1920': '9:16',
        '1024x1024': '1:1',
        '960x720': '4:3',
        '720x960': '3:4',
        '1280x534': '2.4:1'
    }
    if (map[val]) setRatio(map[val])
  }

  // Derive CSS aspect ratio from resolution for accurate preview
  const cssRatio = resolution.replace('x', '/')

  useEffect(() => { localStorage.setItem('motion_prompt', prompt) }, [prompt])
  useEffect(() => { localStorage.setItem('motion_resolution', resolution) }, [resolution])
  useEffect(() => { localStorage.setItem('motion_ratio', ratio) }, [ratio])
  useEffect(() => { localStorage.setItem('motion_duration', String(duration)) }, [duration])
  useEffect(() => { localStorage.setItem('motion_audio', String(audio)) }, [audio])
  useEffect(() => { localStorage.setItem('motion_count', String(count)) }, [count])
  useEffect(() => { if (modelId) localStorage.setItem('motion_model', String(modelId)) }, [modelId])
  useEffect(() => { 
    try { 
        const imgs = []
        if (firstFrame) imgs.push(firstFrame)
        if (lastFrame) imgs.push(lastFrame)
        localStorage.setItem('motion_images', JSON.stringify(imgs)) 
    } catch (e) { console.error('Image storage failed', e) } 
  }, [firstFrame, lastFrame])

  useEffect(()=>{ 
    listModels(true).then(ms => { // Force refresh to get latest validation rules
        const videoModels = ms.filter((m: any) => m.type === 'video')
        setModels(videoModels)
        if (!modelId && videoModels.length > 0) setModelId(videoModels[0].id)
    }).catch(console.error)
    listTasks().then(t => {
      const v = t.filter((x:any) => x.type === 'video')
      // Ensure state is updated even if no tasks initially
      setTasks(v)
    }).catch(console.error); 
    
    const ws = connect(msg=>{ 
      if(msg.type==='task_update') {
        listTasks().then(t => setTasks(t.filter((x:any) => x.type === 'video'))).catch(console.error) 
      }
    }); 
    return ()=>ws.close()
  }, [])

  const handleUploadFirst = async (file: File) => {
    const b64 = await fToBase64(file)
    setFirstFrame(b64)
    return false
  }

  const handleUploadLast = async (file: File) => {
    const b64 = await fToBase64(file)
    setLastFrame(b64)
    return false
  }

  const submit = async () => {
    if (!modelId) return message.error('请先配置视频模型')
    
    // Construct images array
    const images: string[] = []
    if (firstFrame) images.push(firstFrame)
    if (lastFrame) {
        if (!firstFrame) return message.error('请先上传首帧，才能设置尾帧')
        images.push(lastFrame)
    }

    const selectedModel = models.find(m => m.id === modelId)
    const errorMsg = validateInput(selectedModel, prompt, images)
    if (errorMsg) return message.error(errorMsg)
    
    if (!prompt && images.length === 0) return message.error('请输入提示词或上传参考图')
    setLoading(true)
    try {
      const ps = []
      for(let i=0; i<count; i++) {
        // Create a copy of current images for this task
        const currentImages = [...images]
        const params = { resolution, ratio, duration, generate_audio: audio }
        ps.push(createTask({ type:'video', model_id:modelId, prompt, images: currentImages, params }))
      }
      const newTasks = await Promise.all(ps)

      // Optimization: Cache uploaded images immediately
      newTasks.forEach((task) => {
          if (task && images.length > 0) {
              images.forEach(async (img, imgIdx) => {
                  const key = `task_${task.id}_${task.created_at}_input_${imgIdx}`
                  try {
                      const res = await fetch(img)
                      const blob = await res.blob()
                      await AssetCache.put(key, blob)
                  } catch (e) {
                      console.warn('[Cache] Failed to pre-cache input image', e)
                  }
              })
          }
      })

      message.success(`已提交 ${count} 个任务`)
      setTasks(prev => [...newTasks, ...prev])
    } catch (e) {
      message.error('提交失败')
    } finally {
      setLoading(false)
    }
  }

  const handleReuse = async (t: any) => {
    setPrompt(t.prompt || '')
    if (t.model_id) setModelId(t.model_id)
    if (t.resolution) setResolution(t.resolution)
    if (t.ratio) setRatio(t.ratio)
    if (t.duration) setDuration(t.duration)
    // Note: t.params is not available in TaskOut anymore, we use top level fields
    
    setFirstFrame(null)
    setLastFrame(null)

    if (t.input_images && t.input_images.length > 0) {
        // Fetch images and convert to base64 to ensure API receives base64
        try {
            message.loading('正在加载参考图...', 1)
            const base64Images = await Promise.all(t.input_images.map(async (url: string, i: number) => {
                // Use cache
                const key = `task_${t.id}_${t.created_at}_input_${i}`
                try {
                    const blob = await AssetCache.getOrFetch(url, key)
                    return await new Promise<string>((resolve) => {
                        const reader = new FileReader()
                        reader.onloadend = () => resolve(reader.result as string)
                        reader.readAsDataURL(blob)
                    })
                } catch (e) {
                    console.warn(`[Reuse] Failed to fetch blob for ${url}, using original URL`, e);
                    return url;
                }
            }))
            // Filter out any potential non-string results
            const validImages = base64Images.filter(Boolean)
            if (validImages.length > 0) setFirstFrame(validImages[0])
            if (validImages.length > 1) setLastFrame(validImages[1])

            message.success('参考图加载成功')
        } catch (e) {
            console.error('Failed to load images for reuse', e)
            message.error('参考图加载失败')
        }
    }
    const sider = document.querySelector('.ant-layout-sider-children') || document.querySelector('.ant-layout-sider')
    if (sider) sider.scrollTop = 0
  }

  const handleRegenerate = async (t: any) => {
    try {
        message.loading('正在重新生成...', 1)
        
        let inputImages: string[] = []
        if (t.input_images && t.input_images.length > 0) {
            inputImages = await Promise.all(t.input_images.map(async (url: string, i: number) => {
                const key = `task_${t.id}_${t.created_at}_input_${i}`
                const blob = await AssetCache.getOrFetch(url, key)
                return await new Promise<string>((resolve) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(reader.result as string)
                    reader.readAsDataURL(blob)
                })
            }))
        }

        const params = { 
            resolution: t.resolution || '1280x720', 
            ratio: t.ratio || '16:9', 
            duration: t.duration || 5, 
            generate_audio: true // Default to true as we don't store this yet
        }
        
        const newTask = await createTask({ type:'video', model_id:t.model_id, prompt: t.prompt, images: inputImages, params })
        message.success('已提交新任务')
        setTasks(prev => [newTask, ...prev])
        setPreview({ ...preview, visible: false })
    } catch (e) {
        console.error(e)
        message.error('重新生成失败')
    }
  }

  const formatTime = (ts: number) => new Date(ts * 1000).toLocaleString()
  const formatDuration = (start?: number, end?: number) => {
      if (!start || !end) return '-'
      const diff = end - start
      return `${diff}s`
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Select All
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        e.currentTarget.select()
        return
    }
    // Copy/Paste - allow default
    if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'v')) {
        return
    }
    // Submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        submit()
    }
  }

  return (
    <Layout style={{ height: '100%', background: 'transparent' }}>
      <Sider width={360} style={{ background: '#1f1f22', borderRight: '1px solid #333', padding: 24, overflowY: 'auto' }}>
        <Card style={{ background: '#2a2a2d', border: '1px solid #333', marginBottom: 24 }} styles={{ body: { padding: 16 } }}>
          <div style={{ marginBottom: 12, color: '#ccc' }}>参考图 (首尾帧控制)</div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            {/* First Frame Slot */}
            <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 6, color: '#888', fontSize: 12 }}>首帧 (开始)</div>
                {firstFrame ? (
                    <div style={{ position: 'relative', width: '100%', aspectRatio: cssRatio }}>
                        <img 
                            src={firstFrame} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, border: '1px solid #444', cursor: 'pointer' }} 
                            onClick={() => setPreview({ visible: true, url: firstFrame, type: 'image' })}
                        />
                        <div 
                            style={{ position: 'absolute', top: -6, right: -6, background: '#333', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12, color: '#fff', border: '1px solid #555' }}
                            onClick={() => setFirstFrame(null)}
                        >x</div>
                    </div>
                ) : (
                    <Dragger 
                        accept="image/*"
                        showUploadList={false}
                        beforeUpload={handleUploadFirst as any}
                        style={{ width: '100%', aspectRatio: cssRatio, background: '#1f1f22', border: '1px dashed #444', padding: 0, borderRadius: 6 }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <PlusOutlined style={{ color: '#666', fontSize: 12, marginBottom: 2 }} />
                            <div style={{ color: '#666', fontSize: 10 }}>上传首帧</div>
                        </div>
                    </Dragger>
                )}
            </div>

            {/* Last Frame Slot */}
            <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 6, color: '#888', fontSize: 12 }}>尾帧 (结束)</div>
                {lastFrame ? (
                    <div style={{ position: 'relative', width: '100%', aspectRatio: cssRatio }}>
                        <img 
                            src={lastFrame} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, border: '1px solid #444', cursor: 'pointer' }} 
                            onClick={() => setPreview({ visible: true, url: lastFrame, type: 'image' })}
                        />
                        <div 
                            style={{ position: 'absolute', top: -6, right: -6, background: '#333', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12, color: '#fff', border: '1px solid #555' }}
                            onClick={(e) => {
                                e.stopPropagation()
                                setLastFrame(null)
                            }}
                        >x</div>
                    </div>
                ) : (
                    <Dragger 
                        accept="image/*"
                        showUploadList={false}
                        beforeUpload={handleUploadLast as any}
                        style={{ width: '100%', aspectRatio: cssRatio, background: '#1f1f22', border: '1px dashed #444', padding: 0, borderRadius: 6 }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <PlusOutlined style={{ color: '#666', fontSize: 12, marginBottom: 2 }} />
                            <div style={{ color: '#666', fontSize: 10 }}>上传尾帧</div>
                        </div>
                    </Dragger>
                )}
            </div>
          </div>
        </Card>

        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8, color: '#ccc' }}>提示词</div>
          <TextArea 
            placeholder="描述想要生成的视频内容..." 
            value={prompt} 
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4} 
            style={{ background: '#2a2a2d', border: '1px solid #333', color: '#fff' }} 
          />
        </div>

        <Card style={{ background: '#2a2a2d', border: '1px solid #333', marginBottom: 24 }} styles={{ body: { padding: 16 } }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, color: '#ccc' }}>模型</div>
            <Select 
              value={modelId} 
              onChange={setModelId} 
              style={{ width: '100%' }}
              options={models.map(m => ({ label: m.name, value: m.id }))}
              popupMatchSelectWidth={false}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, color: '#ccc' }}>分辨率 & 宽高比</div>
            <Select 
              value={resolution} 
              onChange={handleResolutionChange} 
              style={{ width: '100%' }}
              options={[
                { label: '16:9 (1280x720)', value: '1280x720' },
                { label: '16:9 (1920x1080)', value: '1920x1080' },
                { label: '9:16 (720x1280)', value: '720x1280' },
                { label: '9:16 (1080x1920)', value: '1080x1920' },
                { label: '1:1 (1024x1024)', value: '1024x1024' },
                { label: '4:3 (960x720)', value: '960x720' },
                { label: '3:4 (720x960)', value: '720x960' },
                { label: '2.4:1 (1280x534)', value: '1280x534' },
              ]}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, color: '#ccc' }}>时长 (秒)</div>
            <Input 
                type="number" 
                value={duration} 
                onChange={e=>setDuration(Number(e.target.value))} 
                style={{ background: '#1f1f22', border: '1px solid #333', color: '#fff' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
             <Checkbox checked={audio} onChange={e=>setAudio(e.target.checked)} style={{ color: '#ccc' }}>生成音效</Checkbox>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 8, color: '#ccc' }}>数量</div>
            <div style={{ display: 'flex', background: '#1f1f22', borderRadius: 6, padding: 4, border: '1px solid #444' }}>
                {[1, 2, 3, 4].map(n => (
                    <div 
                        key={n}
                        onClick={() => setCount(n)}
                        style={{ 
                            flex: 1, 
                            textAlign: 'center', 
                            padding: '4px 0', 
                            cursor: 'pointer', 
                            borderRadius: 4,
                            background: count === n ? '#333' : 'transparent',
                            color: count === n ? '#fff' : '#888',
                            fontSize: 14,
                            fontWeight: count === n ? 600 : 400
                        }}
                    >
                        {n}
                    </div>
                ))}
            </div>
          </div>
        </Card>

        <Button type="primary" block size="large" onClick={submit} loading={loading} style={{ height: 48, fontSize: 16, fontWeight: 600 }}>
          生成
        </Button>
      </Sider>

      <Content style={{ padding: 24, overflowY: 'auto' }}>
        <Typography.Title level={5} style={{ color: '#888', marginBottom: 16 }}>进行中 / 历史记录</Typography.Title>
        {tasks.length === 0 ? (
          <Empty description={<span style={{ color: '#666' }}>暂无任务</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, alignContent: 'start' }}>
            {tasks.map(t => (
              <Card 
                key={t.id}
                style={{ background: '#2a2a2d', border: '1px solid #333' }}
                styles={{ body: { padding: 16 } }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid #333', paddingBottom: 8 }}>
                    <Space>
                        <Tag color={t.status === 'succeeded' ? 'success' : t.status === 'running' ? 'processing' : t.status === 'queued' ? 'default' : 'error'}>
                            {t.status === 'succeeded' ? '完成' : t.status}
                        </Tag>
                        <span style={{ color: '#888', fontSize: 12 }}>
                            {formatTime(t.created_at)}
                            {t.finished_at && (
                                <span style={{ marginLeft: 8 }}>
                                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                                    耗时: {formatDuration(t.created_at, t.finished_at)}
                                </span>
                            )}
                        </span>
                    </Space>
                    <Space>
                        <Button size="small" type="text" icon={<CopyOutlined style={{ color: '#888' }} />} onClick={() => handleReuse(t)} title="做同款" />
                        {t.status === 'succeeded' && t.video_url && (
                            <Button size="small" type="text" icon={<DownloadOutlined style={{ color: '#888' }} />} onClick={() => {
                                const a = document.createElement('a')
                                a.href = t.video_url
                                a.download = `video_${t.id}.mp4`
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                            }} title="下载" />
                        )}
                    </Space>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Inputs */}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                         {t.input_images && t.input_images.length > 0 && (
                            <div style={{ flexShrink: 0 }}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {t.input_images.map((img: string, i: number) => (
                                        <div key={i} onClick={() => setPreview({ visible: true, task: t, url: img, type: 'image' })} style={{ cursor: 'pointer' }}>
                                            <CachedImage src={img} cacheKey={`task_${t.id}_${t.created_at}_input_${i}`} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #444' }} title="参考图" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div style={{ flex: 1, background: '#1f1f22', padding: '8px 12px', borderRadius: 4, fontSize: 13, color: '#aaa', lineHeight: 1.4, maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {t.prompt || '无提示词'}
                        </div>
                    </div>

                    {/* Result */}
                    <div style={{ width: '100%', aspectRatio: '16/9', background: '#1f1f22', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #333' }}>
                      {t.status === 'succeeded' && t.video_url ? (
                        <div onClick={() => setPreview({ visible: true, task: t, url: t.video_url, type: 'video', poster: t.last_frame_url })} style={{ width: '100%', height: '100%', cursor: 'pointer' }}>
                            <CachedVideo src={t.video_url} cacheKey={`task_${t.id}_${t.created_at}_video`} controls={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }} poster={t.last_frame_url} />
                        </div>
                      ) : (t.status === 'failed' || (t.status === 'succeeded' && !t.video_url)) ? (
                        <div style={{ color: '#ff4d4f', textAlign: 'center' }}>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>x</div>
                            {t.status === 'failed' ? '生成失败' : '无生成结果'}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                            {t.status === 'succeeded' ? (
                                <Spin size="large" tip="正在加载中..." />
                            ) : (
                                <Spin size="large" />
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: '#888', fontSize: 14 }}>
                                    {t.status === 'succeeded' ? '正在加载中...' : '正在生成中...'}
                                </span>
                                {t.status === 'succeeded' && t.video_url && (
                                    <Tooltip title="复制链接">
                                        <Button 
                                            size="small" 
                                            type="text" 
                                            icon={<CopyOutlined style={{ color: '#666', fontSize: 12 }} />} 
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                if(t.video_url) {
                                                    navigator.clipboard.writeText(t.video_url)
                                                    message.success('链接已复制')
                                                }
                                            }}
                                            style={{ width: 20, height: 20, minWidth: 20 }}
                                        />
                                    </Tooltip>
                                )}
                            </div>
                        </div>
                      )}
                    </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Content>
      <PreviewModal 
        open={preview.visible}
        onCancel={() => setPreview({ ...preview, visible: false })}
        task={preview.task}
        url={preview.url}
        type={preview.type}
        poster={preview.poster}
        models={models}
        onReuse={handleReuse}
        onRegenerate={handleRegenerate}
      />
    </Layout>
  )
}

function fToBase64(f: File) { return new Promise<string>((res)=>{ const r = new FileReader(); r.onload=()=>res(String(r.result)); r.readAsDataURL(f) }) }

function validateInput(model: any, prompt: string, images: string[]) {
    if (!model || !model.validation_info || !model.validation_info.parameters) return null;
    
    const rules = model.validation_info.parameters;

    for (const rule of rules) {
        if (rule.name === 'prompt') {
            if (rule.required && !prompt) return '请输入提示词';
            if (prompt && rule.constraints?.max_length && prompt.length > rule.constraints.max_length) {
                return `提示词过长，最大允许 ${rule.constraints.max_length} 字`;
            }
        }
        if (rule.name === 'images') {
            if (rule.required && images.length === 0) return '请上传参考图';
            if (images.length > 0) {
                // If model allows 2 images, check against 2. Otherwise default check.
                // For Seedance 1.5 Pro, we updated backend to allow 2. 
                // However, we should trust the rule coming from backend.
                // If the rule still says max_count=1 (cached model list), it will fail.
                // We should ensure backend config is updated.
               
                if (rule.constraints?.max_size_mb) {
                    const maxBytes = rule.constraints.max_size_mb * 1024 * 1024;
                    for (let i = 0; i < images.length; i++) {
                        const img = images[i];
                        // Base64 header "data:image/png;base64,"
                        const base64Content = img.split(',')[1] || img;
                        // Approximate size: 3/4 of base64 length
                        const sizeInBytes = (base64Content.length * 3) / 4 - (base64Content.match(/=/g)?.length || 0);
                        if (sizeInBytes > maxBytes) {
                            return `第 ${i+1} 张图片过大 (>${rule.constraints.max_size_mb}MB)`;
                        }
                    }
                }
            }
        }
    }
    return null;
}
