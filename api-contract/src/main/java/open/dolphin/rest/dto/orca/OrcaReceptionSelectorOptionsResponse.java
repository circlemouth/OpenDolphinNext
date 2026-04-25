package open.dolphin.rest.dto.orca;

import java.util.ArrayList;
import java.util.List;

public class OrcaReceptionSelectorOptionsResponse extends OrcaApiResponse {

    private final List<SelectorOption> departments = new ArrayList<>();
    private final List<SelectorOption> physicians = new ArrayList<>();

    public List<SelectorOption> getDepartments() {
        return departments;
    }

    public List<SelectorOption> getPhysicians() {
        return physicians;
    }

    public static class SelectorOption {
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
