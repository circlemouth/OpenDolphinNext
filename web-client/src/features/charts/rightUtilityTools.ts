import type { OrderGroupKey } from './orderCategoryRegistry';

export type RightUtilityTool = OrderGroupKey;

export const RIGHT_UTILITY_TOOLS: ReadonlyArray<{ tool: RightUtilityTool; label: string }> = [
  { tool: 'prescription', label: '処方' },
  { tool: 'injection', label: '注射' },
  { tool: 'treatment', label: '処置' },
  { tool: 'test', label: '検査' },
  { tool: 'charge', label: '算定' },
];

export const resolveRightUtilityToolLabel = (tool: RightUtilityTool) => {
  const matched = RIGHT_UTILITY_TOOLS.find((item) => item.tool === tool);
  return matched?.label ?? tool;
};
