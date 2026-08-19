import { useEffect, useState } from 'react';
import {
  Image,
  ImageBackground,
  type ImageBackgroundProps,
  type ImageProps,
  type ImageSourcePropType,
} from 'react-native';

const FALLBACK_SOURCE = require('../../assets/explore/default-event.jpg') as ImageSourcePropType;

function useAdventureImageSource(uri?: string | null) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const source: ImageSourcePropType = uri && !failed ? { uri } : FALLBACK_SOURCE;
  return { source, markFailed: () => setFailed(true) };
}

export function AdventureImage({ uri, onError, ...props }: Omit<ImageProps, 'source'> & { uri?: string | null }) {
  const { source, markFailed } = useAdventureImageSource(uri);
  return <Image {...props} source={source} onError={(event) => { markFailed(); onError?.(event); }} />;
}

export function AdventureImageBackground({ uri, onError, ...props }: Omit<ImageBackgroundProps, 'source'> & { uri?: string | null }) {
  const { source, markFailed } = useAdventureImageSource(uri);
  return <ImageBackground {...props} source={source} onError={(event) => { markFailed(); onError?.(event); }} />;
}
