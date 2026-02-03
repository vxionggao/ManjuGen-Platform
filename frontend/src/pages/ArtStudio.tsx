import React, { useEffect, useState, useRef } from 'react'
import { createTask, listTasks, listModels, deleteTask, resolvePrompt, listAssets, searchAssets, clearTasks } from '../services/api'
import { connect } from '../services/ws'
import { Layout, Select, Input, Button, Upload, Card, Tag, Typography, App as AntdApp, Row, Col, Empty, Spin, Space, Tooltip, Modal, Popconfirm, AutoComplete } from 'antd'
import { InboxOutlined, PlayCircleOutlined, DownloadOutlined, CopyOutlined, ClockCircleOutlined, CheckCircleOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'

const { Sider, Content } = Layout
const { TextArea } = Input
const { Dragger } = Upload

import { CachedImage } from '../components/CachedAsset'
import { AssetCache } from '../services/cache'
import { PreviewModal } from '../components/PreviewModal'
import { MaterialLibrary } from '../components/MaterialLibrary'

import { useLocation } from 'react-router-dom'

export default function ArtStudio() {
  const location = useLocation()
  const { message } = AntdApp.useApp()
  
  const isComposing = useRef(false)
  const [prompt, setPrompt] = useState(localStorage.getItem('art_prompt') || '')
  const [shouldAutoSubmit, setShouldAutoSubmit] = useState(false)
  const [batchScenes, setBatchScenes] = useState<any[]>([])
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
  const [materialLibraryVisible, setMaterialLibraryVisible] = useState(true)
  const [assets, setAssets] = useState<any[]>([])
  const [assetSuggestions, setAssetSuggestions] = useState<any[]>([])
  const [showAssetSuggestions, setShowAssetSuggestions] = useState(false)
  const [currentAssetType, setCurrentAssetType] = useState<string>('')
  
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

  useEffect(() => {
      if (location.state?.prompt) {
          setPrompt(location.state.prompt)
          if (location.state?.scenes && Array.isArray(location.state.scenes)) {
              setBatchScenes(location.state.scenes)
          }
          if (location.state.autoGenerate) {
              setShouldAutoSubmit(true)
          }
          window.history.replaceState({}, '')
      }
  }, [location])

  useEffect(() => {
      if (shouldAutoSubmit && modelId && models.length > 0 && !loading) {
          // Delay slightly to ensure state is settled
          setTimeout(() => {
              if (batchScenes.length > 0) {
                  handleBatchGenerate(batchScenes)
                  setBatchScenes([])
              } else {
                  submit()
              }
              setShouldAutoSubmit(false)
          }, 500)
      }
  }, [shouldAutoSubmit, modelId, models, loading, batchScenes])

  const handleBatchGenerate = async (scenes: any[]) => {
      if (!modelId) return message.error('请先配置生图模型')
      setLoading(true)
      try {
          message.loading(`正在提交 ${scenes.length} 个分镜任务...`, 2)
          const ps = scenes.map(scene => {
              const payload: any = { 
                  type: 'image', 
                  model_id: modelId, 
                  prompt: scene.prompt, 
                  images: images 
              }
              if (size !== 'smart') payload.size = size
              return createTask(payload)
          })
          
          const newTasks = await Promise.all(ps)
          message.success(`成功提交 ${newTasks.length} 个任务`)
          setTasks(prev => [...newTasks, ...prev])
      } catch (e) {
          console.error(e)
          message.error('批量提交失败')
      } finally {
          setLoading(false)
      }
  }

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

  const handleDelete = async (taskId: string) => {
    try {
        await deleteTask(taskId)
        message.success('任务已删除')
        setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch (e) {
        console.error(e)
        message.error('删除失败')
    }
  }

  const handleClearHistory = async () => {
    try {
        await clearTasks('image')
        message.success('历史记录已清空')
        const res = await listTasks()
        setTasks(res.filter((x:any) => x.type === 'image'))
    } catch (e) {
        message.error('清空失败')
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
    // Handle @ for asset suggestions
    if (e.key === '@') {
        setShowAssetSuggestions(true)
    }
  }

  const handleAssetSelect = async (asset: any) => {
    // Add asset reference to prompt
    const assetReference = `@${asset.type}:{${asset.name}}`
    setPrompt(prev => `${prev} ${assetReference}`.trim())
    
    // Add asset image to reference images
    if (asset.cover_url || asset.url) {
        const url = asset.cover_url || asset.url
        try {
            message.loading('正在加载素材参考图...', 1)
            const blob = await AssetCache.getOrFetch(url, `asset_${asset.id}`)
            const b64 = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result as string)
                reader.readAsDataURL(blob)
            })
            setImages(prev => [...prev, b64])
            message.success(`已添加素材: ${asset.name}`)
        } catch (e) {
            console.error('Failed to load asset image', e)
            message.warning('素材已添加，但参考图加载失败')
        }
    } else {
        message.success(`已添加素材: ${asset.name}`)
    }
  }

  const handleSuggestionClick = async (asset: any) => {
      const value = prompt
      const lastAtIndex = value.lastIndexOf('@')
      if (lastAtIndex !== -1) {
          const newValue = value.substring(0, lastAtIndex) + `@${asset.type}:{${asset.name}} `
          setPrompt(newValue)
      } else {
          setPrompt(prev => `${prev} @${asset.type}:{${asset.name}} `)
      }
      setShowAssetSuggestions(false)

      // Add asset image
      if (asset.cover_url || asset.url) {
        const url = asset.cover_url || asset.url
        try {
            message.loading('正在加载素材参考图...', 1)
            const blob = await AssetCache.getOrFetch(url, `asset_${asset.id}`)
            const b64 = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result as string)
                reader.readAsDataURL(blob)
            })
            setImages(prev => [...prev, b64])
        } catch (e) {
            console.error(e)
        }
    }
  }

  const handlePromptChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setPrompt(value)
    
    // Check if user is typing @ for asset suggestions
    const lastAtIndex = value.lastIndexOf('@')
    if (lastAtIndex !== -1) {
        const textAfterAt = value.substring(lastAtIndex + 1)
        // If there is no space after @, we treat it as a search query
        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
            setShowAssetSuggestions(true)
            if (textAfterAt.length > 0) {
                try {
                    // Search with small topk
                    const results = await searchAssets(textAfterAt, undefined, 5)
                    setAssets(results)
                } catch (e) {
                    console.error(e)
                }
            } else {
                // If just @, maybe show recent or random? Or clear?
                // Let's show empty or keep previous if any
            }
        } else {
            setShowAssetSuggestions(false)
        }
    } else {
        setShowAssetSuggestions(false)
    }
  }

  return (
    <Layout style={{ height: '100%', background: 'transparent' }}>
      {/* Unified Left Sidebar: Material Library + Config */}
      <Sider width={420} style={{ background: '#1f1f22', borderRight: '1px solid #333', overflowY: 'auto' }}>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Material Library Section */}
          <div style={{ height: 400, border: '1px solid #333', borderRadius: 8, overflow: 'hidden', background: '#161618' }}>
             <MaterialLibrary onAssetSelect={handleAssetSelect} />
          </div>

          {/* Reference Image Section */}
          <Card style={{ background: '#2a2a2d', border: '1px solid #333' }} styles={{ body: { padding: 16 } }}>
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

          {/* Prompt Section */}
          <div>
            <div style={{ marginBottom: 8, color: '#ccc' }}>提示词</div>
            <div style={{ position: 'relative' }}>
              <TextArea 
                placeholder="描述想要生成的内容..." 
                value={prompt} 
                onChange={handlePromptChange}
                onKeyDown={handleKeyDown}
                rows={4} 
                style={{ background: '#2a2a2d', border: '1px solid #333', color: '#fff' }} 
              />
              {showAssetSuggestions && (
                <div style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  right: 0, 
                  background: '#2a2a2d', 
                  border: '1px solid #333', 
                  borderRadius: 4, 
                  marginTop: 4, 
                  zIndex: 1000, 
                  maxHeight: 200, 
                  overflowY: 'auto'
                }}>
                  <div style={{ padding: 8, color: '#ccc', fontSize: 12, borderBottom: '1px solid #333' }}>
                    选择素材...
                  </div>
                  {assets.slice(0, 5).map((asset) => (
                    <div 
                      key={asset.asset_id} 
                      onClick={() => handleSuggestionClick(asset)}
                      style={{ 
                        padding: 12, 
                        cursor: 'pointer', 
                        borderBottom: '1px solid #333'
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
                        {asset.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        {asset.description.substring(0, 30)}
                        {asset.description.length > 30 && '...'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Settings Section */}
          <Card style={{ background: '#2a2a2d', border: '1px solid #333' }} styles={{ body: { padding: 16 } }}>
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
        </div>
      </Sider>

      <Content style={{ padding: 24, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
             <Typography.Title level={5} style={{ color: '#888', margin: 0 }}>进行中 / 历史记录</Typography.Title>
             <Popconfirm title="确认清空所有已完成任务？" onConfirm={handleClearHistory} okText="清空" cancelText="取消">
                 <Button type="text" icon={<DeleteOutlined />} style={{ color: '#888' }}>一键清空历史</Button>
             </Popconfirm>
        </div>
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
                        <Popconfirm title="确认删除任务？" onConfirm={() => handleDelete(t.id)} okText="删除" cancelText="取消">
                            <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#888' }} />} title="删除" />
                        </Popconfirm>
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
