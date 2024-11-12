export interface Collection {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  items: CollectionItem[];
}

export type CollectionItemType = 'text';

export interface CollectionItem {
  id: string;
  collectionId: string;
  createdAt: Date;
  updatedAt: Date;
  type: CollectionItemType;
  content: string;
  context?: string;
  source?: string;
  sourceTitle?: string; // 新增字段
  scrollX: number;
  scrollY: number;
}

export interface GlobalSettings {
  key: string;
  value: string;
}
