import { useEffect, useState } from 'react'
import { createModel, listModels, listSystemConfigs, updateSystemConfig, updateModel } from '../services/api'
import { Layout, Card, Table, Input, Select, Button, Form, Tag, Typography, message, Tabs, Divider } from 'antd'
import { PlusOutlined, ReloadOutlined, SaveOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'

function ModelConfig() {
  const [items, setItems] = useState<any[]>([])
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingData, setEditingData] = useState<any>({})

  useEffect(()=>{ load() }, [])

  const load = () => {
    setLoading(true)
    listModels().then(setItems).catch(message.error).finally(()=>setLoading(false))
  }

  const submit = async (values: any) => {
    setLoading(true)
    try {
      await createModel({ 
        name: values.name, 
        type: values.type, 
        endpoint_id: values.endpoint_id, 
        concurrency_quota: Number(values.concurrency_quota), 
        request_quota: Number(values.request_quota) 
      })
      message.success('模型创建成功')
      form.resetFields()
      const m = await listModels()
      setItems(m)
    } catch {
      message.error('创建失败')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (record: any) => {
    setEditingId(record.id)
    setEditingData({ ...record })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingData({})
  }

  const handleSaveEdit = async (record: any) => {
    try {
      await updateModel(record.id, { 
          ...record, 
          endpoint_id: editingData.endpoint_id,
          concurrency_quota: Number(editingData.concurrency_quota),
          request_quota: Number(editingData.request_quota)
      })
      message.success('更新成功')
      setEditingId(null)
      load() // Refresh list
    } catch {
      message.error('更新失败')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 50, render: (t: any) => <span style={{ color: '#ccc' }}>{t}</span> },
    { 
        title: '模型名称', 
        dataIndex: 'name', 
        render: (t: string, record: any) => {
            const isEditing = editingId === record.id
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 500, color: '#fff' }}>{t}</span>
                    {isEditing ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                             <Button 
                                type="text" 
                                size="small" 
                                icon={<SaveOutlined />} 
                                style={{ color: '#52c41a' }} 
                                onClick={() => handleSaveEdit(record)}
                            />
                            <Button 
                                type="text" 
                                size="small" 
                                icon={<CloseOutlined />} 
                                style={{ color: '#ff4d4f' }} 
                                onClick={handleCancelEdit}
                            />
                        </div>
                    ) : (
                        <Button 
                            type="text" 
                            size="small" 
                            icon={<EditOutlined />} 
                            style={{ color: '#1890ff', opacity: 0.8 }} 
                            onClick={() => handleEdit(record)}
                        />
                    )}
                </div>
            )
        }
    },
    { title: '类型', dataIndex: 'type', width: 80, render: (t: string) => <Tag color={t === 'image' ? 'blue' : 'purple'}>{t}</Tag> },
    { 
        title: 'Endpoint ID', 
        dataIndex: 'endpoint_id', 
        ellipsis: true, 
        render: (t: string, record: any) => {
            if (editingId === record.id) {
                return (
                    <Input 
                        value={editingData.endpoint_id} 
                        onChange={e => setEditingData({ ...editingData, endpoint_id: e.target.value })}
                        size="small"
                        style={{ background: '#1f1f22', border: '1px solid #333', color: '#fff' }}
                    />
                )
            }
            return <span style={{ color: '#ccc' }}>{t}</span>
        }
    },
    { 
        title: '并发', 
        dataIndex: 'concurrency_quota', 
        width: 80,
        render: (t: any, record: any) => {
            if (editingId === record.id) {
                return (
                    <Input 
                        type="number"
                        value={editingData.concurrency_quota} 
                        onChange={e => setEditingData({ ...editingData, concurrency_quota: e.target.value })}
                        size="small"
                        style={{ background: '#1f1f22', border: '1px solid #333', color: '#fff' }}
                    />
                )
            }
            return <span style={{ color: '#ccc' }}>{t}</span>
        }
    },
    { 
        title: '配额', 
        dataIndex: 'request_quota', 
        width: 80,
        render: (t: any, record: any) => {
            if (editingId === record.id) {
                return (
                    <Input 
                        type="number"
                        value={editingData.request_quota} 
                        onChange={e => setEditingData({ ...editingData, request_quota: e.target.value })}
                        size="small"
                        style={{ background: '#1f1f22', border: '1px solid #333', color: '#fff' }}
                    />
                )
            }
            return <span style={{ color: '#ccc' }}>{t}</span>
        }
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24, height: '100%' }}>
        {/* Left: Create Form */}
        <Card style={{ background: '#2a2a2d', border: '1px solid #333', height: 'fit-content' }} title={<span style={{ color: '#fff' }}>新增模型配置</span>}>
            <Form form={form} layout="vertical" onFinish={submit} initialValues={{ type: 'image', concurrency_quota: 1, request_quota: 100 }}>
                <Form.Item name="name" label={<span style={{ color: '#ccc' }}>模型名称</span>} rules={[{ required: true }]}>
                    <Input placeholder="例如: Seedream 4.5" style={{ background: '#1f1f22', border: '1px solid #333', color: '#fff' }} />
                </Form.Item>
                <Form.Item name="type" label={<span style={{ color: '#ccc' }}>模型类型</span>} rules={[{ required: true }]}>
                    <Select 
                        style={{ width: '100%' }}
                        options={[
                            { label: '生图 (Image)', value: 'image' },
                            { label: '生视频 (Video)', value: 'video' }
                        ]}
                    />
                </Form.Item>
                <Form.Item name="endpoint_id" label={<span style={{ color: '#ccc' }}>Endpoint ID</span>} rules={[{ required: true }]}>
                    <Input placeholder="ep-2025..." style={{ background: '#1f1f22', border: '1px solid #333', color: '#fff' }} />
                </Form.Item>
                <div style={{ display: 'flex', gap: 16 }}>
                    <Form.Item name="concurrency_quota" label={<span style={{ color: '#ccc' }}>并发配额</span>} style={{ flex: 1 }}>
                        <Input type="number" style={{ background: '#1f1f22', border: '1px solid #333', color: '#fff' }} />
                    </Form.Item>
                    <Form.Item name="request_quota" label={<span style={{ color: '#ccc' }}>总请求配额</span>} style={{ flex: 1 }}>
                        <Input type="number" style={{ background: '#1f1f22', border: '1px solid #333', color: '#fff' }} />
                    </Form.Item>
                </div>
                <Button type="primary" htmlType="submit" block icon={<PlusOutlined />} loading={loading} size="large" style={{ marginTop: 12 }}>
                    添加模型
                </Button>
            </Form>
        </Card>

        {/* Right: Table */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Typography.Title level={5} style={{ color: '#888', margin: 0 }}>模型列表</Typography.Title>
                <Button icon={<ReloadOutlined />} onClick={load} size="small" type="text" style={{ color: '#888' }}>刷新</Button>
            </div>
            <Card style={{ background: '#2a2a2d', border: '1px solid #333', flex: 1 }} styles={{ body: { padding: 0 } }}>
                <Table 
                    dataSource={items} 
                    columns={columns} 
                    rowKey="id" 
                    pagination={false}
                    loading={loading}
                    style={{ background: 'transparent' }}
                />
            </Card>
        </div>
    </div>
  )
}

function SystemConfig() {
    const [form] = Form.useForm()
    const [loading, setLoading] = useState(false)
  
    useEffect(() => {
      load()
    }, [])
  
    const load = async () => {
      setLoading(true)
      try {
          const configs = await listSystemConfigs()
          const map: any = {}
          configs.forEach((c: any) => map[c.key] = c.value)
          form.setFieldsValue(map)
      } catch {
          message.error('加载配置失败')
      } finally {
          setLoading(false)
      }
    }
  
    const save = async (values: any) => {
      setLoading(true)
      try {
          const ps = Object.keys(values).map(key => updateSystemConfig({ key, value: values[key] }))
          await Promise.all(ps)
          message.success('配置已保存并应用')
      } catch {
          message.error('保存失败')
      } finally {
          setLoading(false)
      }
    }
  
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', paddingTop: 24, paddingBottom: 48 }}>
          <Form form={form} layout="vertical" onFinish={save}>
              <Typography.Title level={5} style={{ color: '#fff', marginBottom: 24 }}>Volcengine 配置</Typography.Title>
              <Card style={{ background: '#2a2a2d', border: '1px solid #333', marginBottom: 32 }}>
                <Form.Item name="volc_api_key" label={<span style={{ color: '#ccc' }}>API Key</span>} tooltip="Volcengine Ark API Key">
                    <Input.Password style={{ background: '#1f1f22', border: '1px solid #333', color: '#fff' }} placeholder="从火山引擎控制台获取" />
                </Form.Item>
              </Card>
              
              <Typography.Title level={5} style={{ color: '#fff', marginBottom: 24 }}>对象存储配置 (Object Storage)</Typography.Title>
              <Card style={{ background: '#2a2a2d', border: '1px solid #333' }}>
                <Form.Item name="storage_type" label={<span style={{ color: '#ccc' }}>存储类型</span>}>
                     <Select 
                        style={{ width: '100%' }}
                        options={[
                            { label: '本地存储 (Local)', value: 'local' },
                            { label: 'S3 兼容存储 (AWS/MinIO)', value: 's3' },
                            { label: '阿里云 OSS', value: 'oss' },
                            { label: '火山引擎 TOS', value: 'tos' }
                        ]}
                    />
                </Form.Item>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Form.Item name="storage_endpoint" label={<span style={{ color: '#ccc' }}>Endpoint</span>}>
                        <Input placeholder="https://..." style={{ background: '#1f1f22', border: '1px solid #333', color: '#fff' }} />
                    </Form.Item>
                    <Form.Item name="storage_bucket" label={<span style={{ color: '#ccc' }}>Bucket Name</span>}>
                        <Input style={{ background: '#1f1f22', border: '1px solid #333', color: '#fff' }} />
                    </Form.Item>
                    <Form.Item name="storage_region" label={<span style={{ color: '#ccc' }}>Region</span>}>
                        <Input style={{ background: '#1f1f22', border: '1px solid #333', color: '#fff' }} />
                    </Form.Item>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Form.Item name="storage_ak" label={<span style={{ color: '#ccc' }}>Access Key ID</span>}>
                        <Input style={{ background: '#1f1f22', border: '1px solid #333', color: '#fff' }} />
                    </Form.Item>
                    <Form.Item name="storage_sk" label={<span style={{ color: '#ccc' }}>Secret Access Key</span>}>
                        <Input.Password style={{ background: '#1f1f22', border: '1px solid #333', color: '#fff' }} />
                    </Form.Item>
                </div>
              </Card>
  
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} size="large" style={{ marginTop: 24, width: 200 }}>
                  保存并应用配置
              </Button>
          </Form>
      </div>
    )
}

export default function AdminConfig() {
    return (
        <Layout style={{ height: '100%', background: 'transparent', padding: 24 }}>
             <Tabs 
                className="full-height-tabs"
                defaultActiveKey="1" 
                style={{ height: '100%' }}
                items={[
                    { key: '1', label: '模型配置', children: <div style={{ height: '100%', overflow: 'hidden' }}><ModelConfig /></div> },
                    { key: '2', label: '系统设置', children: <div style={{ height: '100%', overflowY: 'auto' }}><SystemConfig /></div> },
                ]} 
            />
        </Layout>
    )
}
