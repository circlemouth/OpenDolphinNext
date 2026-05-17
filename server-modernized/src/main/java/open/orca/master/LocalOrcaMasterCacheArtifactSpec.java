package open.orca.master;

import java.util.List;
import java.util.Set;

/**
 * Canonical artifact contract for OpenDolphin local ORCA master cache.
 */
public final class LocalOrcaMasterCacheArtifactSpec {

    public static final String SCHEMA_VERSION = "opendolphin.local-orca-master-cache.v1";
    public static final String MANIFEST_PATH = "manifest.json";
    public static final String CANONICAL_CSV_PATH = "local-orca-master-cache.csv";

    public static final List<String> CANONICAL_HEADERS = List.of(
            "recordType",
            "masterType",
            "code",
            "name",
            "kana",
            "category",
            "unit",
            "price",
            "validFrom",
            "validTo",
            "masterVersion",
            "note",
            "searchText",
            "payloadJson",
            "setCode",
            "entity",
            "kind",
            "classCode",
            "className",
            "itemCount",
            "seq",
            "quantity",
            "memo",
            "rowRole",
            "rowSubtype",
            "code2",
            "interactionCode",
            "interactionName",
            "message");

    public static final Set<String> REQUIRED_MASTER_TYPES = Set.of(
            "drug",
            "etensu",
            "generic-price",
            "generic-class",
            "comment",
            "bodypart",
            "youhou",
            "material",
            "kensa-sort",
            "hokenja",
            "address",
            "order-inputsets",
            "order-interactions",
            "disease-candidate");

    private LocalOrcaMasterCacheArtifactSpec() {
    }
}
