package open.orca.rest;

final class OrcaMasterDaoTableMeta {
    private OrcaMasterDaoTableMeta() {
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
