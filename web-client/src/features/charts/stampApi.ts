import { httpFetch } from '../../libs/http/httpClient';
import { generateRunId, getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';
import { resolveCanonicalOrderEntity } from './orderCategoryRegistry';

export type UserProfileResult = {
  ok: boolean;
  runId?: string;
  status?: number;
  id?: number;
  userId?: string;
  message?: string;
};

export type StampTreeEntry = {
  name: string;
  role?: string;
  entity: string;
  memo?: string;
  stampId: string;
};

export type StampTree = {
  treeName?: string;
  entity: string;
  treeOrder?: string;
  stampList: StampTreeEntry[];
};

export type StampTreeResult = {
  ok: boolean;
  runId?: string;
  status?: number;
  trees: StampTree[];
  message?: string;
};

export type StampBundleItemJson = {
  name?: string;
  number?: string;
  unit?: string;
  memo?: string;
};

export type StampBundleJson = {
  className?: string;
  classCode?: string;
  classCodeSystem?: string;
  admin?: string;
  adminCode?: string;
  adminCodeSystem?: string;
  adminMemo?: string;
  bundleNumber?: string;
  memo?: string;
  insurance?: string;
  orderName?: string;
  claimItem?: StampBundleItemJson[];
  diagnosis?: string;
  diagnosisCode?: string;
  diagnosisCodeSystem?: string;
  text?: string;
};

export type StampDetailResult = {
  ok: boolean;
  runId?: string;
  status?: number;
  stampId: string;
  stamp?: StampBundleJson;
  message?: string;
};

const TREE_ORDER = [
  'diagnosis',
  'baseChargeOrder',
  'instractionChargeOrder',
  'medOrder',
  'injectionOrder',
  'treatmentOrder',
  'surgeryOrder',
  'testOrder',
  'physiologyOrder',
  'bacteriaOrder',
  'radiologyOrder',
  'otherOrder',
  'path',
  'text',
] as const;

const buildStatusMessage = (status: number, fallback: string) => {
  if (status === 403) return 'サーバースタンプの参照権限がありません。';
  if (status === 404) return 'サーバースタンプが見つかりません。';
  if (status >= 500) return 'サーバースタンプの取得に失敗しました。';
  return fallback;
};

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    try {
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }
};

const parseString = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);
const parseNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const decodeBytesToText = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('<') || trimmed.startsWith('{')) return trimmed;
    try {
      if (typeof atob === 'function') {
        const binary = atob(trimmed);
        return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
      }
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(trimmed, 'base64').toString('utf-8');
      }
    } catch {
      return null;
    }
  }
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'number')) {
    return new TextDecoder().decode(Uint8Array.from(value));
  }
  return null;
};

const parseXmlDocument = (xml: string) => {
  if (typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return null;
  return doc;
};

const resolveTreeOrder = (entity?: string) => {
  if (!entity) return undefined;
  const normalized = resolveCanonicalOrderEntity(entity) ?? entity;
  const index = TREE_ORDER.indexOf(normalized as (typeof TREE_ORDER)[number]);
  if (index < 0) return undefined;
  return String(index).padStart(2, '0');
};

const normalizeStampEntry = (entry: unknown): StampTreeEntry | null => {
  const record = asRecord(entry);
  if (!record) return null;
  const name = parseString(record.name);
  const entity = parseString(record.entity);
  const stampId = parseString(record.stampId);
  if (!name || !entity || !stampId) return null;
  const normalizedEntity = resolveCanonicalOrderEntity(entity) ?? entity;
  return {
    name,
    role: parseString(record.role),
    entity: normalizedEntity,
    memo: parseString(record.memo),
    stampId,
  };
};

const normalizeStampTree = (entry: unknown): StampTree | null => {
  const record = asRecord(entry);
  if (!record) return null;
  const entity = parseString(record.entity);
  if (!entity) return null;
  const normalizedEntity = resolveCanonicalOrderEntity(entity) ?? entity;
  const stampList = Array.isArray(record.stampList)
    ? record.stampList.map(normalizeStampEntry).filter((item): item is StampTreeEntry => item !== null)
    : [];
  return {
    treeName: parseString(record.treeName),
    entity: normalizedEntity,
    treeOrder: parseString(record.treeOrder) ?? resolveTreeOrder(normalizedEntity),
    stampList,
  };
};

const parseStampTreeXml = (xml: string): StampTree[] => {
  const doc = parseXmlDocument(xml);
  if (!doc) return [];
  const roots = Array.from(doc.getElementsByTagName('root'));
  return roots
    .map((root): StampTree | null => {
      const entity = root.getAttribute('entity')?.trim();
      if (!entity) return null;
      const normalizedEntity = resolveCanonicalOrderEntity(entity) ?? entity;
      const stampList = Array.from(root.getElementsByTagName('stampInfo'))
        .map((entry): StampTreeEntry | null => {
          const stampId = entry.getAttribute('stampId')?.trim();
          const name = entry.getAttribute('name')?.trim();
          if (!stampId || !name) return null;
          return {
            name,
            role: entry.getAttribute('role')?.trim() || undefined,
            entity: resolveCanonicalOrderEntity(entry.getAttribute('entity')?.trim() || normalizedEntity) ?? (entry.getAttribute('entity')?.trim() || normalizedEntity),
            memo: entry.getAttribute('memo')?.trim() || undefined,
            stampId,
          };
        })
        .filter((entry): entry is StampTreeEntry => entry !== null);
      return {
        treeName: root.getAttribute('name')?.trim() || '（未分類）',
        entity: normalizedEntity,
        treeOrder: resolveTreeOrder(normalizedEntity),
        stampList,
      };
    })
    .filter((entry): entry is StampTree => entry !== null);
};

const normalizeTreeResponse = (payload: unknown): StampTree[] => {
  const record = asRecord(payload) ?? {};
  const directList = Array.isArray(record.stampTreeList)
    ? record.stampTreeList.map(normalizeStampTree).filter((entry): entry is StampTree => entry !== null)
    : [];
  if (directList.length > 0) return directList;

  const fromBytes = [
    asRecord(record.personalTree),
    ...(Array.isArray(record.subscribedList) ? record.subscribedList.map(asRecord).filter(Boolean) : []),
  ]
    .flatMap((tree) => {
      const xml = decodeBytesToText(tree?.treeBytes) ?? parseString(tree?.treeXml);
      return xml ? parseStampTreeXml(xml) : [];
    });

  return fromBytes;
};

type LegacyBeanValue = string | number | boolean | null | LegacyBean | LegacyBeanValue[];
type LegacyBean = { __class?: string; [key: string]: LegacyBeanValue | undefined };

const firstElementChild = (element: Element) => {
  for (const child of Array.from(element.children)) {
    return child;
  }
  return null;
};

const parseLegacyBeanNode = (node: Element): LegacyBeanValue => {
  const tagName = node.tagName;
  if (tagName === 'null') return null;
  if (tagName === 'string') return node.textContent ?? '';
  if (tagName === 'boolean') return (node.textContent ?? '').trim() === 'true';
  if (tagName === 'int' || tagName === 'long' || tagName === 'float' || tagName === 'double') {
    const value = Number(node.textContent ?? '');
    return Number.isFinite(value) ? value : 0;
  }
  if (tagName === 'array') {
    const items = Array.from(node.children)
      .filter((child) => child.tagName === 'void')
      .map((child) => {
        const value = firstElementChild(child);
        return value ? parseLegacyBeanNode(value) : null;
      });
    return items;
  }
  if (tagName === 'object') {
    const bean: LegacyBean = { __class: parseString(node.getAttribute('class') ?? undefined) };
    Array.from(node.children)
      .filter((child) => child.tagName === 'void')
      .forEach((child) => {
        const property = child.getAttribute('property');
        if (!property) return;
        const valueNode = firstElementChild(child);
        bean[property] = valueNode ? parseLegacyBeanNode(valueNode) : null;
      });
    return bean;
  }
  return node.textContent ?? '';
};

const parseLegacyStampBean = (xml: string): LegacyBean | null => {
  const doc = parseXmlDocument(xml);
  if (!doc) return null;
  const objectNode = doc.querySelector('java > object, object');
  if (!objectNode) return null;
  const bean = parseLegacyBeanNode(objectNode);
  return asRecord(bean) as LegacyBean | null;
};

const toStringValue = (value: LegacyBeanValue | undefined) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
};

const toLegacyClaimItems = (value: LegacyBeanValue | undefined): StampBundleItemJson[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      name: parseString(entry.name),
      number: toStringValue(entry.number as LegacyBeanValue | undefined),
      unit: parseString(entry.unit),
      memo: parseString(entry.memo),
    }));
  return items.length > 0 ? items : undefined;
};

const normalizeStampPayload = (payload: unknown): StampBundleJson | undefined => {
  const record = asRecord(payload);
  if (!record) return undefined;

  if (
    parseString(record.orderName) ||
    parseString(record.className) ||
    Array.isArray(record.claimItem) ||
    parseString(record.diagnosis) ||
    parseString(record.text)
  ) {
    return {
      className: parseString(record.className),
      classCode: parseString(record.classCode),
      classCodeSystem: parseString(record.classCodeSystem),
      admin: parseString(record.admin),
      adminCode: parseString(record.adminCode),
      adminCodeSystem: parseString(record.adminCodeSystem),
      adminMemo: parseString(record.adminMemo),
      bundleNumber: parseString(record.bundleNumber),
      memo: parseString(record.memo),
      insurance: parseString(record.insurance),
      orderName: parseString(record.orderName),
      claimItem: Array.isArray(record.claimItem)
        ? record.claimItem
            .map((item) => asRecord(item))
            .filter((item): item is Record<string, unknown> => Boolean(item))
            .map((item) => ({
              name: parseString(item.name),
              number: toStringValue(item.number as LegacyBeanValue | undefined),
              unit: parseString(item.unit),
              memo: parseString(item.memo),
            }))
        : undefined,
      diagnosis: parseString(record.diagnosis),
      diagnosisCode: parseString(record.diagnosisCode),
      diagnosisCodeSystem: parseString(record.diagnosisCodeSystem),
      text: parseString(record.text),
    };
  }

  const stampXml = decodeBytesToText(record.stampBytes);
  if (!stampXml) return undefined;
  const legacyBean = parseLegacyStampBean(stampXml);
  if (!legacyBean) return undefined;
  const beanClass = parseString(legacyBean.__class);
  if (beanClass?.endsWith('BundleDolphin')) {
    return {
      className: toStringValue(legacyBean.className),
      classCode: toStringValue(legacyBean.classCode),
      classCodeSystem: toStringValue(legacyBean.classCodeSystem),
      admin: toStringValue(legacyBean.admin),
      adminCode: toStringValue(legacyBean.adminCode),
      adminCodeSystem: toStringValue(legacyBean.adminCodeSystem),
      adminMemo: toStringValue(legacyBean.adminMemo),
      bundleNumber: toStringValue(legacyBean.bundleNumber),
      memo: toStringValue(legacyBean.memo),
      insurance: toStringValue(legacyBean.insurance),
      orderName: toStringValue(legacyBean.orderName),
      claimItem: toLegacyClaimItems(legacyBean.claimItem),
    };
  }
  if (beanClass?.endsWith('RegisteredDiagnosisModel')) {
    return {
      diagnosis: toStringValue(legacyBean.diagnosis),
      diagnosisCode: toStringValue(legacyBean.diagnosisCode),
      diagnosisCodeSystem: toStringValue(legacyBean.diagnosisCodeSystem),
    };
  }
  if (beanClass?.endsWith('TextStampModel')) {
    return {
      text: toStringValue(legacyBean.text),
      memo: toStringValue(legacyBean.text),
    };
  }
  return undefined;
};

export async function fetchUserProfile(userName: string): Promise<UserProfileResult> {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  const response = await httpFetch(`/user/${encodeURIComponent(userName)}`);
  const json = (await parseJson(response)) as Record<string, unknown>;
  return {
    ok: response.ok,
    runId,
    status: response.status,
    id: parseNumber(json.id),
    userId: parseString(json.userId),
    message: response.ok ? undefined : parseString(json.message),
  };
}

export async function fetchStampTree(userPk: number): Promise<StampTreeResult> {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  const response = await httpFetch(`/stamp/tree/${encodeURIComponent(String(userPk))}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const payload = await parseJson(response);
  const trees = response.ok ? normalizeTreeResponse(payload) : [];
  return {
    ok: response.ok,
    runId,
    status: response.status,
    trees,
    message: response.ok ? undefined : buildStatusMessage(response.status, 'サーバースタンプ一覧を取得できませんでした。'),
  };
}

export async function fetchStampDetail(stampId: string): Promise<StampDetailResult> {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  const response = await httpFetch(`/stamp/id/${encodeURIComponent(stampId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const payload = await parseJson(response);
  return {
    ok: response.ok,
    runId,
    status: response.status,
    stampId,
    stamp: response.ok ? normalizeStampPayload(payload) : undefined,
    message: response.ok ? undefined : buildStatusMessage(response.status, 'サーバースタンプ詳細を取得できませんでした。'),
  };
}
