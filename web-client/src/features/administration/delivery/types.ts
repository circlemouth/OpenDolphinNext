export type DeliverySection =
  | 'dashboard'
  | 'connection'
  | 'config'
  | 'queue'
  | 'operations'
  | 'debug';

export type DeliverySectionGroup = 'settings' | 'status' | 'investigation';

export type DeliverySectionItem = {
  id: DeliverySection;
  group: DeliverySectionGroup;
  label: string;
  description: string;
};

export const DELIVERY_SECTION_ITEMS: DeliverySectionItem[] = [
  { id: 'connection', group: 'settings', label: '接続設定', description: 'WebORCA接続設定と接続テスト' },
  { id: 'config', group: 'settings', label: '配信設定', description: '保存して配信' },
  { id: 'dashboard', group: 'status', label: '状態概要', description: '運用KPI・異常サマリー' },
  { id: 'queue', group: 'status', label: '配信キュー', description: 'ORCA queue監視・操作' },
  { id: 'operations', group: 'status', label: '運用監視', description: 'health/readiness・接続状況' },
  { id: 'debug', group: 'investigation', label: '調査・診断', description: '内製ラッパー疎通確認' },
];
