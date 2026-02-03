import { useEffect, useState } from 'react'
import { Card, Button, Input, Select, Modal, Form, message, Tabs, Tag, Popconfirm, Empty, Upload } from 'antd'
import { PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { listBestPractices, createBestPractice, deleteBestPractice, uploadBestPracticeImage } from '../services/api'

const { TextArea } = Input

const isVideo = (url: string) => {
    return /\.(mp4|mov|webm|avi)$/i.test(url)
}

export default function BestPracticeLibrary({ isModalOpen, onClose }: { isModalOpen: boolean, onClose: () => void }) {
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [category, setCategory] = useState('all')
    const [form] = Form.useForm()

    const fetchItems = async () => {
        setLoading(true)
        try {
            const res = await listBestPractices(category === 'all' ? undefined : category)
            setItems(res)
        } catch (e) {
            message.error('Failed to load best practices')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchItems()
    }, [category])

    const handleCreate = async () => {
        try {
            const values = await form.validateFields()
            await createBestPractice(values)
            message.success('Created successfully')
            onClose()
            form.resetFields()
            fetchItems()
        } catch (e: any) {
            console.error("Create Error:", e)
            message.error(`Failed to create: ${e.message}`)
        }
    }

    const handleDelete = async (id: number) => {
        try {
            await deleteBestPractice(id)
            message.success('Deleted successfully')
            fetchItems()
        } catch (e) {
            message.error('Failed to delete')
        }
    }

    const handleLocalUpload = async (file: File) => {
        try {
            const res = await uploadBestPracticeImage(file)
            if (res && res.url) {
                form.setFieldsValue({ url: res.url })
                message.success('Uploaded successfully')
            }
        } catch (e: any) {
            console.error("Upload Error:", e)
            message.error(`Upload failed: ${e.message}`)
        }
        return false
    }

    return (
        <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <Tabs 
                    activeKey={category} 
                    onChange={setCategory}
                    type="card"
                    size="small"
                    items={[
                        { key: 'all', label: '全部' },
                        { key: 'role', label: '角色' },
                        { key: 'scene', label: '场景' },
                        { key: 'item', label: '物品' },
                        { key: 'style', label: '风格' },
                        { key: 'effect', label: '特效' },
                    ]}
                />
            </div>

            {items.length === 0 && !loading && <Empty description="暂无案例" />}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                {items.map(item => (
                    <Card
                        key={item.id}
                        hoverable
                        cover={
                            <div style={{ height: 160, overflow: 'hidden', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isVideo(item.url) ? (
                                    <video 
                                        src={item.url} 
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                        controls
                                    />
                                ) : (
                                    <img 
                                        alt={item.name} 
                                        src={item.url} 
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                        onError={(e) => {
                                            e.currentTarget.onerror = null;
                                            e.currentTarget.src = "/placeholder.png";
                                        }}
                                    />
                                )}
                            </div>
                        }
                        actions={[
                            <Popconfirm title="确认删除?" onConfirm={() => handleDelete(item.id)}>
                                <DeleteOutlined key="delete" />
                            </Popconfirm>
                        ]}
                    >
                        <Card.Meta
                            title={item.name}
                            description={
                                <div>
                                    <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {item.category && item.category.split(',').map((tag: string) => (
                                            <Tag key={tag} color="blue">{tag}</Tag>
                                        ))}
                                        {item.model_name && <Tag color="purple">{item.model_name}</Tag>}
                                    </div>
                                    {item.prompt && (
                                        <div style={{ 
                                            fontSize: 12, 
                                            color: '#888', 
                                            background: '#1f1f22', 
                                            padding: 6, 
                                            borderRadius: 4, 
                                            maxHeight: 60, 
                                            overflowY: 'auto',
                                            wordBreak: 'break-all'
                                        }} title={item.prompt}>
                                            {item.prompt}
                                        </div>
                                    )}
                                </div>
                            }
                        />
                    </Card>
                ))}
            </div>

            <Modal
                title="添加优秀案例"
                open={isModalOpen}
                onOk={handleCreate}
                onCancel={onClose}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
                        <Input placeholder="例如：赛博朋克少女" />
                    </Form.Item>
                    <Form.Item label="图片/视频链接 (URL)" required style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <Form.Item name="url" noStyle rules={[{ required: true, message: '请输入链接' }]}>
                                <Input placeholder="https://..." />
                            </Form.Item>
                            <Upload beforeUpload={handleLocalUpload} showUploadList={false} accept="image/*,video/*">
                                <Button icon={<UploadOutlined />}>本地上传</Button>
                            </Upload>
                        </div>
                    </Form.Item>
                    <Form.Item name="category" label="分类" initialValue={['role']}>
                        <Select mode="multiple">
                            <Select.Option value="role">角色</Select.Option>
                            <Select.Option value="scene">场景</Select.Option>
                            <Select.Option value="item">物品</Select.Option>
                            <Select.Option value="style">风格</Select.Option>
                            <Select.Option value="effect">特效</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="model_name" label="生成模型">
                        <Input placeholder="e.g. Seedance 1.5" />
                    </Form.Item>
                    <Form.Item name="prompt" label="Prompt">
                        <TextArea rows={4} placeholder="生成该图片的 Prompt..." />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    )
}
