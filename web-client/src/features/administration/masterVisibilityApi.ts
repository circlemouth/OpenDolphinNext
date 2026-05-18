import { httpFetch } from '../../libs/http/httpClient';

const BASE = '/api/admin/master-updates/visibility';

export type MasterVisibilityCategoryCode =
  | 'prescription'
  | 'injection'
  | 'procedure'
  | 'test'
  | 'disease'
  | 'patientSupport';

export type MasterVisibilityCategory = {
  code: MasterVisibilityCategoryCode;
  label: string;
  visible: boolean;
  masterTypes: string[];
  affectedSurfaces: string[];
};

export type PrescriptionDrugSearchMethod = 'prefix' | 'partial';

export type MasterVisibilityResponse = {
  runId?: string;
  generatedAt?: string;
  updatedAt?: string;
  updatedBy?: string;
  defaultsVisible?: boolean;
  prescriptionDrugSearchMethodDefault: PrescriptionDrugSearchMethod;
  categories: MasterVisibilityCategory[];
};

export type MasterVisibilityUpdateResponse = MasterVisibilityResponse & {
  ok?: boolean;
};

export const MASTER_VISIBILITY_CATEGORY_CODES: MasterVisibilityCategoryCode[] = [
  'prescription',
  'injection',
  'procedure',
  'test',
  'disease',
  'patientSupport',
];

export const MASTER_VISIBILITY_QUERY_KEY = ['admin-master-visibility'] as const;

const safeJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const readErrorMessage = (json: unknown, fallback: string) => {
  if (!json || typeof json !== 'object') return fallback;
  const obj = json as Record<string, unknown>;
  if (typeof obj.message === 'string' && obj.message.trim()) return obj.message;
  if (typeof obj.error === 'string' && obj.error.trim()) return obj.error;
  return fallback;
};

const isMasterVisibilityCategoryCode = (value: unknown): value is MasterVisibilityCategoryCode =>
  typeof value === 'string' && MASTER_VISIBILITY_CATEGORY_CODES.includes(value as MasterVisibilityCategoryCode);

const normalizeStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
    : [];

const normalizePrescriptionDrugSearchMethod = (value: unknown): PrescriptionDrugSearchMethod =>
  value === 'partial' ? 'partial' : 'prefix';

const normalizeResponse = (json: unknown): MasterVisibilityResponse => {
  const body = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const categories = Array.isArray(body.categories)
    ? body.categories
        .map((raw): MasterVisibilityCategory | null => {
          if (!raw || typeof raw !== 'object') return null;
          const row = raw as Record<string, unknown>;
          if (!isMasterVisibilityCategoryCode(row.code)) return null;
          return {
            code: row.code,
            label: typeof row.label === 'string' && row.label.trim() ? row.label : row.code,
            visible: typeof row.visible === 'boolean' ? row.visible : true,
            masterTypes: normalizeStringList(row.masterTypes),
            affectedSurfaces: normalizeStringList(row.affectedSurfaces),
          };
        })
        .filter((row): row is MasterVisibilityCategory => Boolean(row))
    : [];
  return {
    runId: typeof body.runId === 'string' ? body.runId : undefined,
    generatedAt: typeof body.generatedAt === 'string' ? body.generatedAt : undefined,
    updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : undefined,
    updatedBy: typeof body.updatedBy === 'string' ? body.updatedBy : undefined,
    defaultsVisible: typeof body.defaultsVisible === 'boolean' ? body.defaultsVisible : true,
    prescriptionDrugSearchMethodDefault: normalizePrescriptionDrugSearchMethod(body.prescriptionDrugSearchMethodDefault),
    categories,
  };
};

const requireOk = async (response: Response): Promise<MasterVisibilityResponse> => {
  const json = await safeJson(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(json, `HTTP ${response.status}`));
  }
  return normalizeResponse(json);
};

export async function fetchMasterVisibility(): Promise<MasterVisibilityResponse> {
  const response = await httpFetch(BASE, { method: 'GET', notifySessionExpired: false });
  return requireOk(response);
}

export async function saveMasterVisibility(
  categories: Partial<Record<MasterVisibilityCategoryCode, boolean>>,
  options?: { prescriptionDrugSearchMethodDefault?: PrescriptionDrugSearchMethod },
): Promise<MasterVisibilityUpdateResponse> {
  const response = await httpFetch(BASE, {
    method: 'PUT',
    notifySessionExpired: false,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ categories, ...options }),
  });
  const normalized = await requireOk(response);
  return { ...normalized, ok: true };
}

export function isMasterCategoryVisible(
  visibility: MasterVisibilityResponse | undefined,
  category: MasterVisibilityCategoryCode,
): boolean {
  const row = visibility?.categories.find((candidate) => candidate.code === category);
  return row?.visible ?? true;
}

export function resolveHiddenMasterCategoryMessage(categoryLabel: string): string {
  return `${categoryLabel}は管理画面のマスタ表示設定で非表示です。候補表示だけを停止し、手入力と既存値は維持します。`;
}
