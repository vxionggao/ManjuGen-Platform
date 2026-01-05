import React from 'react';
import { useCachedAsset } from '../hooks/useCachedAsset';
import { Spin } from 'antd';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  cacheKey: string;
}

export const CachedImage: React.FC<CachedImageProps> = ({ src, cacheKey, style, ...props }) => {
  const { src: cachedSrc, loading } = useCachedAsset(src, cacheKey);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
        <Spin size="small" />
      </div>
    );
  }

  return <img src={cachedSrc || src} style={style} {...props} />;
};

interface CachedVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
  cacheKey: string;
}

export const CachedVideo: React.FC<CachedVideoProps> = ({ src, cacheKey, style, ...props }) => {
  const { src: cachedSrc, loading } = useCachedAsset(src, cacheKey);

  // Video might not need a loader spinner as it has its own controls/loading state usually,
  // but if we are fetching the blob first, it won't show anything.
  // So a spinner is good.
  
  if (loading) {
     return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', ...style }}>
        <Spin size="large" />
      </div>
    );
  }

  return <video src={cachedSrc || src} style={style} {...props} />;
};
