package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class BacteriaOrderMetadata {

    private CarrierComment specimen;
    private List<CarrierComment> carrierComments = new ArrayList<>();

    public CarrierComment getSpecimen() {
        return specimen;
    }

    public void setSpecimen(CarrierComment specimen) {
        this.specimen = specimen;
    }

    public List<CarrierComment> getCarrierComments() {
        return carrierComments;
    }

    public void setCarrierComments(List<CarrierComment> carrierComments) {
        this.carrierComments = carrierComments;
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CarrierComment {
        private String role;
        private String code;
        private String name;
        private String inputValue;
        private String category;
        private String itemNumber;
        private String itemNumberBranch;

        public String getRole() {
            return role;
        }

        public void setRole(String role) {
            this.role = role;
        }

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

        public String getInputValue() {
            return inputValue;
        }

        public void setInputValue(String inputValue) {
            this.inputValue = inputValue;
        }

        public String getCategory() {
            return category;
        }

        public void setCategory(String category) {
            this.category = category;
        }

        public String getItemNumber() {
            return itemNumber;
        }

        public void setItemNumber(String itemNumber) {
            this.itemNumber = itemNumber;
        }

        public String getItemNumberBranch() {
            return itemNumberBranch;
        }

        public void setItemNumberBranch(String itemNumberBranch) {
            this.itemNumberBranch = itemNumberBranch;
        }
    }
}
