import { useQuery } from '@tanstack/react-query';

import {
  fetchMasterVisibility,
  isMasterCategoryVisible,
  MASTER_VISIBILITY_QUERY_KEY,
  resolveHiddenMasterCategoryMessage,
  type MasterVisibilityCategoryCode,
} from './masterVisibilityApi';

const CATEGORY_LABELS: Record<MasterVisibilityCategoryCode, string> = {
  prescription: '処方候補',
  injection: '注射候補',
  procedure: '処置・手術候補',
  test: '検査候補',
  disease: '病名候補',
  patientSupport: '患者補助候補',
};

export function useMasterVisibilityCategory(category: MasterVisibilityCategoryCode) {
  const query = useQuery({
    queryKey: MASTER_VISIBILITY_QUERY_KEY,
    queryFn: fetchMasterVisibility,
    staleTime: 60_000,
    retry: false,
  });
  const visible = query.isError ? true : isMasterCategoryVisible(query.data, category);
  const categoryLabel =
    query.data?.categories?.find((candidate) => candidate.code === category)?.label ?? CATEGORY_LABELS[category];

  return {
    visible,
    hiddenMessage: resolveHiddenMasterCategoryMessage(categoryLabel),
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
