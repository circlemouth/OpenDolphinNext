import type { PatientRecord } from './api';

export type PatientOperation = 'create' | 'update' | 'delete';

export type PatientValidationError = {
  field?: keyof PatientRecord | 'form';
  message: string;
  kind?: 'missing' | 'format' | 'blocked';
};

const isIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
};

const isKatakanaLike = (value: string) => {
  // 全角カナ + 長音 + 空白（全角/半角）を許容
  return /^[ァ-ヶー\u3000 \t]+$/.test(value);
};

export type PatientValidationContext = {
  masterOk?: boolean;
};

export function validatePatientMutation(params: {
  patient: PatientRecord;
  operation: PatientOperation;
  context?: PatientValidationContext;
}): PatientValidationError[] {
  const { patient, operation, context } = params;
  const errors: PatientValidationError[] = [];

  if (context?.masterOk === false) {
    errors.push({
      field: 'form',
      message: 'マスタ未準備（missingMaster/fallbackUsed/非serverルート）: 患者更新はブロックされます。',
      kind: 'blocked',
    });
    return errors;
  }

  const patientId = (patient.patientId ?? '').trim();
  const name = (patient.name ?? '').trim();
  const kana = (patient.kana ?? '').trim();
  const birthDate = (patient.birthDate ?? '').trim();
  const sex = (patient.sex ?? '').trim();
  const phone = (patient.phone ?? '').trim();
  const zip = (patient.zip ?? '').trim();

  if (operation === 'delete') {
    if (!patientId) {
      errors.push({ field: 'patientId', message: '削除には患者IDが必要です。', kind: 'missing' });
    }
    return errors;
  }

  if (operation === 'update' && !patientId) {
    errors.push({ field: 'patientId', message: '患者ID（ORCA患者番号）は必須です。', kind: 'missing' });
  }

  if (!name) {
    errors.push({ field: 'name', message: '氏名は必須です。', kind: 'missing' });
  }

  if (patientId && !/^\d{1,16}$/.test(patientId)) {
    errors.push({ field: 'patientId', message: '患者IDは数字のみ・最大16桁で入力してください。', kind: 'format' });
  }

  if (kana && !isKatakanaLike(kana)) {
    errors.push({ field: 'kana', message: 'カナは全角カタカナ（長音・空白可）で入力してください。', kind: 'format' });
  }

  if (birthDate && !isIsoDate(birthDate)) {
    errors.push({ field: 'birthDate', message: '生年月日は YYYY-MM-DD 形式で入力してください。', kind: 'format' });
  }

  if (sex && !['M', 'F'].includes(sex)) {
    errors.push({ field: 'sex', message: '性別は M/F のいずれかを選択してください。', kind: 'format' });
  }

  if (phone && !/^[0-9()+\-\s]{6,24}$/.test(phone)) {
    errors.push({
      field: 'phone',
      message: '電話番号は数字/括弧/ハイフン/空白のみで6〜24文字です。',
      kind: 'format',
    });
  }

  if (zip && !/^\d{3}-?\d{4}$/.test(zip)) {
    errors.push({ field: 'zip', message: '郵便番号は 123-4567 形式（ハイフン任意）で入力してください。', kind: 'format' });
  }

  return errors;
}
