package open.dolphin.rest.masterupdate;

import java.util.List;

/**
 * Dataset catalog for master update management.
 */
public final class MasterUpdateCatalog {

    private MasterUpdateCatalog() {
    }

    public static List<DatasetDefinition> defaultDefinitions() {
        return List.of(
                new DatasetDefinition(
                        "orca_master_core",
                        "ORCA core master",
                        "https://www.orca.med.or.jp/receipt/tec/api/master_last_update.html",
                        "15分ポーリング + 深夜再同期",
                        "XML/DB",
                        "ORCAを正とし、ORCA側更新実行は行わない",
                        true,
                        false,
                        15
                ),
                new DatasetDefinition(
                        "disease_master",
                        "ORCA disease master",
                        "orca:masterlastupdatev3",
                        "起動時 + 日次確認",
                        "XML/DB",
                        "病名候補と Disease_Single component 検証用。ORCA disease_master 更新日を監視する",
                        true,
                        false,
                        24 * 60
                ),
                new DatasetDefinition(
                        "drug_package_medhot",
                        "MEDHOT package unit",
                        "https://medhot.medd.jp/view_download",
                        "毎日 1回",
                        "CSV",
                        "包装単位を補完。外部不達時は手動アップロード",
                        true,
                        true,
                        24 * 60
                ),
                new DatasetDefinition(
                        "pmda_insert_index",
                        "PMDA insert index",
                        "https://www.pmda.go.jp/safety/info-services/medi-navi/0012.html",
                        "毎日 1回",
                        "CSV/ZIP",
                        "本文非保持。リンクと改訂情報のみ取り込み",
                        true,
                        true,
                        24 * 60
                ),
                new DatasetDefinition(
                        "medis_standard_master",
                        "MEDIS standard master",
                        "https://www.medis.or.jp/4_hyojyun/medis-master/riyou/index.html",
                        "週 1回",
                        "CSV",
                        "利用条件・許諾を満たす場合のみ有効化",
                        false,
                        true,
                        7 * 24 * 60
                )
        );
    }

    public static final class DatasetDefinition {

        private final String code;
        private final String name;
        private final String sourceUrl;
        private final String updateFrequency;
        private final String format;
        private final String usageNotes;
        private final boolean autoEnabled;
        private final boolean manualUploadAllowed;
        private final int defaultIntervalMinutes;

        public DatasetDefinition(String code,
                                 String name,
                                 String sourceUrl,
                                 String updateFrequency,
                                 String format,
                                 String usageNotes,
                                 boolean autoEnabled,
                                 boolean manualUploadAllowed,
                                 int defaultIntervalMinutes) {
            this.code = code;
            this.name = name;
            this.sourceUrl = sourceUrl;
            this.updateFrequency = updateFrequency;
            this.format = format;
            this.usageNotes = usageNotes;
            this.autoEnabled = autoEnabled;
            this.manualUploadAllowed = manualUploadAllowed;
            this.defaultIntervalMinutes = defaultIntervalMinutes;
        }

        public String getCode() {
            return code;
        }

        public String getName() {
            return name;
        }

        public String getSourceUrl() {
            return sourceUrl;
        }

        public String getUpdateFrequency() {
            return updateFrequency;
        }

        public String getFormat() {
            return format;
        }

        public String getUsageNotes() {
            return usageNotes;
        }

        public boolean isAutoEnabled() {
            return autoEnabled;
        }

        public boolean isManualUploadAllowed() {
            return manualUploadAllowed;
        }

        public int getDefaultIntervalMinutes() {
            return defaultIntervalMinutes;
        }
    }
}
