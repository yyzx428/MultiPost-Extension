import Dexie, { type Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import type { Collection, CollectionItem, GlobalSettings } from './type';

class CollectionDatabase extends Dexie {
  collections!: Table<Collection, string>;
  items!: Table<CollectionItem, string>;
  globalSettings!: Table<GlobalSettings, string>;

  constructor() {
    super('CollectionDatabase');
    this.version(6).stores({
      collections: 'id, title, createdAt, updatedAt',
      items: 'id, collectionId, type, content, context, source, sourceTitle, createdAt, updatedAt, scrollX, scrollY',
      globalSettings: 'key, value',
    });
  }
}

const db = new CollectionDatabase();

export class CollectionService {
  static async addCollection(title: string): Promise<Collection> {
    const newCollection: Collection = {
      id: uuidv4(),
      title,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    };

    await db.collections.add(newCollection);
    return newCollection;
  }

  static async addItemToCollection(
    collectionId: string,
    item: Omit<CollectionItem, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CollectionItem> {
    console.log('addItemToCollection', collectionId, item);
    const newItem: CollectionItem = {
      ...item,
      id: uuidv4(),
      collectionId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.transaction('rw', db.collections, db.items, async () => {
      await db.items.add(newItem);
      await db.collections.update(collectionId, { updatedAt: new Date() });
    });

    return newItem;
  }

  static async getCollections(): Promise<Collection[]> {
    const collections = await db.collections.toArray();
    for (const collection of collections) {
      collection.items = await db.items.where({ collectionId: collection.id }).toArray();
    }
    return collections;
  }

  static async getCollectionById(id: string): Promise<Collection | undefined> {
    const collection = await db.collections.get(id);
    if (collection) {
      collection.items = await db.items.where({ collectionId: id }).toArray();
    }
    return collection;
  }

  static async updateCollection(
    id: string,
    updates: Partial<Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Collection> {
    await db.collections.update(id, { ...updates, updatedAt: new Date() });
    return this.getCollectionById(id) as Promise<Collection>;
  }

  static async deleteCollection(id: string): Promise<void> {
    await db.transaction('rw', db.collections, db.items, async () => {
      await db.items.where({ collectionId: id }).delete();
      await db.collections.delete(id);
    });
  }

  // 添加新的方法来操作全局设置
  static async setGlobalSetting(key: string, value: string): Promise<void> {
    await db.globalSettings.put({ key, value });
  }

  static async getGlobalSetting(key: string): Promise<string | undefined> {
    const setting = await db.globalSettings.get(key);
    return setting?.value;
  }

  // 添加一个方法来设置当前选择的收藏夹
  static async setCurrentCollection(collectionId: string): Promise<void> {
    await this.setGlobalSetting('currentCollectionId', collectionId);
  }

  // 添加一个方法来获取当前选择的收藏夹
  static async getCurrentCollection(): Promise<Collection | undefined> {
    const currentCollectionId = await this.getGlobalSetting('currentCollectionId');
    if (currentCollectionId) {
      return this.getCollectionById(currentCollectionId);
    }
    return undefined;
  }

  static async deleteItemFromCollection(collectionId: string, itemId: string): Promise<void> {
    const collection = await this.getCollectionById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }
    collection.items = collection.items.filter((item) => item.id !== itemId);
    await this.updateCollection(collectionId, collection);
  }
}
