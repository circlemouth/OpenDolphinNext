package open.orca.rest;

import java.util.List;

final class OrcaMasterDaoTypes {
    private OrcaMasterDaoTypes() {
    }

    static class GenericClassCriteriaBase {
        private String keyword;
        private String effective;
        private int page = 1;
        private int size = 100;
        private boolean includeTotalCount;

        public String getKeyword() {
            return keyword;
        }

        public void setKeyword(String keyword) {
            this.keyword = keyword;
        }

        public String getEffective() {
            return effective;
        }

        public void setEffective(String effective) {
            this.effective = effective;
        }

        public int getPage() {
            return page;
        }

        public void setPage(int page) {
            this.page = page;
        }

        public int getSize() {
            return size;
        }

        public void setSize(int size) {
            this.size = size;
        }

        public boolean isIncludeTotalCount() {
            return includeTotalCount;
        }

        public void setIncludeTotalCount(boolean includeTotalCount) {
            this.includeTotalCount = includeTotalCount;
        }
    }

    static class DrugCriteriaBase {
        private String keyword;
        private String effective;
        private String searchMethod;
        private int page = 1;
        private int size = 100;
        private boolean includeTotalCount;

        public String getKeyword() {
            return keyword;
        }

        public void setKeyword(String keyword) {
            this.keyword = keyword;
        }

        public String getEffective() {
            return effective;
        }

        public void setEffective(String effective) {
            this.effective = effective;
        }

        public String getSearchMethod() {
            return searchMethod;
        }

        public void setSearchMethod(String searchMethod) {
            this.searchMethod = searchMethod;
        }

        public int getPage() {
            return page;
        }

        public void setPage(int page) {
            this.page = page;
        }

        public int getSize() {
            return size;
        }

        public void setSize(int size) {
            this.size = size;
        }

        public boolean isIncludeTotalCount() {
            return includeTotalCount;
        }

        public void setIncludeTotalCount(boolean includeTotalCount) {
            this.includeTotalCount = includeTotalCount;
        }
    }

    static class CommentCriteriaBase {
        private String keyword;
        private String effective;
        private int page = 1;
        private int size = 100;
        private boolean includeTotalCount;

        public String getKeyword() {
            return keyword;
        }

        public void setKeyword(String keyword) {
            this.keyword = keyword;
        }

        public String getEffective() {
            return effective;
        }

        public void setEffective(String effective) {
            this.effective = effective;
        }

        public int getPage() {
            return page;
        }

        public void setPage(int page) {
            this.page = page;
        }

        public int getSize() {
            return size;
        }

        public void setSize(int size) {
            this.size = size;
        }

        public boolean isIncludeTotalCount() {
            return includeTotalCount;
        }

        public void setIncludeTotalCount(boolean includeTotalCount) {
            this.includeTotalCount = includeTotalCount;
        }
    }

    static class GenericPriceCriteriaBase {
        private String srycd;
        private String effective;

        public String getSrycd() {
            return srycd;
        }

        public void setSrycd(String srycd) {
            this.srycd = srycd;
        }

        public String getEffective() {
            return effective;
        }

        public void setEffective(String effective) {
            this.effective = effective;
        }
    }

    static class HokenjaCriteriaBase {
        private String pref;
        private String keyword;
        private String effective;
        private int page = 1;
        private int size = 100;
        private boolean includeTotalCount;

        public String getPref() {
            return pref;
        }

        public void setPref(String pref) {
            this.pref = pref;
        }

        public String getKeyword() {
            return keyword;
        }

        public void setKeyword(String keyword) {
            this.keyword = keyword;
        }

        public String getEffective() {
            return effective;
        }

        public void setEffective(String effective) {
            this.effective = effective;
        }

        public int getPage() {
            return page;
        }

        public void setPage(int page) {
            this.page = page;
        }

        public int getSize() {
            return size;
        }

        public void setSize(int size) {
            this.size = size;
        }

        public boolean isIncludeTotalCount() {
            return includeTotalCount;
        }

        public void setIncludeTotalCount(boolean includeTotalCount) {
            this.includeTotalCount = includeTotalCount;
        }
    }

    static class AddressCriteriaBase {
        private String zip;
        private String effective;

        public String getZip() {
            return zip;
        }

        public void setZip(String zip) {
            this.zip = zip;
        }

        public String getEffective() {
            return effective;
        }

        public void setEffective(String effective) {
            this.effective = effective;
        }
    }

    static class KeywordEffectiveCriteriaBase {
        private String keyword;
        private String effective;

        public String getKeyword() {
            return keyword;
        }

        public void setKeyword(String keyword) {
            this.keyword = keyword;
        }

        public String getEffective() {
            return effective;
        }

        public void setEffective(String effective) {
            this.effective = effective;
        }
    }

    static class GenericClassRecordBase {
        String classCode;
        String className;
        String kanaName;
        String categoryCode;
        String parentClassCode;
        String startDate;
        String endDate;
        String version;

        public String getClassCode() {
            return classCode;
        }

        public String getClassName() {
            return className;
        }

        public String getKanaName() {
            return kanaName;
        }

        public String getCategoryCode() {
            return categoryCode;
        }

        public String getParentClassCode() {
            return parentClassCode;
        }

        public String getStartDate() {
            return startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public String getVersion() {
            return version;
        }
    }

    static class DrugRecordBase {
        String srycd;
        String drugName;
        String kanaName;
        String category;
        String unit;
        Double price;
        String note;
        String startDate;
        String endDate;
        String version;

        public String getSrycd() {
            return srycd;
        }

        public String getDrugName() {
            return drugName;
        }

        public String getKanaName() {
            return kanaName;
        }

        public String getCategory() {
            return category;
        }

        public String getUnit() {
            return unit;
        }

        public Double getPrice() {
            return price;
        }

        public String getNote() {
            return note;
        }

        public String getStartDate() {
            return startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public String getVersion() {
            return version;
        }
    }

    static class GenericPriceRecordBase {
        String srycd;
        String drugName;
        String unit;
        Double price;
        String startDate;
        String endDate;
        String version;

        public String getSrycd() {
            return srycd;
        }

        public String getDrugName() {
            return drugName;
        }

        public String getUnit() {
            return unit;
        }

        public Double getPrice() {
            return price;
        }

        public String getStartDate() {
            return startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public String getVersion() {
            return version;
        }
    }

    static class HokenjaRecordBase {
        String payerCode;
        String payerName;
        String payerType;
        Double payerRatio;
        String prefCode;
        String cityCode;
        String zip;
        String addressLine;
        String phone;
        String validFrom;
        String validTo;
        String version;

        public String getPayerCode() {
            return payerCode;
        }

        public String getPayerName() {
            return payerName;
        }

        public String getPayerType() {
            return payerType;
        }

        public Double getPayerRatio() {
            return payerRatio;
        }

        public String getPrefCode() {
            return prefCode;
        }

        public String getCityCode() {
            return cityCode;
        }

        public String getZip() {
            return zip;
        }

        public String getAddressLine() {
            return addressLine;
        }

        public String getPhone() {
            return phone;
        }

        public String getValidFrom() {
            return validFrom;
        }

        public String getValidTo() {
            return validTo;
        }

        public String getVersion() {
            return version;
        }
    }

    static class AddressRecordBase {
        String zip;
        String prefCode;
        String cityCode;
        String city;
        String town;
        String kana;
        String roman;
        String fullAddress;
        String version;

        public String getZip() {
            return zip;
        }

        public String getPrefCode() {
            return prefCode;
        }

        public String getCityCode() {
            return cityCode;
        }

        public String getCity() {
            return city;
        }

        public String getTown() {
            return town;
        }

        public String getKana() {
            return kana;
        }

        public String getRoman() {
            return roman;
        }

        public String getFullAddress() {
            return fullAddress;
        }

        public String getVersion() {
            return version;
        }
    }

    static class CommentRecordBase {
        String tensuCode;
        String name;
        String kanaName;
        String category;
        String unit;
        String startDate;
        String endDate;
        String version;

        public String getTensuCode() {
            return tensuCode;
        }

        public String getName() {
            return name;
        }

        public String getKanaName() {
            return kanaName;
        }

        public String getCategory() {
            return category;
        }

        public String getUnit() {
            return unit;
        }

        public String getStartDate() {
            return startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public String getVersion() {
            return version;
        }
    }

    static class YouhouRecordBase {
        String youhouCode;
        String youhouName;
        String kanaName;
        String startDate;
        String endDate;
        String version;

        public String getYouhouCode() {
            return youhouCode;
        }

        public String getYouhouName() {
            return youhouName;
        }

        public String getKanaName() {
            return kanaName;
        }

        public String getStartDate() {
            return startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public String getVersion() {
            return version;
        }
    }

    static class MaterialRecordBase {
        String materialCode;
        String materialName;
        String kanaName;
        String category;
        String materialCategory;
        String unit;
        Double price;
        String maker;
        String startDate;
        String endDate;
        String version;

        public String getMaterialCode() {
            return materialCode;
        }

        public String getMaterialName() {
            return materialName;
        }

        public String getKanaName() {
            return kanaName;
        }

        public String getCategory() {
            return category;
        }

        public String getMaterialCategory() {
            return materialCategory;
        }

        public String getUnit() {
            return unit;
        }

        public Double getPrice() {
            return price;
        }

        public String getMaker() {
            return maker;
        }

        public String getStartDate() {
            return startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public String getVersion() {
            return version;
        }
    }

    static class KensaSortRecordBase {
        String kensaCode;
        String kensaName;
        String kanaName;
        String kensaSort;
        String classification;
        String startDate;
        String endDate;
        String version;

        public String getKensaCode() {
            return kensaCode;
        }

        public String getKensaName() {
            return kensaName;
        }

        public String getKanaName() {
            return kanaName;
        }

        public String getKensaSort() {
            return kensaSort;
        }

        public String getClassification() {
            return classification;
        }

        public String getStartDate() {
            return startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public String getVersion() {
            return version;
        }
    }

    static class GenericClassSearchResultBase<T> {
        private final List<T> records;
        private final Integer totalCount;
        private final String version;
        private final OrcaMasterCacheState cacheState;

        GenericClassSearchResultBase(List<T> records, Integer totalCount, String version) {
            this(records, totalCount, version, OrcaMasterCacheState.current("generic-class", version));
        }

        GenericClassSearchResultBase(List<T> records, Integer totalCount, String version,
                OrcaMasterCacheState cacheState) {
            this.records = records;
            this.totalCount = totalCount;
            this.version = version;
            this.cacheState = cacheState;
        }

        public List<T> getRecords() {
            return records;
        }

        public Integer getTotalCount() {
            return totalCount;
        }

        public String getVersion() {
            return version;
        }

        public OrcaMasterCacheState getCacheState() {
            return cacheState;
        }
    }

    static class ListSearchResultBase<T> {
        private final List<T> records;
        private final Integer totalCount;
        private final String version;
        private final OrcaMasterCacheState cacheState;

        ListSearchResultBase(List<T> records, Integer totalCount, String version) {
            this(records, totalCount, version, OrcaMasterCacheState.current("master", version));
        }

        ListSearchResultBase(List<T> records, Integer totalCount, String version, OrcaMasterCacheState cacheState) {
            this.records = records;
            this.totalCount = totalCount;
            this.version = version;
            this.cacheState = cacheState;
        }

        public List<T> getRecords() {
            return records;
        }

        public Integer getTotalCount() {
            return totalCount;
        }

        public String getVersion() {
            return version;
        }

        public OrcaMasterCacheState getCacheState() {
            return cacheState;
        }
    }

    static class LookupResultBase<T> {
        private final T record;
        private final String version;
        private final boolean found;
        private final OrcaMasterCacheState cacheState;

        LookupResultBase(T record, String version, boolean found) {
            this(record, version, found, OrcaMasterCacheState.current("master", version));
        }

        LookupResultBase(T record, String version, boolean found, OrcaMasterCacheState cacheState) {
            this.record = record;
            this.version = version;
            this.found = found;
            this.cacheState = cacheState;
        }

        public T getRecord() {
            return record;
        }

        public String getVersion() {
            return version;
        }

        public boolean isFound() {
            return found;
        }

        public OrcaMasterCacheState getCacheState() {
            return cacheState;
        }
    }

}
