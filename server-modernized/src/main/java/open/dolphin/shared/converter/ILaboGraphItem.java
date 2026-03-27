package open.dolphin.shared.converter;

import java.util.ArrayList;
import java.util.List;

public class ILaboGraphItem<T extends ILaboValue> {

    private String itemCode;
    private String itemName;
    private String normalValue;
    private String unit;
    private List<T> results;

    public String getItemCode() {
        return itemCode;
    }

    public void setItemCode(String itemCode) {
        this.itemCode = itemCode;
    }

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }

    public String getNormalValue() {
        return normalValue;
    }

    public void setNormalValue(String normalValue) {
        this.normalValue = normalValue;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public List<T> getResults() {
        return results == null ? null : new ArrayList<>(results);
    }

    public void setResults(List<T> results) {
        this.results = results == null ? null : new ArrayList<>(results);
    }

    public void addValue(T value) {
        if (results == null) {
            results = new ArrayList();
        }
        results.add(value);
    }
}
