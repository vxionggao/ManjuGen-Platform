import React, { useState, useEffect } from 'react';
import { Card, Tabs, Typography, Input, Space, Tag, Button, Empty, Spin } from 'antd';
import { SearchOutlined, PlusOutlined } from '@ant-design/icons';
import { listAssets, searchAssets } from '../services/api';
import { assetChannel } from '../events';

const { TabPane } = Tabs;
const { Title } = Typography;
const { Search } = Input;

const PLACEHOLDER_IMG = "/placeholder.png";

const getImageUrl = (url: string) => {
    if (!url) return PLACEHOLDER_IMG;
    if (url.startsWith('tos://')) {
        try {
            const idx = url.indexOf('/', 6);
            if (idx > 6) {
                const bucket = url.substring(6, idx);
                const key = url.substring(idx + 1);
                return `/api/materials/proxy?bucket=${bucket}&key=${encodeURIComponent(key)}`;
            }
        } catch (e) {
            console.error('Error parsing tos url', e);
        }
    }
    return url;
}

interface Asset {
  id: number;
  asset_id: string;
  name: string;
  type: 'role' | 'scene' | 'style' | 'item';
  aliases: string[];
  description: string;
  tags: string[];
  cover_image: string;
  gallery: string[];
  metadata: any;
  source: 'built_in' | 'user_upload';
  created_at: number;
  updated_at: number;
}

interface MaterialLibraryProps {
  onAssetSelect: (asset: Asset) => void;
  type?: 'role' | 'scene' | 'style' | 'item';
}

export const MaterialLibrary: React.FC<MaterialLibraryProps> = ({ onAssetSelect, type }) => {
  const [activeTab, setActiveTab] = useState<'role' | 'scene' | 'style' | 'item'>(type || 'role');

  useEffect(() => {
    if (type) setActiveTab(type);
  }, [type]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAssets();
    
    const handleUpdate = () => {
        // Refresh current tab
        fetchAssets(); 
    }
    
    window.addEventListener('asset_update', handleUpdate);
    assetChannel.onmessage = handleUpdate;
    
    return () => {
        window.removeEventListener('asset_update', handleUpdate);
        assetChannel.onmessage = null;
    }
  }, [activeTab]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const data = await listAssets(activeTab);
      setAssets(data);
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (value: string) => {
    setSearchQuery(value);
    if (value) {
      setLoading(true);
      try {
        const data = await searchAssets(value, activeTab);
        setAssets(data);
      } catch (error) {
        console.error('Failed to search assets:', error);
      } finally {
        setLoading(false);
      }
    } else {
      fetchAssets();
    }
  };

  const getSourceLabel = (source: string) => {
    return source === 'built_in' ? '内置' : '用户';
  };

  const renderAssetList = (emptyText: string) => (
    <div style={{ padding: '12px 4px' }}>
        {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Spin size="large" />
            </div>
        ) : assets.length === 0 ? (
            <Empty description={<span style={{ color: '#666' }}>{emptyText}</span>} />
        ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
            {assets.map((asset) => (
                <Card
                key={asset.asset_id}
                style={{ background: '#1f1f22', border: '1px solid #333', cursor: 'pointer' }}
                bodyStyle={{ padding: 12 }}
                hoverable
                onClick={() => onAssetSelect(asset)}
                >
                <div style={{ marginBottom: 10 }}>
                    {asset.cover_image ? (
                    <div style={{ width: '100%', height: 80, borderRadius: 4, overflow: 'hidden', backgroundColor: '#2a2a2d' }}>
                        <img
                        src={getImageUrl(asset.cover_image)}
                        alt={asset.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = PLACEHOLDER_IMG;
                        }}
                        />
                    </div>
                    ) : (
                    <div style={{ width: '100%', height: 80, borderRadius: 4, backgroundColor: '#2a2a2d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PlusOutlined style={{ color: '#666' }} />
                    </div>
                    )}
                </div>
                <div style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
                    {asset.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                    {asset.description ? (asset.description.length > 20 ? asset.description.substring(0, 20) + '...' : asset.description) : '无描述'}
                    </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {asset.tags && asset.tags.slice(0, 2).map((tag, index) => (
                    <Tag key={index} style={{ backgroundColor: '#333', color: '#ccc', fontSize: 10 }}>
                        {tag}
                    </Tag>
                    ))}
                    {asset.tags && asset.tags.length > 2 && (
                    <Tag style={{ backgroundColor: '#333', color: '#ccc', fontSize: 10 }}>
                        +{asset.tags.length - 2}
                    </Tag>
                    )}
                </div>
                <div style={{ marginTop: 4, fontSize: 11, color: '#666' }}>
                    {getSourceLabel(asset.source)}
                </div>
                </Card>
            ))}
            </div>
        )}
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Title level={5} style={{ color: '#fff', marginBottom: 12, paddingLeft: 4 }}>素材库</Title>

      <div style={{ marginBottom: 12 }}>
        <Search
          placeholder="搜索素材..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onSearch={handleSearch}
          style={{ background: '#2a2a2d', border: '1px solid #333' }}
          allowClear
        />
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as any)}
        style={{ flex: 1, overflow: 'auto' }}
        tabBarStyle={{ background: '#2a2a2d', borderBottom: '1px solid #333' }}
      >
        <TabPane tab="角色" key="role">
          {renderAssetList('暂无角色素材')}
        </TabPane>
        <TabPane tab="场景" key="scene">
          {renderAssetList('暂无场景素材')}
        </TabPane>
        <TabPane tab="物品" key="item">
          {renderAssetList('暂无物品素材')}
        </TabPane>
        <TabPane tab="风格" key="style">
          {renderAssetList('暂无风格素材')}
        </TabPane>
      </Tabs>
    </div>
  );
};
