import { useEffect, useState } from 'react'
import { Layout, Button, Upload, Table, message, Popconfirm, Space, Typography, Modal, Form, Input, Tabs, Card, Image, InputNumber, Divider, Spin, Checkbox, Select } from 'antd'
import { UploadOutlined, DeleteOutlined, FileTextOutlined, SettingOutlined, SearchOutlined, ImportOutlined, BulbOutlined, CopyOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons'
import { listAssets, uploadAsset, deleteAsset, listSystemConfigs, updateSystemConfig, searchMaterials, importMaterial, optimizeBadcase } from '../services/api'
import BestPracticeLibrary from '../components/BestPracticeLibrary'

const PLACEHOLDER_IMG = "/placeholder.png";

const { Content } = Layout
const { Title } = Typography

export default function Assets() {
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false)
  const [configForm] = Form.useForm()
  const [activeTab, setActiveTab] = useState('local')
  const [localTab, setLocalTab] = useState('all')
  const [isBestPracticeModalVisible, setIsBestPracticeModalVisible] = useState(false)

  // Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isUploadTypeModalVisible, setIsUploadTypeModalVisible] = useState(false)
  const [uploadType, setUploadType] = useState('role')

  // Import State
  const [importItem, setImportItem] = useState<any>(null)
  const [isImportTypeModalVisible, setIsImportTypeModalVisible] = useState(false)
  const [importType, setImportType] = useState('role')
  
  // Optimize state
  const [isOptimizeModalVisible, setIsOptimizeModalVisible] = useState(false)
  const [optimizeResult, setOptimizeResult] = useState<any>(null)
  const [optimizing, setOptimizing] = useState(false)
  const [currentOptimizeItem, setCurrentOptimizeItem] = useState<any>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLimit, setSearchLimit] = useState(10)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  const fetchAssets = async () => {
    try {
      setLoading(true)
      const res = await listAssets()
      setAssets(res)
    } catch (e) {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleConfigOpen = async () => {
      try {
          const configs = await listSystemConfigs()
          const configMap: any = {}
          configs.forEach((c: any) => configMap[c.key] = c.value)
          configForm.setFieldsValue(configMap)
          setIsConfigModalVisible(true)
      } catch (e) {
          message.error('加载配置失败')
      }
  }

  const handleConfigSubmit = async () => {
      try {
          const values = await configForm.validateFields()
          for (const key in values) {
               if (key.startsWith('vikingdb_') || key === 'tos_bucket_name') {
                   await updateSystemConfig({ key, value: values[key] || '', description: 'VikingDB Config' })
               }
          }
          message.success('配置已保存')
          setIsConfigModalVisible(false)
      } catch (e) {
          message.error('保存失败')
      }
  }

  const handleSearch = async () => {
      if (!searchQuery) return message.warning('请输入搜索内容')
      setSearching(true)
      try {
          const res = await searchMaterials(searchQuery, searchLimit)
          setSearchResults(res)
      } catch (e) {
          message.error('检索失败')
      } finally {
          setSearching(false)
      }
  }

  const handleImport = (item: any) => {
      setImportItem(item)
      setImportType('role')
      setIsImportTypeModalVisible(true)
  }

  const handleConfirmImport = async () => {
      if (!importItem) return
      try {
          const payload = { ...importItem, target_type: importType }
          const res = await importMaterial(payload)
          if (res.status === 'exists') {
              message.warning('素材已存在')
          } else {
              message.success('导入成功')
              fetchAssets() 
              setActiveTab('local')
          }
          setIsImportTypeModalVisible(false)
          setImportItem(null)
      } catch (e) {
          message.error('导入失败')
      }
  }

  const handleSmartOptimize = async (item: any) => {
      setCurrentOptimizeItem(item)
      setOptimizeResult(null)
      setIsOptimizeModalVisible(true)
      setOptimizing(true)
      
      try {
          const payload = {
              prompt: item.text || item.description || item.name,
              image_url: item.preview_url || item.image_uri || item.cover_image,
              reference_url: "" 
          }
          const res = await optimizeBadcase(payload)
          setOptimizeResult(res)
      } catch (e: any) {
          message.error('智能优化失败: ' + e.message)
          console.error(e)
          // Keep modal open to show error state if needed, or user can close
      } finally {
          setOptimizing(false)
      }
  }

  useEffect(() => {
    fetchAssets()
  }, [])

  const handleUpload = (file: File) => {
    setUploadFile(file)
    if (file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.pdf')) {
        setUploadType('script')
    } else {
        setUploadType('role')
    }
    setIsUploadTypeModalVisible(true)
    return false
  }

  const handleConfirmUpload = async () => {
      if (!uploadFile) return
      try {
          await uploadAsset(uploadFile, uploadType)
          message.success('上传成功')
          fetchAssets()
          setIsUploadTypeModalVisible(false)
          setUploadFile(null)
      } catch (e) {
          message.error('上传失败')
      }
  }

  const columns = [
    {
      title: '缩略图',
      dataIndex: 'cover_image',
      key: 'cover_image',
      render: (text: string) => {
        let src = text;
        if (text && text.startsWith('tos://')) {
            const idx = text.indexOf('/', 6);
            if (idx > 6) {
                const bucket = text.substring(6, idx);
                const key = text.substring(idx + 1);
                src = `/api/materials/proxy?bucket=${bucket}&key=${encodeURIComponent(key)}`;
            }
        } else if (!text) {
             src = PLACEHOLDER_IMG;
        }
        
        return (
            <img 
                src={src} 
                style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4 }} 
                referrerPolicy="no-referrer"
                onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = PLACEHOLDER_IMG;
                }}
            />
        );
      }
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <FileTextOutlined />
          {text}
        </Space>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      filters: [
        { text: '角色', value: 'role' },
        { text: '场景', value: 'scene' },
        { text: '物品', value: 'item' },
        { text: '风格', value: 'style' },
        { text: '剧本', value: 'script' },
      ],
      onFilter: (value: any, record: any) => record.type === value,
      render: (text: string) => {
          const map: any = { role: '角色', scene: '场景', item: '物品', style: '风格', script: '剧本', image: '图片' }
          return map[text] || text
      }
    },
    {
        title: '上传时间',
        dataIndex: 'created_at',
        key: 'created_at',
        render: (ts: number) => new Date(ts * 1000).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
            <Button type="link" href={record.url} target="_blank">下载</Button>
            <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.asset_id)}>
                <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
        </Space>
      ),
    },
  ]

  const handleDelete = async (assetId: string) => {
    try {
      await deleteAsset(assetId)
      message.success('删除成功')
      setAssets(prev => prev.filter(a => a.asset_id !== assetId))
    } catch (e) {
      message.error('删除失败')
    }
  }

  return (
    <Layout style={{ height: '100%' }}>
      <Content style={{ padding: '24px', overflow: 'auto' }}>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0, color: '#fff' }}>资产管理</Title>
            <Space>
                {activeTab === 'remote' && (
                    <Button icon={<SettingOutlined />} onClick={handleConfigOpen}>VikingDB 数据源绑定</Button>
                )}
                {activeTab === 'best_practice' && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsBestPracticeModalVisible(true)}>添加案例</Button>
                )}
                {activeTab === 'local' && (
                    <Upload beforeUpload={handleUpload} showUploadList={false} accept=".txt,.md,.pdf,.docx,.jpg,.jpeg,.png,.gif,.webp">
                        <Button type="primary" icon={<UploadOutlined />}>上传素材</Button>
                    </Upload>
                )}
            </Space>
        </div>
        
        <Tabs 
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
            {
                key: 'local',
                label: '本地素材',
                children: (
                    <div>
                        <Tabs 
                            activeKey={localTab} 
                            onChange={setLocalTab}
                            type="card"
                            size="small"
                            items={[
                                { key: 'all', label: '全部' },
                                { key: 'role', label: '角色' },
                                { key: 'scene', label: '场景' },
                                { key: 'item', label: '物品' },
                                { key: 'style', label: '风格' },
                                { key: 'script', label: '剧本' },
                            ]}
                            style={{ marginBottom: 16 }}
                        />
                        <Table 
                            dataSource={localTab === 'all' ? assets : assets.filter(a => a.type === localTab)} 
                            columns={columns} 
                            rowKey="id" 
                            loading={loading}
                            pagination={{ pageSize: 10 }}
                        />
                    </div>
                )
            },
            {
                key: 'best_practice',
                label: '优秀案例库',
                children: <BestPracticeLibrary isModalOpen={isBestPracticeModalVisible} onClose={() => setIsBestPracticeModalVisible(false)} />
            },
            {
                key: 'remote',
                label: '数据源检索 (VikingDB)',
                children: (
                    <div style={{ padding: 20, background: '#1f1f22', borderRadius: 8 }}>
                        <div style={{ marginBottom: 20, display: 'flex', gap: 10 }}>
                            <Input 
                                placeholder="输入描述搜索素材..." 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)}
                                onPressEnter={handleSearch}
                                style={{ maxWidth: 400 }}
                            />
                            <InputNumber min={1} max={50} value={searchLimit} onChange={v => setSearchLimit(v || 10)} />
                            <Button type="primary" icon={<SearchOutlined />} loading={searching} onClick={handleSearch}>
                                检索
                            </Button>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                            {searchResults.map((item, idx) => (
                                <Card
                                    key={idx}
                                    hoverable
                                    cover={
                                        item.preview_url ? (
                                            <img 
                                                src={item.preview_url}
                                                style={{ height: 150, width: '100%', objectFit: 'cover' }}
                                                onError={(e) => {
                                                    e.currentTarget.onerror = null;
                                                    e.currentTarget.src = PLACEHOLDER_IMG;
                                                }}
                                                referrerPolicy="no-referrer"
                                                alt={item.image_name}
                                            />
                                        ) : (
                                            <div style={{ height: 150, background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <FileTextOutlined style={{ fontSize: 32, color: '#666' }} />
                                            </div>
                                        )
                                    }
                                    actions={[
                                        <Button type="link" icon={<ImportOutlined />} onClick={() => handleImport(item)}>
                                            导入
                                        </Button>
                                    ]}
                                >
                                    <Card.Meta 
                                        title={item.image_name || item.pk} 
                                        description={
                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {item.text || '无描述'}
                                            </div>
                                        } 
                                    />
                                </Card>
                            ))}
                        </div>
                        {searchResults.length === 0 && !searching && (
                            <div style={{ textAlign: 'center', color: '#666', padding: 40 }}>
                                暂无搜索结果
                            </div>
                        )}
                    </div>
                )
            }
        ]} />

        <Modal
            title="VikingDB 数据源绑定"
            open={isConfigModalVisible}
            onOk={handleConfigSubmit}
            onCancel={() => setIsConfigModalVisible(false)}
        >
            <Form form={configForm} layout="vertical">
                <Form.Item name="vikingdb_host" label="Endpoint (Host)" initialValue="api-vikingdb.volces.com">
                    <Input placeholder="api-vikingdb.volces.com" />
                </Form.Item>
                <Form.Item name="vikingdb_region" label="Region" initialValue="cn-beijing">
                    <Input placeholder="cn-beijing" />
                </Form.Item>
                <Form.Item name="tos_bucket_name" label="TOS Bucket Name" initialValue="hmtos">
                    <Input placeholder="hmtos" />
                </Form.Item>
                <Form.Item name="vikingdb_collection" label="Collection Name" initialValue="material_assets">
                    <Input placeholder="material_assets" />
                </Form.Item>
                <Form.Item name="vikingdb_index" label="Index Name" initialValue="material_assets_index">
                    <Input placeholder="material_assets_index" />
                </Form.Item>
                <Form.Item name="vikingdb_ak" label="Access Key (AK)">
                    <Input.Password placeholder="Volcengine AK" />
                </Form.Item>
                <Form.Item name="vikingdb_sk" label="Secret Key (SK)">
                    <Input.Password placeholder="Volcengine SK" />
                </Form.Item>
                <div style={{ color: '#888', fontSize: 12 }}>
                    * 配置 AK/SK 以启用图片加载
                </div>
            </Form>
        </Modal>

        <Modal
            title="智能优化 (Badcase Analysis)"
            open={isOptimizeModalVisible}
            onCancel={() => setIsOptimizeModalVisible(false)}
            width={800}
            footer={null}
        >
            {optimizing ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <Spin tip="AI 正在诊断与优化..." />
                </div>
            ) : optimizeResult ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Diagnosis */}
                    <Card title="1. 失败诊断 (Diagnosis)" size="small">
                        {Object.entries(optimizeResult.diagnosis).map(([k, v]: any) => (
                            <div key={k} style={{ marginBottom: 10 }}>
                                <strong>{k}:</strong>
                                <ul>
                                    {Array.isArray(v) && v.map((msg: string, i: number) => <li key={i}>{msg}</li>)}
                                </ul>
                            </div>
                        ))}
                    </Card>
                    
                    {/* Fix Strategy */}
                    <Card title="2. 修复策略 (Strategy)" size="small">
                         {Object.entries(optimizeResult.fix_strategy).map(([k, v]: any) => (
                            <div key={k} style={{ marginBottom: 10 }}>
                                <strong>{k}:</strong>
                                <ul>
                                    {Array.isArray(v) && v.map((msg: string, i: number) => <li key={i}>{msg}</li>)}
                                </ul>
                            </div>
                        ))}
                    </Card>
                    
                    {/* Optimized Prompt */}
                    <Card title="3. 优化后 Prompt" size="small" extra={
                        <Button icon={<CopyOutlined />} onClick={() => {
                            navigator.clipboard.writeText(optimizeResult.optimized_prompt)
                            message.success('已复制')
                        }}>复制</Button>
                    }>
                        <Input.TextArea 
                            value={optimizeResult.optimized_prompt} 
                            autoSize={{ minRows: 3, maxRows: 6 }} 
                            readOnly 
                        />
                        <div style={{ marginTop: 10 }}>
                            <Button type="primary" block icon={<ReloadOutlined />} onClick={() => {
                                // Trigger regenerate (mock for now or implement)
                                message.info('已应用新 Prompt (需对接生图接口)')
                                setIsOptimizeModalVisible(false)
                            }}>用此 Prompt 再次生成</Button>
                        </div>
                    </Card>
                    
                    {/* Checklist */}
                    <Card title="4. 检查清单 (Checklist)" size="small">
                        {optimizeResult.checklist && optimizeResult.checklist.map((item: string, i: number) => (
                            <div key={i}>
                                <Checkbox>{item}</Checkbox>
                            </div>
                        ))}
                    </Card>
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                    {optimizing ? '' : '无法获取结果'}
                </div>
            )}
        </Modal>

        <Modal
            title="选择素材类型"
            open={isUploadTypeModalVisible}
            onOk={handleConfirmUpload}
            onCancel={() => setIsUploadTypeModalVisible(false)}
        >
            <Form layout="vertical">
                <Form.Item label="文件">
                    <Input value={uploadFile?.name} disabled />
                </Form.Item>
                <Form.Item label="类型">
                    <Select 
                        value={uploadType} 
                        onChange={setUploadType}
                        options={[
                            { label: '角色 (Role)', value: 'role' },
                            { label: '场景 (Scene)', value: 'scene' },
                            { label: '物品 (Item)', value: 'item' },
                            { label: '风格 (Style)', value: 'style' },
                            { label: '剧本 (Script)', value: 'script' },
                        ]}
                    />
                </Form.Item>
             </Form>
         </Modal>

        <Modal
            title="选择导入类型"
            open={isImportTypeModalVisible}
            onOk={handleConfirmImport}
            onCancel={() => setIsImportTypeModalVisible(false)}
        >
            <Form layout="vertical">
                <Form.Item label="素材名称">
                    <Input value={importItem?.image_name || importItem?.pk} disabled />
                </Form.Item>
                <Form.Item label="导入类型">
                    <Select 
                        value={importType} 
                        onChange={setImportType}
                        options={[
                            { label: '角色 (Role)', value: 'role' },
                            { label: '场景 (Scene)', value: 'scene' },
                            { label: '物品 (Item)', value: 'item' },
                            { label: '风格 (Style)', value: 'style' },
                        ]}
                    />
                </Form.Item>
            </Form>
        </Modal>
      </Content>
    </Layout>
  )
}

// Need to restore handleUpload function which I removed in previous step by mistake (it was outside component in old code?)
// Wait, handleUpload was inside component.
// I need to make sure I didn't lose `handleUpload` implementation.
// In `old_str` of my previous SearchReplace, `handleUpload` was inside.
// In `new_str` of previous SearchReplace, I didn't include `handleUpload` implementation in the snippet I provided?
// Wait, I replaced lines 1-30+ with new imports and component start.
// I might have overwritten `handleUpload` if it was in the range.
// `handleUpload` was at line 29.
// My previous SearchReplace replaced lines 1 to `useEffect` (around line 26).
// It seems `handleUpload` is still there if I didn't replace it.
// Let's verify `Assets.tsx` content after this change.

