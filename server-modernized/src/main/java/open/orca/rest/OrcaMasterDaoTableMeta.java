package open.orca.rest;

import java.util.List;

final class OrcaMasterDaoTableMeta {
    private OrcaMasterDaoTableMeta() {
    }

    static final class GenericPriceTableMeta {
        static final GenericPriceTableMeta SUPPORTED_CONTRACT = new GenericPriceTableMeta(
                "TBL_GENERIC_PRICE",
                List.of("srycd", "yakkakjncd"),
                List.of("name"),
                List.of("unit"),
                "price",
                List.of("start_date", "yukostymd"),
                List.of("end_date", "yukoedymd"),
                List.of("upymd")
        );
        final String tableName;
        final List<String> lookupCodeCandidates;
        final List<String> nameCandidates;
        final List<String> unitCandidates;
        final String priceColumn;
        final List<String> startDateCandidates;
        final List<String> endDateCandidates;
        final List<String> versionCandidates;

        private GenericPriceTableMeta(String tableName, List<String> lookupCodeCandidates, List<String> nameCandidates,
                List<String> unitCandidates, String priceColumn, List<String> startDateCandidates,
                List<String> endDateCandidates, List<String> versionCandidates) {
            this.tableName = tableName;
            this.lookupCodeCandidates = lookupCodeCandidates;
            this.nameCandidates = nameCandidates;
            this.unitCandidates = unitCandidates;
            this.priceColumn = priceColumn;
            this.startDateCandidates = startDateCandidates;
            this.endDateCandidates = endDateCandidates;
            this.versionCandidates = versionCandidates;
        }
    }

    static final class GenericClassTableMeta {
        static final GenericClassTableMeta SUPPORTED_CONTRACT = new GenericClassTableMeta(
                "TBL_GENERIC_CLASS",
                "class_code",
                "class_name",
                "kana_name",
                "category_code",
                "parent_class_code",
                "start_date",
                "end_date",
                "upymd"
        );
        final String tableName;
        final String codeColumn;
        final String nameColumn;
        final String kanaColumn;
        final String categoryColumn;
        final String parentColumn;
        final String startDateColumn;
        final String endDateColumn;
        final String versionColumn;

        private GenericClassTableMeta(String tableName, String codeColumn, String nameColumn, String kanaColumn,
                String categoryColumn, String parentColumn, String startDateColumn, String endDateColumn,
                String versionColumn) {
            this.tableName = tableName;
            this.codeColumn = codeColumn;
            this.nameColumn = nameColumn;
            this.kanaColumn = kanaColumn;
            this.categoryColumn = categoryColumn;
            this.parentColumn = parentColumn;
            this.startDateColumn = startDateColumn;
            this.endDateColumn = endDateColumn;
            this.versionColumn = versionColumn;
        }
    }

    static final class DrugTableMeta {
        static final DrugTableMeta SUPPORTED_CONTRACT = new DrugTableMeta(
                "TBL_TENSU_MASTER",
                "srycd",
                "name",
                "kananame",
                "srysyukbn",
                "taniname",
                "ten",
                "yakkakjncd",
                "yukostymd",
                "yukoedymd",
                "upymd"
        );
        final String tableName;
        final String codeColumn;
        final String nameColumn;
        final String kanaColumn;
        final String categoryColumn;
        final String unitColumn;
        final String priceColumn;
        final String noteColumn;
        final String startDateColumn;
        final String endDateColumn;
        final String versionColumn;

        private DrugTableMeta(String tableName, String codeColumn, String nameColumn, String kanaColumn,
                String categoryColumn, String unitColumn, String priceColumn, String noteColumn,
                String startDateColumn, String endDateColumn, String versionColumn) {
            this.tableName = tableName;
            this.codeColumn = codeColumn;
            this.nameColumn = nameColumn;
            this.kanaColumn = kanaColumn;
            this.categoryColumn = categoryColumn;
            this.unitColumn = unitColumn;
            this.priceColumn = priceColumn;
            this.noteColumn = noteColumn;
            this.startDateColumn = startDateColumn;
            this.endDateColumn = endDateColumn;
            this.versionColumn = versionColumn;
        }
    }

    static final class YouhouTableMeta {
        static final YouhouTableMeta SUPPORTED_CONTRACT = new YouhouTableMeta(
                "TBL_YOUHOU",
                "youhoucode",
                "youhouname",
                "kana",
                "start_date",
                "end_date",
                "upymd"
        );
        final String tableName;
        final String codeColumn;
        final String nameColumn;
        final String kanaColumn;
        final String startDateColumn;
        final String endDateColumn;
        final String versionColumn;

        private YouhouTableMeta(String tableName, String codeColumn, String nameColumn, String kanaColumn,
                String startDateColumn, String endDateColumn, String versionColumn) {
            this.tableName = tableName;
            this.codeColumn = codeColumn;
            this.nameColumn = nameColumn;
            this.kanaColumn = kanaColumn;
            this.startDateColumn = startDateColumn;
            this.endDateColumn = endDateColumn;
            this.versionColumn = versionColumn;
        }
    }

    static final class HokenjaTableMeta {
        static final HokenjaTableMeta SUPPORTED_CONTRACT = new HokenjaTableMeta(
                "TBL_HKNJAINF_MASTER",
                "hknjanum",
                "hknjaname",
                "hknjaname_tan1",
                "hknnum",
                "hon_gaikyurate",
                "post",
                "adrs",
                "banti",
                "tel",
                "creymd",
                "upymd"
        );
        final String tableName;
        final String insurerNumberColumn;
        final String nameColumn;
        final String kana1Column;
        final String hknnumColumn;
        final String ratioColumn;
        final String zipColumn;
        final String addressColumn;
        final String addressLineColumn;
        final String phoneColumn;
        final String createdDateColumn;
        final String versionColumn;

        private HokenjaTableMeta(String tableName, String insurerNumberColumn, String nameColumn, String kana1Column,
                String hknnumColumn, String ratioColumn, String zipColumn, String addressColumn,
                String addressLineColumn, String phoneColumn, String createdDateColumn, String versionColumn) {
            this.tableName = tableName;
            this.insurerNumberColumn = insurerNumberColumn;
            this.nameColumn = nameColumn;
            this.kana1Column = kana1Column;
            this.hknnumColumn = hknnumColumn;
            this.ratioColumn = ratioColumn;
            this.zipColumn = zipColumn;
            this.addressColumn = addressColumn;
            this.addressLineColumn = addressLineColumn;
            this.phoneColumn = phoneColumn;
            this.createdDateColumn = createdDateColumn;
            this.versionColumn = versionColumn;
        }
    }

    static final class AddressTableMeta {
        static final AddressTableMeta SUPPORTED_CONTRACT = new AddressTableMeta(
                "TBL_ADRS",
                List.of("post", "zip"),
                List.of("pref_code"),
                List.of("city_code"),
                List.of("cityname", "city"),
                List.of("townname", "town"),
                List.of("editadrs_kana", "kana"),
                List.of("roman"),
                List.of("editadrs_name", "full_address"),
                List.of("rennum"),
                List.of("upymd")
        );
        final String tableName;
        final List<String> zipCandidates;
        final List<String> prefCodeCandidates;
        final List<String> cityCodeCandidates;
        final List<String> cityCandidates;
        final List<String> townCandidates;
        final List<String> kanaCandidates;
        final List<String> romanCandidates;
        final List<String> fullAddressCandidates;
        final List<String> orderCandidates;
        final List<String> versionCandidates;

        private AddressTableMeta(String tableName, List<String> zipCandidates, List<String> prefCodeCandidates,
                List<String> cityCodeCandidates, List<String> cityCandidates, List<String> townCandidates,
                List<String> kanaCandidates, List<String> romanCandidates, List<String> fullAddressCandidates,
                List<String> orderCandidates, List<String> versionCandidates) {
            this.tableName = tableName;
            this.zipCandidates = zipCandidates;
            this.prefCodeCandidates = prefCodeCandidates;
            this.cityCodeCandidates = cityCodeCandidates;
            this.cityCandidates = cityCandidates;
            this.townCandidates = townCandidates;
            this.kanaCandidates = kanaCandidates;
            this.romanCandidates = romanCandidates;
            this.fullAddressCandidates = fullAddressCandidates;
            this.orderCandidates = orderCandidates;
            this.versionCandidates = versionCandidates;
        }
    }

    static final class MaterialTableMeta {
        static final MaterialTableMeta SUPPORTED_CONTRACT = new MaterialTableMeta(
                "TBL_MATERIAL_H_M",
                "material_code",
                "material_name",
                "kana_name",
                "category",
                "material_category",
                "unit",
                "price",
                "maker",
                "start_date",
                "end_date",
                "upymd"
        );
        final String tableName;
        final String codeColumn;
        final String nameColumn;
        final String kanaColumn;
        final String categoryColumn;
        final String materialCategoryColumn;
        final String unitColumn;
        final String priceColumn;
        final String makerColumn;
        final String startDateColumn;
        final String endDateColumn;
        final String versionColumn;

        private MaterialTableMeta(String tableName, String codeColumn, String nameColumn, String kanaColumn,
                String categoryColumn, String materialCategoryColumn, String unitColumn, String priceColumn,
                String makerColumn, String startDateColumn, String endDateColumn, String versionColumn) {
            this.tableName = tableName;
            this.codeColumn = codeColumn;
            this.nameColumn = nameColumn;
            this.kanaColumn = kanaColumn;
            this.categoryColumn = categoryColumn;
            this.materialCategoryColumn = materialCategoryColumn;
            this.unitColumn = unitColumn;
            this.priceColumn = priceColumn;
            this.makerColumn = makerColumn;
            this.startDateColumn = startDateColumn;
            this.endDateColumn = endDateColumn;
            this.versionColumn = versionColumn;
        }
    }

    static final class KensaSortTableMeta {
        static final KensaSortTableMeta SUPPORTED_CONTRACT = new KensaSortTableMeta(
                "TBL_KENSASORT",
                "kensa_code",
                "kensa_name",
                "kana_name",
                "kensa_sort",
                "classification",
                "start_date",
                "end_date",
                "upymd"
        );
        final String tableName;
        final String codeColumn;
        final String nameColumn;
        final String kanaColumn;
        final String kensaSortColumn;
        final String classificationColumn;
        final String startDateColumn;
        final String endDateColumn;
        final String versionColumn;

        private KensaSortTableMeta(String tableName, String codeColumn, String nameColumn, String kanaColumn,
                String kensaSortColumn, String classificationColumn, String startDateColumn, String endDateColumn,
                String versionColumn) {
            this.tableName = tableName;
            this.codeColumn = codeColumn;
            this.nameColumn = nameColumn;
            this.kanaColumn = kanaColumn;
            this.kensaSortColumn = kensaSortColumn;
            this.classificationColumn = classificationColumn;
            this.startDateColumn = startDateColumn;
            this.endDateColumn = endDateColumn;
            this.versionColumn = versionColumn;
        }
    }
}
