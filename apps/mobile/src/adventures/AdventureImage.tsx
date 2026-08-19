import { useEffect, useState } from 'react';
import {
  Image,
  ImageBackground,
  type ImageBackgroundProps,
  type ImageProps,
  type ImageSourcePropType,
} from 'react-native';

// Keep the runtime fallback on a strictly validated raster. The older
// default-event JPEG can be recovered by Pillow, but partial JPEG data may
// still render visibly damaged on-device before a build-time repair runs.
const FALLBACK_SOURCE = require('../../assets/trailhead/pathfinder/pathfinder-clear-afternoon.png') as ImageSourcePropType;

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

export function AdventureImageBackground({ uri, onError, resizeMode = 'cover', ...props }: Omit<ImageBackgroundProps, 'source'> & { uri?: string | null }) {
  const { source, markFailed } = useAdventureImageSource(uri);
  return (
    <ImageBackground
      {...props}
      source={source}
      resizeMode={resizeMode}
      onError={(event) => { markFailed(); onError?.(event); }}
    />
  );
}
