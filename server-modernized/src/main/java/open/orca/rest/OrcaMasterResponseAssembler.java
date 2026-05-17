package open.orca.rest;

import java.util.List;
import open.dolphin.rest.dto.orca.OrcaMasterListResponse;
import open.dolphin.rest.dto.orca.OrcaMasterMeta;

class OrcaMasterResponseAssembler {

    <T> OrcaMasterListResponse<T> toListResponse(List<T> items, Integer totalCount) {
        return toListResponse(items, totalCount, null);
    }

    <T> OrcaMasterListResponse<T> toListResponse(List<T> items, Integer totalCount, OrcaMasterMeta meta) {
        OrcaMasterListResponse<T> response = new OrcaMasterListResponse<>();
        if (totalCount != null) {
            response.setTotalCount(totalCount);
        }
        response.setItems(items);
        response.setMeta(meta);
        return response;
    }
}
