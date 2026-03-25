const LEADING_DEPARTMENT_RE = /^(\d{1,3})\s*(.*)$/;

const normalizeDepartmentLabel = (value?: string) => value?.trim() ?? '';

const toDisplayName = (code: string, name?: string) => {
  const normalized = normalizeDepartmentLabel(name);
  return normalized && normalized !== code ? normalized : code;
};

const appendDepartmentOption = (target: Map<string, string>, code?: string, name?: string) => {
  const normalizedCode = code?.trim();
  if (!normalizedCode) return;
  if (target.has(normalizedCode)) return;
  target.set(normalizedCode, toDisplayName(normalizedCode, name));
};

const extractDepartmentOption = (
  value: string | undefined,
  departmentCodeMap: ReadonlyMap<string, string>,
): [string, string] | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const mappedCode = departmentCodeMap.get(trimmed)?.trim();
  if (mappedCode) {
    return [mappedCode, toDisplayName(mappedCode, trimmed)];
  }

  const leadingMatch = trimmed.match(LEADING_DEPARTMENT_RE);
  if (leadingMatch) {
    const code = leadingMatch[1];
    const rawName = leadingMatch[2]?.trim();
    return [code, toDisplayName(code, rawName)];
  }

  if (/^\d+$/.test(trimmed)) {
    return [trimmed, trimmed];
  }

  return undefined;
};

export const buildDepartmentOptions = ({
  departmentCodeMap,
  visibleDepartments,
  selectedDepartment,
}: {
  departmentCodeMap: ReadonlyMap<string, string>;
  visibleDepartments: Array<string | undefined>;
  selectedDepartment?: string;
}): Array<[string, string]> => {
  const byCode = new Map<string, string>();

  departmentCodeMap.forEach((code, name) => {
    appendDepartmentOption(byCode, code, name);
  });

  visibleDepartments.forEach((department) => {
    const option = extractDepartmentOption(department, departmentCodeMap);
    if (!option) return;
    appendDepartmentOption(byCode, option[0], option[1]);
  });

  const selectedOption = extractDepartmentOption(selectedDepartment, departmentCodeMap);
  if (selectedOption) {
    appendDepartmentOption(byCode, selectedOption[0], selectedOption[1]);
  }

  if (byCode.size === 0) {
    byCode.set('01', '01');
  }

  return Array.from(byCode.entries())
    .sort(([aCode, aName], [bCode, bName]) => `${aCode} ${aName}`.localeCompare(`${bCode} ${bName}`, 'ja'))
    .slice(0, 200);
};
