export type SoapSectionKey = 'free' | 'subjective' | 'objective' | 'assessment' | 'plan';

export type SoapEntryAction = 'save' | 'update';

export type SoapEntry = {
  id: string;
  section: SoapSectionKey;
  body: string;
  templateId?: string;
  authoredAt: string;
  authorRole: string;
  authorName?: string;
  action: SoapEntryAction;
  baseChartRevisionId?: string;
  contentHash?: string;
  patientId?: string;
  appointmentId?: string;
  receptionId?: string;
  visitDate?: string;
};

export type SoapDraft = Record<SoapSectionKey, string>;

export type SoapTemplate = {
  id: string;
  label: string;
  description?: string;
  sections: Partial<Record<SoapSectionKey, string>>;
};

export const SOAP_SECTIONS: SoapSectionKey[] = ['free', 'subjective', 'objective', 'assessment', 'plan'];

export const SOAP_SECTION_LABELS: Record<SoapSectionKey, string> = {
  free: 'Free',
  subjective: 'Subjective',
  objective: 'Objective',
  assessment: 'Assessment',
  plan: 'Plan',
};

export const SOAP_TEMPLATES: SoapTemplate[] = [
  {
    id: 'TEMP-GENERAL-01',
    label: '一般診療テンプレ',
    description: '汎用的な外来記載テンプレート',
    sections: {
      subjective: '主訴: \n現病歴: \n生活背景: ',
      objective: 'バイタル: \n身体所見: \n検査所見: ',
      assessment: '評価: \n鑑別: ',
      plan: '治療方針: \n処方/検査: \n次回方針: ',
    },
  },
  {
    id: 'TEMP-FOLLOW-01',
    label: 'フォローアップ',
    description: '経過観察用の簡易テンプレ',
    sections: {
      subjective: '前回からの変化: \n自覚症状: ',
      objective: '経過所見: \n検査: ',
      assessment: '経過評価: ',
      plan: '継続/変更点: \n次回予約: ',
    },
  },
  {
    id: 'TEMP-FREE-01',
    label: 'フリー追記',
    description: '自由記載の補助テンプレ',
    sections: {
      free: '自由記載メモ: \n',
    },
  },
];

export const buildSoapEntryId = (section: SoapSectionKey, authoredAt: string) => {
  const nonce = Math.random().toString(36).slice(2, 8);
  return `${section}-${authoredAt}-${nonce}`;
};

export const buildSoapDraftFromHistory = (entries: SoapEntry[]): SoapDraft => {
  const latest = getLatestSoapEntries(entries);
  return {
    free: latest.get('free')?.body ?? '',
    subjective: latest.get('subjective')?.body ?? '',
    objective: latest.get('objective')?.body ?? '',
    assessment: latest.get('assessment')?.body ?? '',
    plan: latest.get('plan')?.body ?? '',
  };
};

export const getLatestSoapEntries = (entries: SoapEntry[]) => {
  const map = new Map<SoapSectionKey, SoapEntry>();
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (!map.has(entry.section)) {
      map.set(entry.section, entry);
    }
  }
  return map;
};

export const formatSoapAuthoredAt = (value?: string) => {
  if (!value) return '記載日時不明';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ja-JP');
};
