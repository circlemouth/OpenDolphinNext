export type DocumentType = 'referral' | 'certificate' | 'reply';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  referral: '紹介状',
  certificate: '診断書',
  reply: '返信書',
};

export const DOCUMENT_HISTORY_STORAGE_BASE = 'opendolphin:web-client:charts:document-history';
export const DOCUMENT_HISTORY_STORAGE_VERSION = 'v2';

export type DocumentTemplate = {
  id: string;
  type: DocumentType;
  label: string;
  description: string;
  defaults: Record<string, string>;
};

// 文書テンプレ API の正式仕様が固まるまでは、この暫定型を明示的な front 契約として使う。
export type DocumentTemplateApiItem = {
  templateId: string;
  documentType: DocumentType;
  label: string;
  description?: string;
  defaults?: Record<string, string>;
  version?: string;
  updatedAt?: string;
};

export type DocumentTemplateApiResponse = {
  runId: string;
  templates: DocumentTemplateApiItem[];
};

// 文書出力 API の正式仕様が固まるまでは、この front 契約を明示的に維持する。
export type DocumentOutputRequest = {
  runId: string;
  patientId: string;
  documentId: string;
  templateId: string;
  documentType: DocumentType;
  documentTitle: string;
  documentIssuedAt: string;
  output: 'print' | 'pdf';
  actor: string;
};

export type DocumentOutputResponse = {
  runId: string;
  requestId: string;
  status: 'queued' | 'completed' | 'failed';
  errorMessage?: string;
};

export const DOCUMENT_TEMPLATES: Record<DocumentType, DocumentTemplate[]> = {
  referral: [
    {
      id: 'REF-ODT-STD',
      type: 'referral',
      label: '紹介状（標準）',
      description: '一般外来の紹介状テンプレ（ODT）。',
      defaults: {
        purpose: '精査依頼',
        diagnosis: '主病名を記載',
        body: '既往歴・検査結果・紹介理由を簡潔にまとめてください。',
      },
    },
    {
      id: 'REF-ODT-SURG',
      type: 'referral',
      label: '紹介状（手術依頼）',
      description: '手術依頼向けテンプレ（ODT）。',
      defaults: {
        purpose: '手術依頼',
        diagnosis: '術式検討の主病名を記載',
        body: '術前評価・画像所見・希望事項を記載してください。',
      },
    },
  ],
  certificate: [
    {
      id: 'CERT-ODT-STD',
      type: 'certificate',
      label: '診断書（標準）',
      description: '就労/学校提出向けの診断書テンプレ（ODT）。',
      defaults: {
        diagnosis: '診断名を記載',
        purpose: '提出目的を記載',
        body: '症状・治療経過・注意点をまとめてください。',
      },
    },
    {
      id: 'CERT-ODT-INS',
      type: 'certificate',
      label: '診断書（保険）',
      description: '保険提出用テンプレ（ODT）。',
      defaults: {
        diagnosis: '保険提出用の診断名を記載',
        purpose: '保険申請',
        body: '治療期間・予後・制限事項を記載してください。',
      },
    },
  ],
  reply: [
    {
      id: 'REPLY-ODT-STD',
      type: 'reply',
      label: '返信書（標準）',
      description: '紹介元への返書テンプレ（ODT）。',
      defaults: {
        summary: '診療結果・今後の方針を簡潔にまとめてください。',
      },
    },
    {
      id: 'REPLY-ODT-FU',
      type: 'reply',
      label: '返信書（経過報告）',
      description: '経過報告向けテンプレ（ODT）。',
      defaults: {
        summary: '経過観察の結果と次回予定を記載してください。',
      },
    },
  ],
};

export const getTemplateById = (type: DocumentType, templateId?: string) => {
  if (!templateId) return undefined;
  return DOCUMENT_TEMPLATES[type].find((template) => template.id === templateId);
};
