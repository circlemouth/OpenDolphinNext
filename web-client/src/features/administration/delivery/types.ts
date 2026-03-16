export type DeliverySection =
  | 'dashboard'
  | 'connection'
  | 'config'
  | 'queue'
  | 'operations'
  | 'debug';

export type DeliverySectionItem = {
  id: DeliverySection;
  label: string;
  description: string;
};

export const DELIVERY_SECTION_ITEMS: DeliverySectionItem[] = [
  { id: 'dashboard', label: '概要', description: '運用KPI・異常サマリー' },
  { id: 'connection', label: '接続', description: 'WebORCA接続設定' },
  { id: 'config', label: '配信設定', description: '保存して配信' },
  { id: 'queue', label: '配信キュー', description: 'ORCA queue監視・操作' },
  { id: 'operations', label: '運用監視', description: 'health/readiness・接続状況' },
  { id: 'debug', label: '診断/デバッグ', description: '内製ラッパー疎通確認' },
];
