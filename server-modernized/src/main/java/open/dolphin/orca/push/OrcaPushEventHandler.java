package open.dolphin.orca.push;

import open.dolphin.orca.push.dto.OrcaPushEventData;

public interface OrcaPushEventHandler {
    void handle(String facilityId, OrcaPushEventData eventData);
}
