import React, { useEffect, useState, useRef } from 'react'
import { createTask, listTasks, listModels } from '../services/api'
import { connect } from '../services/ws'
import { Layout, Select, Input, Button, Upload, Card, Tag, Typography, App as AntdApp, Row, Col, Empty, Spin, Space, Tooltip, Modal } from 'antd'
import { InboxOutlined, PlayCircleOutlined, DownloadOutlined, CopyOutlined, ClockCircleOutlined, CheckCircleOutlined, PlusOutlined } from '@ant-design/icons'

const { Sider, Content } = Layout
const { TextArea } = Input
const { Dragger } = Upload

import { CachedImage } from '../components/CachedAsset'
import { AssetCache } from '../services/cache'
import { PreviewModal } from '../components/PreviewModal'

export default function ArtStudio() {
  const { message } = AntdApp.useApp()
  
  const isComposing = useRef(false)
  const [prompt, setPrompt] = useState(localStorage.getItem('art_prompt') || '')
  const [images, setImages] = useState<string[]>(() => {
    try { 
      const parsed = JSON.parse(localStorage.getItem('art_images') || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  })
  const [size, setSize] = useState(localStorage.getItem('art_size') || '2048x2048')
  const [modelId, setModelId] = useState<number | null>(() => {
    const saved = localStorage.getItem('art_model')
    const num = Number(saved)
    return (saved && !isNaN(num)) ? num : null
  })
  const [count, setCount] = useState<number>(() => {
    return Number(localStorage.getItem('art_count')) || 1
  })
  const [tasks, setTasks] = useState<any[]>([])
  const [models, setModels] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<{ visible: boolean, task?: any, url: string, type: 'image' | 'video', poster?: string, images?: string[], initialIndex?: number }>({ visible: false, url: '', type: 'image' })
  
  useEffect(() => { localStorage.setItem('art_prompt', prompt) }, [prompt])
  useEffect(() => { localStorage.setItem('art_size', size) }, [size])
  useEffect(() => { localStorage.setItem('art_count', String(count)) }, [count])
  useEffect(() => { if (modelId) localStorage.setItem('art_model', String(modelId)) }, [modelId])
  useEffect(() => { 
    try { localStorage.setItem('art_images', JSON.stringify(images)) } catch (e) { console.error('Image storage failed', e) } 
  }, [images])
  
  useEffect(()=>{ 
    listModels().then(ms => {
        const imgModels = ms.filter((m: any) => m.type === 'image')
        setModels(imgModels)
        if (!modelId && imgModels.length > 0) setModelId(imgModels[0].id)
    }).catch(console.error)
    listTasks().then(t => {
      setTasks(t.filter((x:any) => x.type === 'image'))
    }).catch(console.error); 
    const ws = connect(msg=>{ 
      if(msg.type==='task_update') {
        listTasks().then(t => setTasks(t.filter((x:any) => x.type === 'image'))).catch(console.error) 
      }
    }); 
    return ()=>ws.close() 
  }, [])

  const handleUpload = async (file: File) => {
    const b64 = await fToBase64(file)
    setImages(prev => [...prev, b64])
    return false // prevent auto upload
  }

  const submit = async () => {
    if (!modelId) return message.error('请先配置生图模型')
    
    const selectedModel = models.find(m => m.id === modelId)
    const errorMsg = validateInput(selectedModel, prompt, images)
    if (errorMsg) return message.error(errorMsg)
    
    if (!prompt) return message.error('请输入提示词')
    setLoading(true)
    try {
      const ps = []
      for(let i=0; i<count; i++) {
        // IMPORTANT: Copy images array to avoid reference issues
        // The images state might change later, but we want the current snapshot
        const currentImages = [...images]
        const payload: any = { type:'image', model_id:modelId, prompt, images: currentImages }
        if (size !== 'smart') payload.size = size
        ps.push(createTask(payload))
      }
      const newTasks = await Promise.all(ps)
      
      // Optimization: Cache uploaded images immediately to avoid re-fetching
      newTasks.forEach((task, i) => {
          // Since all tasks in this batch use the same 'images' state (captured at start of submit, but wait... 
          // inside the loop we did const currentImages = [...images]. 
          // Actually, 'images' state doesn't change during the loop execution effectively because it's async but synchronous loop generation.
          // However, to be safe, we should use the same images we sent.
          // In the current logic: const currentImages = [...images] is used.
          // Since 'images' is const in the scope of render (but state), and we are in submit closure...
          // We can just use 'images' (the state value at the time submit was called).
          // But wait, the loop creates 'currentImages'.
          
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
      // setPrompt('')
      // setImages([])
    } catch (e) {
      message.error('提交失败')
    } finally {
      setLoading(false)
    }
  }

  const handleReuse = async (t: any) => {
    setPrompt(t.prompt || '')
    if (t.model_id) setModelId(t.model_id)
    setSize(t.size || 'smart')
    if (t.input_images && t.input_images.length > 0) {
        try {
            message.loading('正在加载参考图...', 1)
            const base64Images = await Promise.all(t.input_images.map(async (url: string, i: number) => {
                // Use the same cache key format as CachedImage component
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
            setImages(base64Images.filter(Boolean))
            message.success('参考图加载成功')
        } catch (e) {
            console.error('Failed to load images for reuse', e)
            message.error('参考图加载失败')
            setImages([])
        }
    } else {
        setImages([])
    }
    // Scroll to top
    const sider = document.querySelector('.ant-layout-sider')
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

        const payload: any = { type:'image', model_id:t.model_id, prompt: t.prompt, images: inputImages }
        if (t.resolution) payload.size = t.resolution
        
        const newTask = await createTask(payload)
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
        {/* <Typography.Title level={4} style={{ color: '#fff', marginBottom: 24 }}>参考生图</Typography.Title> */}
        
        <Card style={{ background: '#2a2a2d', border: '1px solid #333', marginBottom: 24 }} styles={{ body: { padding: 16 } }}>
          <div style={{ marginBottom: 12, color: '#ccc' }}>参考图 (可选)</div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {images.map((img, i) => (
                <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
                    <img 
                        src={img} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4, border: '1px solid #444', cursor: 'pointer' }} 
                        onClick={() => setPreview({ visible: true, url: img, type: 'image' })}
                    />
                    <div 
                        style={{ position: 'absolute', top: -4, right: -4, background: '#333', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 10, color: '#fff' }}
                        onClick={(e) => {
                            e.stopPropagation()
                            setImages(prev => prev.filter((_, idx) => idx !== i))
                        }}
                    >x</div>
                </div>
            ))}
            <Dragger 
                multiple 
                beforeUpload={handleUpload as any} 
                showUploadList={false}
                style={{ width: 80, height: 80, background: '#1f1f22', border: '1px dashed #444', padding: 0, borderRadius: 4 }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <PlusOutlined style={{ color: '#666', fontSize: 20 }} />
                </div>
            </Dragger>
          </div>
        </Card>

        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8, color: '#ccc' }}>提示词</div>
          <TextArea 
            placeholder="描述想要生成的内容..." 
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
            <div style={{ marginBottom: 8, color: '#ccc' }}>宽高比</div>
            <Select 
              value={size} 
              onChange={setSize} 
              style={{ width: '100%' }}
              options={[
                { label: '智能适配 (Smart)', value: 'smart' },
                { label: '1:1 (2048x2048)', value: '2048x2048' },
                { label: '16:9 (2560x1440)', value: '2560x1440' },
                { label: '9:16 (1440x2560)', value: '1440x2560' },
                { label: '4:3 (2304x1728)', value: '2304x1728' },
                { label: '3:4 (1728x2304)', value: '1728x2304' },
              ]}
            />
          </div>
          {/* 
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, color: '#ccc' }}>尺寸</div>
            ... removed ...
          </div> 
          */}
          <div>
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
                {/* Header: Status, Time, Duration */}
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
                        {t.status === 'succeeded' && t.result_urls && (
                            <Button size="small" type="text" icon={<DownloadOutlined style={{ color: '#888' }} />} onClick={() => {
                                const a = document.createElement('a')
                                a.href = t.result_urls[0]
                                a.download = `image_${t.id}.png`
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                            }} title="下载" />
                        )}
                    </Space>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Inputs Section (Compact) */}
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

                    {/* Result Section (Prominent) */}
                    <div style={{ width: '100%', aspectRatio: '16/9', background: '#1f1f22', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #333' }}>
                      {t.status === 'succeeded' && t.result_urls && t.result_urls.length > 0 ? (
                        <div onClick={() => setPreview({ visible: true, task: t, url: t.result_urls[0], type: 'image' })} style={{ width: '100%', height: '100%', cursor: 'pointer' }}>
                            <CachedImage src={t.result_urls[0]} cacheKey={`task_${t.id}_${t.created_at}_result_0`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                      ) : (t.status === 'failed' || (t.status === 'succeeded' && (!t.result_urls || t.result_urls.length === 0))) ? (
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
                                {t.status === 'succeeded' && t.result_urls && (
                                    <Tooltip title="复制链接">
                                        <Button 
                                            size="small" 
                                            type="text" 
                                            icon={<CopyOutlined style={{ color: '#666', fontSize: 12 }} />} 
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                if(t.result_urls && t.result_urls[0]) {
                                                    navigator.clipboard.writeText(t.result_urls[0])
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
        images={preview.images}
        initialIndex={preview.initialIndex}
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
                if (rule.constraints?.max_count && images.length > rule.constraints.max_count) {
                    return `参考图数量过多，最多允许 ${rule.constraints.max_count} 张`;
                }
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
