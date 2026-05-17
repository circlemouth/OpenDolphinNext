package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrcaMasterListResponse<T> {

    private Integer totalCount;
    private List<T> items;
    private OrcaMasterMeta meta;

    public Integer getTotalCount() {
        return totalCount;
    }

    public void setTotalCount(Integer totalCount) {
        this.totalCount = totalCount;
    }

    public List<T> getItems() {
        return items;
    }

    public void setItems(List<T> items) {
        this.items = items;
    }

    public OrcaMasterMeta getMeta() {
        return meta;
    }

    public void setMeta(OrcaMasterMeta meta) {
        this.meta = meta;
    }
}
