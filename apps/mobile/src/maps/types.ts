export type OfflineMapPackState = 'not_downloaded' | 'downloading' | 'complete' | 'error';

export type OfflineMapPack = {
  adventureId: string;
  nativePackId: string | null;
  styleUrl: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusKm: number;
  minZoom: number;
  maxZoom: number;
  state: OfflineMapPackState;
  percentage: number;
  completedResourceCount: number;
  completedResourceSize: number;
  updatedAt: string;
  error: string | null;
};

export type OfflineMapProgress = Pick<
  OfflineMapPack,
  'state' | 'percentage' | 'completedResourceCount' | 'completedResourceSize' | 'error'
>;

export type OfflineMapDownloadInput = {
  adventureId: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
};
