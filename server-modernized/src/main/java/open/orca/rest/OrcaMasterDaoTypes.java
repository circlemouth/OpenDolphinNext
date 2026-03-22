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
        public String classCode;
        public String className;
        public String kanaName;
        public String categoryCode;
        public String parentClassCode;
        public String startDate;
        public String endDate;
        public String version;

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
        public String srycd;
        public String drugName;
        public String kanaName;
        public String category;
        public String unit;
        public Double price;
        public String note;
        public String startDate;
        public String endDate;
        public String version;

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

    static class CommentRecordBase {
        public String tensuCode;
        public String name;
        public String kanaName;
        public String category;
        public String unit;
        public String startDate;
        public String endDate;
        public String version;

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
        public String youhouCode;
        public String youhouName;
        public String kanaName;
        public String startDate;
        public String endDate;
        public String version;

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
        public String materialCode;
        public String materialName;
        public String kanaName;
        public String category;
        public String materialCategory;
        public String unit;
        public Double price;
        public String maker;
        public String startDate;
        public String endDate;
        public String version;

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
        public String kensaCode;
        public String kensaName;
        public String kanaName;
        public String kensaSort;
        public String classification;
        public String startDate;
        public String endDate;
        public String version;

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

        GenericClassSearchResultBase(List<T> records, Integer totalCount, String version) {
            this.records = records;
            this.totalCount = totalCount;
            this.version = version;
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
    }

    static class ListSearchResultBase<T> {
        private final List<T> records;
        private final Integer totalCount;
        private final String version;

        ListSearchResultBase(List<T> records, Integer totalCount, String version) {
            this.records = records;
            this.totalCount = totalCount;
            this.version = version;
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
    }

    static class LookupResultBase<T> {
        private final T record;
        private final String version;
        private final boolean found;

        LookupResultBase(T record, String version, boolean found) {
            this.record = record;
            this.version = version;
            this.found = found;
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
    }

}
