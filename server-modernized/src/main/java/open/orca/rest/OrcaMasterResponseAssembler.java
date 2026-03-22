package open.orca.rest;

import java.util.List;
import open.dolphin.rest.dto.orca.OrcaMasterListResponse;

class OrcaMasterResponseAssembler {

    <T> OrcaMasterListResponse<T> toListResponse(List<T> items, Integer totalCount) {
        OrcaMasterListResponse<T> response = new OrcaMasterListResponse<>();
        if (totalCount != null) {
            response.setTotalCount(totalCount);
        }
        response.setItems(items);
        return response;
    }
}
