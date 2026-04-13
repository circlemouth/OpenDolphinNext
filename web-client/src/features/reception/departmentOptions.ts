const normalizeDepartmentLabel = (value?: string, code?: string) => {
  const trimmed = value?.trim();
  if (trimmed && trimmed !== code) return trimmed;
  return code?.trim() ?? '';
};

const appendDepartmentOption = (
  target: Map<string, string>,
  departmentLabels: ReadonlyMap<string, string>,
  code?: string,
  name?: string,
) => {
  const normalizedCode = code?.trim();
  if (!normalizedCode || target.has(normalizedCode)) return;
  const mappedName = departmentLabels.get(normalizedCode);
  const resolvedLabel =
    mappedName !== undefined
      ? normalizeDepartmentLabel(mappedName, normalizedCode)
      : normalizeDepartmentLabel(name, normalizedCode);
  target.set(normalizedCode, resolvedLabel);
};

export const buildDepartmentOptions = ({
  departmentLabels,
  visibleEntries,
  selectedDepartmentCode,
}: {
  departmentLabels: ReadonlyMap<string, string>;
  visibleEntries: Array<{ departmentCode?: string; department?: string }>;
  selectedDepartmentCode?: string;
}): Array<[string, string]> => {
  const byCode = new Map<string, string>();

  departmentLabels.forEach((name, code) => {
    appendDepartmentOption(byCode, departmentLabels, code, name);
  });

  visibleEntries.forEach((entry) => {
    appendDepartmentOption(byCode, departmentLabels, entry.departmentCode, entry.department);
  });

  appendDepartmentOption(byCode, departmentLabels, selectedDepartmentCode, departmentLabels.get(selectedDepartmentCode?.trim() ?? ''));

  return Array.from(byCode.entries())
    .sort(([aCode, aName], [bCode, bName]) => `${aCode} ${aName}`.localeCompare(`${bCode} ${bName}`, 'ja'))
    .slice(0, 200);
};
