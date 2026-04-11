package open.dolphin.rest.dto.orca;

import java.util.ArrayList;
import java.util.List;

public class OrcaMedicalInformationListResponse extends OrcaApiResponse {

    private String requestNumber;
    private final List<MedicalInformationOption> items = new ArrayList<>();

    public String getRequestNumber() {
        return requestNumber;
    }

    public void setRequestNumber(String requestNumber) {
        this.requestNumber = requestNumber;
    }

    public List<MedicalInformationOption> getItems() {
        return items;
    }

    public static class MedicalInformationOption {
        private String code;
        private String name;

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }
    }
}
